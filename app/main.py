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
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional

from app.services import gemini_service, youtube_service, trend_service, env_manager

app = FastAPI(title="ShortsHelper", version="2.0.0")

# ─── 정적 파일 & 템플릿 ──────────────────────────────────────────────────────
_ROOT = Path(__file__).parent.parent
app.mount("/static", StaticFiles(directory=str(_ROOT / "static")), name="static")
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
    model: Optional[str] = "gemini-2.0-flash"


@app.post("/api/gemini")
async def api_gemini(body: GeminiRequest):
    return gemini_service.generate_text(body.prompt, body.model or "gemini-2.0-flash")


# ─── API: Gemini Vision ───────────────────────────────────────────────────────
class VisionRequest(BaseModel):
    frames: list[str]
    prompt: str
    model: Optional[str] = "gemini-2.0-flash"


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
