"""
벤치마킹 — 쇼츠 영상 심층 분석 서비스
빠른 경로: 썸네일 + 자막 + Gemini (기본)
선택: yt-dlp 다운로드 후 프레임 추출 (45초 타임아웃)
"""
import base64
import json
import re
import subprocess
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import requests

from app.services import gemini_service, transcript_service

_ROOT = Path(__file__).parent.parent.parent
_TEMP_DIR = _ROOT / "output" / "temp"
_FRAMES_DIR = _ROOT / "output" / "frames"
_ANALYSIS_DIR = _ROOT / "output" / "benchmark"
_JOB_DIR = _ROOT / "data" / "video_analysis_jobs"

_DOWNLOAD_TIMEOUT = 45
_SUBTITLE_TIMEOUT = 20
_GEMINI_FRAMES_MAX = 3
_STALE_JOB_SEC = 600

_LOCK = threading.Lock()
_JOBS: dict[str, dict] = {}
_EXEC = ThreadPoolExecutor(max_workers=2)


def _ensure_dirs() -> None:
    for d in (_TEMP_DIR, _FRAMES_DIR, _ANALYSIS_DIR, _JOB_DIR):
        d.mkdir(parents=True, exist_ok=True)


def _analysis_path(video_id: str) -> Path:
    return _ANALYSIS_DIR / f"analysis_{video_id}.json"


def _job_state_path(video_id: str) -> Path:
    return _JOB_DIR / f"{video_id}.json"


