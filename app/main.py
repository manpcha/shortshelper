"""
ShortsHelper — FastAPI 메인 앱
"""
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SSL 인증서 설정 — 반드시 모든 import 전에 실행해야 한다.
#
# truststore: Windows 네이티브 인증서 저장소를 Python ssl 에 주입.
#   → 백신/프록시 SSL 인터셉션 환경에서도 requests 가 정상 동작.
#   → gRPC 는 자체 BoringSSL 을 사용하므로 별도로 env var 도 설정.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import os

# 1) truststore: Python ssl → Windows 인증서 저장소 사용
try:
    import truststore
    truststore.inject_into_ssl()
except ImportError:
    pass

# 2) gRPC (GRPC_DEFAULT_SSL_ROOTS_FILE_PATH) — certifi 경로 설정
#    gRPC C 확장은 최초 import 시 초기화되므로 여기서 설정해야 함
try:
    import certifi as _certifi
    _CA = _certifi.where()
    os.environ.setdefault("GRPC_DEFAULT_SSL_ROOTS_FILE_PATH", _CA)
    os.environ.setdefault("SSL_CERT_FILE",                    _CA)
    os.environ.setdefault("REQUESTS_CA_BUNDLE",               _CA)
except ImportError:
    pass

from pathlib import Path
from dotenv import load_dotenv

# 서버 시작 시 .env 로드
_ENV_PATH = Path(__file__).parent.parent / ".env"
if _ENV_PATH.exists():
    load_dotenv(str(_ENV_PATH))

import asyncio
import base64
import uuid
from datetime import datetime
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.exceptions import HTTPException
from pydantic import BaseModel, field_validator
from typing import Optional

from app.services import gemini_service, youtube_service, trend_service, env_manager, tts_service, pronunciation_service, benchmark_service, video_analysis_service, materials_service, projects_service

app = FastAPI(title="ShortsHelper", version="2.0.0")

# ─── 정적 파일 & 템플릿 ──────────────────────────────────────────────────────
_ROOT = Path(__file__).parent.parent
app.mount("/static", StaticFiles(directory=str(_ROOT / "static")), name="static")

# 오디오 파일 서빙 (outputs/audio/)
_AUDIO_DIR = _ROOT / "outputs" / "audio"
_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/audio", StaticFiles(directory=str(_AUDIO_DIR)), name="audio")

# 프레임 이미지 서빙 (output/frames/)
_FRAMES_DIR = _ROOT / "output" / "frames"
_FRAMES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/frames", StaticFiles(directory=str(_FRAMES_DIR)), name="frames")

# 업로드 이미지 서빙 (outputs/uploads/)
_UPLOADS_DIR = _ROOT / "outputs" / "uploads"
_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_UPLOADS_DIR)), name="uploads")

templates = Jinja2Templates(directory=str(_ROOT / "templates"))


# ─── 페이지 라우트 ────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def page_dashboard(request: Request):
    return templates.TemplateResponse(request, "dashboard.html", {"page": "dashboard"})


@app.get("/explore", response_class=HTMLResponse)
async def page_explore(request: Request):
    return templates.TemplateResponse(request, "explore.html", {"page": "explore"})


@app.get("/extractor", response_class=HTMLResponse)
async def page_extractor(request: Request):
    return templates.TemplateResponse(request, "extractor.html", {"page": "extractor"})


@app.get("/benchmark", response_class=HTMLResponse)
async def page_benchmark(request: Request):
    return templates.TemplateResponse(
        request, "benchmark.html",
        {"page": "benchmark", "default_channels": benchmark_service.get_default_channels()},
    )


@app.get("/analysis", response_class=HTMLResponse)
async def page_analysis(request: Request):
    return templates.TemplateResponse(request, "analysis.html", {"page": "analysis"})


@app.get("/script", response_class=HTMLResponse)
async def page_script(request: Request):
    return templates.TemplateResponse(request, "script.html", {"page": "script"})


