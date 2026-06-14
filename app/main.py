"""
ShortsHelper — FastAPI 메인 앱
"""
from pathlib import Path
from dotenv import load_dotenv

# 서버 시작 시 .env 로드
_ENV_PATH = Path(__file__).parent.parent / ".env"
if _ENV_PATH.exists():
    load_dotenv(str(_ENV_PATH))

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.exceptions import HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services import gemini_service, youtube_service, trend_service, env_manager, tts_service

app = FastAPI(title="ShortsHelper", version="2.0.0")

# ─── 정적 파일 & 템플릿 ──────────────────────────────────────────────────────
_ROOT = Path(__file__).parent.parent
app.mount("/static", StaticFiles(directory=str(_ROOT / "static")), name="static")

# 오디오 파일 서빙 (outputs/audio/)
_AUDIO_DIR = _ROOT / "outputs" / "audio"
_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/audio", StaticFiles(directory=str(_AUDIO_DIR)), name="audio")

templates = Jinja2Templates(directory=str(_ROOT / "templates"))


# ─── 페이지 라우트 ────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def page_dashboard(request: Request):
    return templates.TemplateResponse(request, "dashboard.html", {"page": "dashboard"})


@app.get("/explore", response_class=HTMLResponse)
async def page_explore(request: Request):
    return templates.TemplateResponse(request, "explore.html", {"page": "explore"})


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
    model: Optional[str] = "gemini-3.5-flash"


@app.post("/api/gemini")
async def api_gemini(body: GeminiRequest):
    return gemini_service.generate_text(body.prompt, body.model or "gemini-2.0-flash")


# ─── API: Gemini Vision ───────────────────────────────────────────────────────
class VisionRequest(BaseModel):
    frames: list[str]
    prompt: str
    model: Optional[str] = "gemini-3.5-flash"


@app.post("/api/gemini-vision")
async def api_gemini_vision(body: VisionRequest):
    return gemini_service.generate_vision(body.frames, body.prompt, body.model or "gemini-2.0-flash")


# ─── API: YouTube 쇼츠 검색 ──────────────────────────────────────────────────
@app.get("/api/youtube")
async def api_youtube(query: str, period: str = "7일"):
    return youtube_service.search_shorts(query, period)


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
    if provider == "google":
        return tts_service.get_voices_google()
    return tts_service.get_voices_elevenlabs()


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
    text:             str
    provider:         str             = "elevenlabs"
    voice_id:         str             = ""
    speaking_rate:    Optional[float] = 1.0
    pitch:            Optional[float] = 0.0
    stability:        Optional[float] = 0.5
    similarity_boost: Optional[float] = 0.75
    style:            Optional[float] = 0.0
    speaker_boost:    Optional[bool]  = True


@app.post("/api/tts")
async def api_tts(body: TTSBody):
    env_manager.reload()
    if body.provider == "google":
        return tts_service.tts_google(
            body.text, body.voice_id,
            speaking_rate=body.speaking_rate or 1.0,
            pitch=body.pitch or 0.0,
        )
    return tts_service.tts_elevenlabs(
        body.text, body.voice_id,
        stability=body.stability or 0.5,
        similarity_boost=body.similarity_boost or 0.75,
        style=body.style or 0.0,
        speaker_boost=body.speaker_boost if body.speaker_boost is not None else True,
    )