def _save_job_state(video_id: str, state: dict) -> None:
    _ensure_dirs()
    with _LOCK:
        _JOBS[video_id] = state
    try:
        with open(_job_state_path(video_id), "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False)
    except Exception:
        pass


def _load_job_state(video_id: str) -> dict | None:
    path = _job_state_path(video_id)
    if not path.is_file():
        return None
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _load_saved(video_id: str) -> dict | None:
    path = _analysis_path(video_id)
    if not path.is_file():
        return None
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _is_stale_running(job: dict) -> bool:
    if job.get("status") != "running":
        return False
    started = job.get("started_at")
    if not started:
        return True
    try:
        dt = datetime.fromisoformat(started)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        age = (datetime.now(timezone.utc) - dt).total_seconds()
        return age > _STALE_JOB_SEC
    except Exception:
        return True


def get_analysis(video_id: str) -> dict:
    saved = _load_saved(video_id)
    with _LOCK:
        job = _JOBS.get(video_id) or _load_job_state(video_id)

    if job and _is_stale_running(job):
        job = {
            "status": "error", "progress": 0,
            "message": "이전 분석이 시간 초과되었습니다. 다시 시도하세요.",
            "error": "timeout",
        }
        _save_job_state(video_id, job)

    if job:
        out = {"video_id": video_id, **job}
        if job.get("result"):
            out["result"] = job["result"]
        elif saved and job.get("status") == "done":
            out["result"] = saved
        return out
    if saved:
        return {"video_id": video_id, "status": "done", "progress": 100, "result": saved}
    return {"video_id": video_id, "status": "idle", "progress": 0, "message": "대기 중"}


def start_analysis(params: dict) -> dict:
    video_id = (params.get("video_id") or "").strip()
    url = (params.get("url") or "").strip()
    if not video_id or not url:
        return {"error": "video_id와 url이 필요합니다."}

    saved = _load_saved(video_id)
    if saved and params.get("force") is not True:
        return {
            "ok": True, "video_id": video_id,
            "status": "done", "cached": True, "result": saved,
        }

    job = _JOBS.get(video_id) or _load_job_state(video_id)
    if job and job.get("status") == "running" and not _is_stale_running(job):
        return {"ok": True, "video_id": video_id, "status": "running", **job}

    _ensure_dirs()
    _save_job_state(video_id, {
        "status": "running",
        "progress": 5,
        "message": "분석 시작...",
        "started_at": datetime.now(timezone.utc).isoformat(),
    })

    _EXEC.submit(_run_analysis, video_id, params)
    return {"ok": True, "video_id": video_id, "status": "running"}


def _update(video_id: str, progress: int, message: str, status: str | None = None) -> None:
    with _LOCK:
        job = dict(_JOBS.get(video_id) or _load_job_state(video_id) or {})
    job["progress"] = progress
    job["message"] = message
    if status:
        job["status"] = status
    if "started_at" not in job:
        job["started_at"] = datetime.now(timezone.utc).isoformat()
    _save_job_state(video_id, job)


def _download_video_impl(video_id: str, url: str) -> Path | None:
    _ensure_dirs()
    out_tpl = str(_TEMP_DIR / f"{video_id}.%(ext)s")
    try:
        import yt_dlp
        opts = {
            "format": "best[height<=480]/best[height<=720]/best",
            "outtmpl": out_tpl,
            "quiet": True,
            "no_warnings": True,
            "socket_timeout": 30,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([url])
        for p in _TEMP_DIR.glob(f"{video_id}.*"):
            if p.suffix.lower() in (".mp4", ".webm", ".mkv", ".mov"):
                return p
    except Exception:
        pass
    return None


def _download_video(video_id: str, url: str) -> Path | None:
    result: list = [None]

    def worker() -> None:
        result[0] = _download_video_impl(video_id, url)

    t = threading.Thread(target=worker, daemon=True)
    t.start()
    t.join(timeout=_DOWNLOAD_TIMEOUT)
    return result[0]


def _download_thumbnail_frames(video_id: str, max_frames: int = 3) -> list[dict]:
    urls = [
        f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
        f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg",
        f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
    ]
    frames = []
    for i, thumb_url in enumerate(urls[:max_frames], 1):
        try:
            r = requests.get(thumb_url, timeout=12, verify=False)
            if not r.ok or len(r.content) < 1000:
                continue
            fname = f"{video_id}_{i:03d}.jpg"
            out_path = _FRAMES_DIR / fname
            out_path.write_bytes(r.content)
            frames.append({
                "index": i, "second": (i - 1) * 5,
                "filename": fname, "url": f"/frames/{fname}",
                "source": "thumbnail",
            })
        except Exception:
            continue
    return frames


def _video_duration(path: Path) -> float:
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True, timeout=15,
        )
        return float(r.stdout.strip() or 0)
    except Exception:
        return 45.0


def _extract_frames(video_id: str, video_path: Path, interval: int = 5, max_frames: int = 10) -> list[dict]:
    _ensure_dirs()
    duration = min(_video_duration(video_path), interval * max_frames)
    times = []
    t = 0.0
    while t <= duration and len(times) < max_frames:
        times.append(t)
        t += interval
    if not times:
        times = [0.0]

    frames = []
    for i, sec in enumerate(times, 1):
        fname = f"{video_id}_{i:03d}.jpg"
        out_path = _FRAMES_DIR / fname
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-ss", str(sec), "-i", str(video_path),
                 "-frames:v", "1", "-q:v", "2", str(out_path)],
                capture_output=True, timeout=20, check=False,
            )
        except (subprocess.TimeoutExpired, FileNotFoundError):
            continue
        if out_path.is_file() and out_path.stat().st_size > 500:
            frames.append({
                "index": i, "second": sec,
                "filename": fname, "url": f"/frames/{fname}",
                "source": "video",
            })
    return frames


def _frame_b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def _get_subtitle(video_id: str) -> str:
    result: list = [""]

    def worker() -> None:
        result[0] = transcript_service.get_transcript_text(video_id, "subtitle_first", "tiny") or ""

    t = threading.Thread(target=worker, daemon=True)
    t.start()
    t.join(timeout=_SUBTITLE_TIMEOUT)
    return result[0]


def _parse_json(text: str) -> dict:
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return {}
    try:
        return json.loads(m.group())
    except json.JSONDecodeError:
        return {}