@app.get("/projects", response_class=HTMLResponse)
async def page_projects(request: Request):
    return templates.TemplateResponse(request, "projects.html", {"page": "projects"})


@app.get("/settings", response_class=HTMLResponse)
async def page_settings(request: Request):
    return templates.TemplateResponse(request, "settings.html", {"page": "settings"})


# ─── API: Gemini 텍스트 ───────────────────────────────────────────────────────
class GeminiRequest(BaseModel):
    prompt: str
    model: Optional[str] = "gemini-2.5-flash"


@app.post("/api/gemini")
async def api_gemini(body: GeminiRequest):
    return gemini_service.generate_text(body.prompt, body.model or "gemini-2.5-flash")


# ─── API: Gemini Vision ───────────────────────────────────────────────────────
class VisionRequest(BaseModel):
    frames: list[str]
    prompt: str
    model: Optional[str] = "gemini-2.5-flash"


@app.post("/api/gemini-vision")
async def api_gemini_vision(body: VisionRequest):
    return gemini_service.generate_vision(body.frames, body.prompt, body.model or "gemini-2.5-flash")


# ─── API: Gemini 이미지 분석 (단일 이미지) ────────────────────────────────────
class ImageAnalysisRequest(BaseModel):
    image: str             # base64 encoded image
    mime_type: str = "image/jpeg"
    prompt: str
    model: Optional[str] = "gemini-2.5-flash"

@app.post("/api/gemini-image")
async def api_gemini_image(body: ImageAnalysisRequest):
    return gemini_service.generate_image(
        body.image, body.mime_type, body.prompt,
        body.model or "gemini-2.5-flash"
    )


# ─── API: 제품명 추출기 — 이미지 저장 (Google Lens 등) ───────────────────────
_EXTRACTOR_MIME_EXT = {
    "image/jpeg": ".jpg",
    "image/png":  ".png",
    "image/webp": ".webp",
    "image/gif":  ".gif",
}


class ExtractorImageSaveBody(BaseModel):
    image: str
    mime_type: str = "image/jpeg"


@app.post("/api/extractor/save-image")
async def api_extractor_save_image(body: ExtractorImageSaveBody, request: Request):
    ext = _EXTRACTOR_MIME_EXT.get(body.mime_type, ".jpg")
    fname = f"extract_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}{ext}"
    path = _UPLOADS_DIR / fname
    try:
        path.write_bytes(base64.b64decode(body.image))
    except Exception as e:
        return {"error": f"이미지 저장 실패: {e}"}
    base = str(request.base_url).rstrip("/")
    rel = f"/uploads/{fname}"
    return {"file": fname, "url": rel, "absolute_url": f"{base}{rel}"}


# ─── API: YouTube 검색 ───────────────────────────────────────────────────────
@app.get("/api/youtube")
async def api_youtube(
    query: str,
    period: str = "오늘",
    duration_filter: str = "shorts",
    comment_min: int = 0,
    order: str = "relevance",
):
    env_manager.reload()
    return youtube_service.search_shorts(query, period, duration_filter, comment_min, order)


# ─── API: 트렌드 키워드 ───────────────────────────────────────────────────────
@app.get("/api/naver-trend")
async def api_naver_trend(period: str = "today", category: str = "전체"):
    env_manager.reload()   # 최신 키 반영
    return trend_service.get_trend_keywords(period, category)


# ─── API: 설정 상태 조회 ──────────────────────────────────────────────────────
@app.get("/api/settings/status")
async def api_settings_status():
    return env_manager.get_status()


# ─── API: 설정 저장 ───────────────────────────────────────────────────────────
class SaveRequest(BaseModel):
    geminiApiKey:      Optional[str] = None
    youtubeApiKey:     Optional[str] = None
    naverClientId:     Optional[str] = None
    naverClientSecret: Optional[str] = None


@app.post("/api/settings/save")
async def api_settings_save(body: SaveRequest):
    for key_name, value in body.model_dump(exclude_none=True).items():
        env_manager.save_key(key_name, value or "")
    return {"ok": True, "status": env_manager.get_status()}


# ─── API: TTS 음성 목록 ───────────────────────────────────────────────────────
@app.get("/api/tts/voices")
async def api_tts_voices(provider: str = "elevenlabs"):
    env_manager.reload()
    loop = asyncio.get_event_loop()
    if provider == "google":
        return await loop.run_in_executor(None, tts_service.get_voices_google)
    return await loop.run_in_executor(None, tts_service.get_voices_elevenlabs)


# ─── API: TTS 프리셋 ──────────────────────────────────────────────────────────
@app.get("/api/tts/presets")
async def api_tts_presets():
    return tts_service.get_presets()


class PresetBody(BaseModel):
    id:               Optional[str]   = None
    name:             str
    provider:         str             = "elevenlabs"
    voice_id:         str             = ""
    voice_name:       Optional[str]   = ""
    speaking_rate:    Optional[float] = 1.0
    pitch:            Optional[float] = 0.0
    stability:        Optional[float] = 0.5
    similarity_boost: Optional[float] = 0.75
    style:            Optional[float] = 0.0
    speaker_boost:    Optional[bool]  = True


@app.post("/api/tts/presets/save")
async def api_tts_preset_save(body: PresetBody):
    return tts_service.save_preset(body.model_dump())


@app.delete("/api/tts/presets/{preset_id}")
async def api_tts_preset_delete(preset_id: str):
    return tts_service.delete_preset(preset_id)


# ─── API: TTS 생성 ────────────────────────────────────────────────────────────
class TTSBody(BaseModel):
    text:                   str
    provider:               str             = "elevenlabs"
    voice_id:               str             = ""
    speaking_rate:          Optional[float] = 1.0
    pitch:                  Optional[float] = 0.0
    stability:              Optional[float] = 0.5
    similarity_boost:       Optional[float] = 0.75
    style:                  Optional[float] = 0.0
    speaker_boost:          Optional[bool]  = True
    use_pronunciation:      Optional[bool]  = True   # 한국어 발음 교정 적용 여부
    sentence_split:         Optional[bool]  = True   # Google TTS 문장 단위 합성


@app.post("/api/tts")
async def api_tts(body: TTSBody):
    env_manager.reload()
    loop = asyncio.get_event_loop()

    # Google TTS(Chirp3 HD)는 원문 그대로 전달 — 발음 교정은 ElevenLabs 전용
    if body.provider == "google":
        tts_text = body.text
        fn = lambda: tts_service.tts_google(
            tts_text, body.voice_id,
            speaking_rate=body.speaking_rate or 1.0,
            pitch=body.pitch or 0.0,
            sentence_split=body.sentence_split if body.sentence_split is not None else True,
        )
    else:
        tts_text = pronunciation_service.apply(body.text) if body.use_pronunciation else body.text
        fn = lambda: tts_service.tts_elevenlabs(
            tts_text, body.voice_id,
            stability=body.stability or 0.5,
            similarity_boost=body.similarity_boost or 0.75,
            style=body.style or 0.0,
            speaker_boost=body.speaker_boost if body.speaker_boost is not None else True,
        )
    return await loop.run_in_executor(None, fn)


# ─── API: TTS 비동기 Job (진행률 폴링) ───────────────────────────────────────
_tts_jobs: dict = {}


def _tts_job_progress(job_id: str, done: int, total: int, message: str):
    job = _tts_jobs.get(job_id)
    if not job:
        return
    if message == "완료":
        pct = 100
    elif "병합" in message:
        pct = 95
    elif total:
        pct = max(5, int((done / total) * 85))
    else:
        pct = 5
    job.update(progress=pct, message=message, done=done, total=total)