def _analyze_with_gemini(
    video_id: str, params: dict, frames: list[dict], subtitle: str, fallback_mode: bool = False,
) -> dict:
    frame_paths = [_FRAMES_DIR / f["filename"] for f in frames if f.get("filename")]
    b64_list = []
    for p in frame_paths[:_GEMINI_FRAMES_MAX]:
        if p.is_file() and p.stat().st_size > 500:
            b64_list.append(_frame_b64(p))

    title = params.get("title", "")
    channel = params.get("channel_name", "")
    description = (params.get("description") or "")[:600]
    mode_note = "(썸네일+텍스트 기반 빠른 분석)" if fallback_mode else ""

    prompt = f"""당신은 쇼핑쇼츠 마케팅 분석 전문가입니다.
아래 영상 정보·자막·이미지를 분석하여 JSON만 출력하세요. {mode_note}

영상 제목: {title}
채널: {channel}
설명: {description}
자막: {subtitle[:2000] if subtitle else '(자막 없음)'}

다음 JSON 형식으로만 응답 (한국어, 마크다운 없이):
{{
  "video_title": "...",
  "channel_name": "...",
  "product_name": "...",
  "brand": "미확인",
  "category": "...",
  "product_type": "...",
  "features": ["특징1", "특징2"],
  "selling_points": ["판매포인트1"],
  "hook": "후킹 문구",
  "cta": "CTA 문구",
  "structure": [
    {{"time": "0~5초", "section": "문제 제기", "description": "..."}}
  ],
  "why_popular": "왜 조회수가 높은지 2-3문장",
  "frame_notes": ["관찰1"]
}}"""

    if b64_list:
        res = gemini_service.generate_vision(b64_list, prompt, max_tokens=4096)
    else:
        res = gemini_service.generate_text(prompt, temperature=0.4)

    if res.get("error"):
        return {"error": res["error"]}

    parsed = _parse_json(res.get("text", ""))
    if not parsed:
        parsed = {
            "video_title": title,
            "channel_name": channel,
            "product_name": params.get("product_name") or "미확인",
            "brand": "미확인",
            "category": params.get("category") or "미분류",
            "product_type": "",
            "features": [],
            "selling_points": [],
            "hook": "",
            "cta": "",
            "structure": [],
            "why_popular": (res.get("text") or "")[:500],
            "frame_notes": [],
        }

    parsed["video_id"] = video_id
    parsed["video_url"] = params.get("url", "")
    parsed["subtitle"] = subtitle
    parsed["frames"] = frames
    parsed["fallback_mode"] = fallback_mode
    parsed["analyzed_at"] = datetime.now(timezone.utc).isoformat()
    return parsed


def _cleanup_temp(video_id: str, video_path: Path | None) -> None:
    if video_path and video_path.is_file():
        try:
            video_path.unlink()
        except Exception:
            pass
    for p in _TEMP_DIR.glob(f"{video_id}.*"):
        try:
            p.unlink()
        except Exception:
            pass


def _run_analysis(video_id: str, params: dict) -> None:
    video_path = None
    fallback_mode = True
    try:
        # ① 빠른 경로: 자막 + 썸네일 먼저 (다운로드 대기 없음)
        _update(video_id, 15, "자막 추출 중...")
        subtitle = _get_subtitle(video_id)

        _update(video_id, 35, "썸네일 수집 중...")
        frames = _download_thumbnail_frames(video_id)

        # ② 선택: 영상 다운로드 (타임아웃 45초, 실패해도 계속)
        _update(video_id, 50, "영상 다운로드 시도 중 (최대 45초)...")
        video_path = _download_video(video_id, params.get("url", ""))
        if video_path:
            _update(video_id, 60, "프레임 추출 중...")
            video_frames = _extract_frames(video_id, video_path)
            if video_frames:
                frames = video_frames
                fallback_mode = False

        if not frames:
            _update(video_id, 55, "썸네일 재시도...")
            frames = _download_thumbnail_frames(video_id)

        _update(video_id, 75, "Gemini AI 분석 중...")
        result = _analyze_with_gemini(video_id, params, frames, subtitle, fallback_mode)
        if result.get("error"):
            raise RuntimeError(result["error"])

        _update(video_id, 92, "결과 저장 중...")
        with open(_analysis_path(video_id), "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        _save_job_state(video_id, {
            "status": "done", "progress": 100,
            "message": "분석 완료", "result": result,
        })
    except Exception as e:
        _save_job_state(video_id, {
            "status": "error", "progress": 0,
            "message": str(e), "error": str(e),
        })
    finally:
        _cleanup_temp(video_id, video_path)