def _run_tts_job(job_id: str, body: "TTSBody"):
    job = _tts_jobs[job_id]
    try:
        if body.provider == "google":
            result = tts_service.tts_google(
                body.text, body.voice_id,
                speaking_rate=body.speaking_rate or 1.0,
                pitch=body.pitch or 0.0,
                sentence_split=body.sentence_split if body.sentence_split is not None else True,
                progress_cb=lambda d, t, m: _tts_job_progress(job_id, d, t, m),
            )
        else:
            tts_text = pronunciation_service.apply(body.text) if body.use_pronunciation else body.text
            result = tts_service.tts_elevenlabs(
                tts_text, body.voice_id,
                stability=body.stability or 0.5,
                similarity_boost=body.similarity_boost or 0.75,
                style=body.style or 0.0,
                speaker_boost=body.speaker_boost if body.speaker_boost is not None else True,
            )
        if result.get("error"):
            job.update(status="error", error=result["error"], progress=0, message=result["error"])
        else:
            job.update(status="done", progress=100, message="완료",
                       url=result.get("url"), file=result.get("file"), chunks=result.get("chunks"))
    except Exception as e:
        job.update(status="error", error=str(e), progress=0, message=str(e))


@app.post("/api/tts/job")
async def api_tts_job_start(body: TTSBody):
    env_manager.reload()
    job_id = uuid.uuid4().hex
    _tts_jobs[job_id] = {
        "status": "running", "progress": 0, "message": "준비 중...",
        "done": 0, "total": 0, "url": None, "file": None, "error": None,
    }
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, lambda: _run_tts_job(job_id, body))
    return {"job_id": job_id}


@app.get("/api/tts/job/{job_id}")
async def api_tts_job_status(job_id: str):
    job = _tts_jobs.get(job_id)
    if not job:
        return {"error": "작업을 찾을 수 없습니다."}
    return job


# ─── API: 발음 교정 사전 ──────────────────────────────────────────────────────
@app.get("/api/pronunciation")
async def api_pronunciation_get():
    return pronunciation_service.get_all()


class PronunciationEntry(BaseModel):
    src: str
    dst: str


@app.post("/api/pronunciation")
async def api_pronunciation_save(entry: PronunciationEntry):
    return pronunciation_service.save_entry(entry.src, entry.dst)


@app.delete("/api/pronunciation/{src}")
async def api_pronunciation_delete(src: str):
    return pronunciation_service.delete_entry(src)


# ─── API: 벤치마킹 ────────────────────────────────────────────────────────────
class BenchmarkChannelsRequest(BaseModel):
    channels_text: str


class BenchmarkRunRequest(BaseModel):
    channels_text: str
    start_date: str
    end_date: str
    min_views: int = 50000
    max_videos_per_channel: int = 50
    max_shorts_seconds: int = 75
    analysis_mode: str = "subtitle_first"
    whisper_model: str = "tiny"


@app.post("/api/benchmark/channels")
async def api_benchmark_channels(body: BenchmarkChannelsRequest):
    env_manager.reload()
    return benchmark_service.verify_channels_text(body.channels_text)


@app.post("/api/benchmark/run")
async def api_benchmark_run(body: BenchmarkRunRequest):
    env_manager.reload()
    return benchmark_service.start_run(body.model_dump())


@app.get("/api/benchmark/status")
async def api_benchmark_status():
    return benchmark_service.get_status()


@app.get("/api/benchmark/result")
async def api_benchmark_result():
    return benchmark_service.get_result()


@app.post("/api/benchmark/stop")
async def api_benchmark_stop():
    return benchmark_service.stop_run()


@app.get("/api/benchmark/download/{filename}")
async def api_benchmark_download(filename: str):
    path = benchmark_service.get_download_path(filename)
    if not path:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(path, filename=filename, media_type="text/csv")


# ─── API: 벤치마킹 영상 심층 분석 ───────────────────────────────────────────
class VideoAnalysisRequest(BaseModel):
    video_id: str
    url: str
    title: Optional[str] = ""
    channel_name: Optional[str] = ""
    description: Optional[str] = ""
    product_name: Optional[str] = ""
    category: Optional[str] = ""
    whisper_model: Optional[str] = "tiny"
    force: Optional[bool] = False


@app.post("/api/benchmark/video-analysis")
async def api_benchmark_video_analysis(body: VideoAnalysisRequest):
    env_manager.reload()
    return video_analysis_service.start_analysis(body.model_dump())


@app.get("/api/benchmark/video-analysis/{video_id}")
async def api_benchmark_video_analysis_get(video_id: str):
    return video_analysis_service.get_analysis(video_id)


# ─── API: 프로젝트 / 소재 저장 (data/projects.json) ───────────────────────────
class ProjectSaveRequest(BaseModel):
    id: Optional[str] = None
    name: str = ""
    category: str = ""
    status: str = "draft"
    script_content: Optional[str] = ""
    analysis_content: Optional[str] = ""
    form_data: Optional[dict] = {}


class MaterialAddRequest(BaseModel):
    project_id: Optional[str] = None
    source: str = "unknown"
    product_name: str = ""
    category: str = ""
    features: Optional[list] = []
    hook: str = ""
    cta: str = ""
    selling_points: Optional[list] = []
    image_url: Optional[str] = ""
    video_url: Optional[str] = ""
    video_id: Optional[str] = ""
    channel_name: Optional[str] = ""
    video_title: Optional[str] = ""
    memo: Optional[str] = ""
    analysis_content: Optional[str] = ""
    form_data: Optional[dict] = {}

    @field_validator("features", mode="before")
    @classmethod
    def normalize_features(cls, v):
        if v is None:
            return []
        if isinstance(v, str):
            return [x.strip() for x in v.replace("，", ",").split(",") if x.strip()]
        return v


class MigrateProjectsRequest(BaseModel):
    projects: list = []


@app.get("/api/projects")
async def api_projects_get():
    return projects_service.get_all()


@app.post("/api/projects/save")
async def api_projects_save(body: ProjectSaveRequest):
    return projects_service.save_project(body.model_dump())


@app.post("/api/projects/add-material")
async def api_projects_add_material(body: MaterialAddRequest):
    return projects_service.add_material(body.model_dump())


@app.post("/api/projects/migrate-local")
async def api_projects_migrate_local(body: MigrateProjectsRequest):
    return projects_service.migrate_local_projects(body.projects)


@app.delete("/api/projects/{project_id}")
async def api_projects_delete(project_id: str):
    return projects_service.delete_project(project_id)


@app.delete("/api/projects/{project_id}/materials/{material_id}")
async def api_projects_delete_material(project_id: str, material_id: str):
    return projects_service.delete_material(project_id, material_id)


# ─── API: 소재 저장 (레거시 — projects.add-material 로 위임) ─────────────────
class MaterialRequest(BaseModel):
    product_name: str = ""
    category: str = ""
    features: Optional[list] = []
    hook: str = ""
    cta: str = ""
    selling_points: Optional[list] = []
    video_id: Optional[str] = ""
    video_url: Optional[str] = ""
    channel_name: Optional[str] = ""
    video_title: Optional[str] = ""


@app.get("/api/materials")
async def api_materials_get():
    data = projects_service.get_all()
    if data.get("error"):
        return data
    items = []
    for p in data.get("projects", []):
        for m in p.get("materials", []):
            items.append({**m, "project_id": p.get("id")})
    return items


@app.post("/api/materials")
async def api_materials_add(body: MaterialRequest):
    payload = body.model_dump()
    payload["source"] = payload.get("source") or "legacy_materials"
    return projects_service.add_material(payload)


@app.delete("/api/materials/{material_id}")
async def api_materials_delete(material_id: str):
    return materials_service.delete_material(material_id)
