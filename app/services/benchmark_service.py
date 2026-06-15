"""
벤치마킹 분석 서비스 — 백그라운드 잡 + CSV 저장
"""
import csv
import json
import re
import threading
import uuid
from datetime import datetime
from pathlib import Path

from app.services import gemini_service
from app.services import youtube_channel_service as yt_ch
from app.services import transcript_service

_ROOT = Path(__file__).parent.parent.parent
_CSV_DIR = _ROOT / "output" / "csv"
_STATE_FILE = _ROOT / "data" / "benchmark_state.json"
_LOCK = threading.Lock()
_THREAD: threading.Thread | None = None
_STOP = False

DEFAULT_CHANNELS = """https://www.youtube.com/@살림남
https://www.youtube.com/@Homestory_official
https://www.youtube.com/@살림메모
https://www.youtube.com/@홈팁_hometip
https://www.youtube.com/@살림_Saving
https://www.youtube.com/@야무진
https://www.youtube.com/@방구석살림
https://www.youtube.com/@harusalim
https://www.youtube.com/@Salim_Factory
https://www.youtube.com/@LivingStyle-LS
https://www.youtube.com/@salimcorner
https://www.youtube.com/@droowa_home
https://www.youtube.com/@good_use_zip
https://www.youtube.com/@Salrimharia
https://www.youtube.com/@홈캐치
https://www.youtube.com/@살림우니"""


def _default_state() -> dict:
    return {
        "job_id": None,
        "status": "idle",       # idle | waiting | running | done | error | stopped
        "progress": 0,
        "current_channel": "",
        "logs": [],
        "params": {},
        "verified_channels": [],
        "raw_rows": [],
        "product_summary": [],
        "top_products": [],
        "top_videos": [],
        "title_patterns": [],
        "files": {},
        "error": None,
        "started_at": None,
        "finished_at": None,
    }


def _load_state() -> dict:
    if _STATE_FILE.exists():
        try:
            with open(_STATE_FILE, encoding="utf-8") as f:
                data = json.load(f)
            base = _default_state()
            base.update(data)
            return base
        except Exception:
            pass
    return _default_state()


def _save_state(state: dict) -> None:
    _STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(_STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def _log(state: dict, msg: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    state["logs"].append(f"[{ts}] {msg}")
    if len(state["logs"]) > 500:
        state["logs"] = state["logs"][-500:]
    _save_state(state)


def get_default_channels() -> str:
    return DEFAULT_CHANNELS


def verify_channels_text(text: str) -> dict:
    lines = text.splitlines()
    return yt_ch.verify_channels(lines)


def get_status() -> dict:
    with _LOCK:
        state = _load_state()
    return {
        "job_id": state.get("job_id"),
        "status": state.get("status", "idle"),
        "progress": state.get("progress", 0),
        "current_channel": state.get("current_channel", ""),
        "logs": state.get("logs", [])[-100:],
        "error": state.get("error"),
        "files": state.get("files", {}),
        "started_at": state.get("started_at"),
        "finished_at": state.get("finished_at"),
    }


def get_result() -> dict:
    with _LOCK:
        state = _load_state()
    if state.get("status") not in ("done", "stopped") and not state.get("raw_rows"):
        return {"error": "완료된 분석 결과가 없습니다."}
    return {
        "job_id": state.get("job_id"),
        "status": state.get("status"),
        "verified_channels": state.get("verified_channels", []),
        "raw_rows": state.get("raw_rows", []),
        "product_summary": state.get("product_summary", []),
        "top_products": state.get("top_products", []),
        "top_videos": state.get("top_videos", []),
        "title_patterns": state.get("title_patterns", []),
        "files": state.get("files", {}),
    }


def get_download_path(filename: str) -> Path | None:
    if not filename or ".." in filename or "/" in filename or "\\" in filename:
        return None
    path = _CSV_DIR / filename
    return path if path.is_file() else None


def stop_run() -> dict:
    global _STOP
    _STOP = True
    with _LOCK:
        state = _load_state()
        if state.get("status") == "running":
            state["status"] = "stopped"
            _log(state, "사용자에 의해 분석이 중지되었습니다.")
        return {"ok": True, "status": state.get("status")}


def start_run(params: dict) -> dict:
    global _THREAD, _STOP

    with _LOCK:
        state = _load_state()
        if state.get("status") == "running":
            return {"error": "이미 분석이 진행 중입니다."}

    verify = verify_channels_text(params.get("channels_text", ""))
    valid = [c for c in verify.get("channels", []) if not c.get("error")]
    if not valid:
        return {"error": "유효한 채널이 없습니다. 채널 확인 후 다시 시도하세요."}

    job_id = uuid.uuid4().hex[:12]
    _STOP = False

    new_state = _default_state()
    new_state.update({
        "job_id": job_id,
        "status": "running",
        "progress": 0,
        "params": params,
        "verified_channels": verify.get("channels", []),
        "started_at": datetime.now().isoformat(),
        "logs": [],
    })
    _save_state(new_state)
    _log(new_state, "벤치마킹 분석 시작")

    def _runner():
        try:
            _run_job(job_id, params, valid)
        except Exception as e:
            state = _load_state()
            state["status"] = "error"
            state["error"] = str(e)
            _log(state, f"오류: {e}")
            state["finished_at"] = datetime.now().isoformat()
            _save_state(state)

    _THREAD = threading.Thread(target=_runner, daemon=True)
    _THREAD.start()
    return {"ok": True, "job_id": job_id, "status": "running"}


def _extract_product(video: dict, channel: dict, transcript: str, mode: str) -> dict:
    title = video.get("title", "")
    desc  = video.get("description", "")[:800]
    text_parts = [f"제목: {title}", f"설명: {desc}"]
    if transcript:
        text_parts.append(f"자막: {transcript[:1200]}")
    elif mode != "title_only":
        text_parts.append("(자막 없음 — 제목/설명 기준)")

    prompt = (
        "다음 쇼핑쇼츠 영상에서 소개하는 상품 1개를 추출하세요.\n"
        "반드시 JSON 한 줄만 출력: {\"product_name\":\"\",\"brand\":\"\",\"category\":\"\"}\n"
        "브랜드를 알 수 없으면 \"미확인\", 카테고리는 한국어(예: 주방용품).\n"
        "상품을 특정할 수 없으면 product_name을 \"미확인\".\n\n"
        + "\n".join(text_parts)
    )
    res = gemini_service.generate_text(prompt, temperature=0.3)
    if res.get("error"):
        return {"product_name": "미확인", "brand": "미확인", "category": "미분류"}

    raw = res.get("text", "")
    m = re.search(r"\{[^{}]+\}", raw)
    if m:
        try:
            obj = json.loads(m.group())
            return {
                "product_name": obj.get("product_name") or "미확인",
                "brand": obj.get("brand") or "미확인",
                "category": obj.get("category") or "미분류",
            }
        except json.JSONDecodeError:
            pass
    return {"product_name": "미확인", "brand": "미확인", "category": "미분류"}


def _normalize_product(name: str) -> str:
    n = re.sub(r"\s+", " ", (name or "").strip())
    return n if n else "미확인"


def _aggregate_products(raw_rows: list) -> tuple[list, list]:
    agg: dict[str, dict] = {}
    for row in raw_rows:
        key = _normalize_product(row.get("product_name", ""))
        if key not in agg:
            agg[key] = {"product_name": key, "count": 0, "total_views": 0, "views": []}
        agg[key]["count"] += 1
        v = int(row.get("viewCount", 0))
        agg[key]["total_views"] += v
        agg[key]["views"].append(v)

    summary = sorted(agg.values(), key=lambda x: x["count"], reverse=True)
    for s in summary:
        s["avg_views"] = round(s["total_views"] / s["count"]) if s["count"] else 0

    top = sorted(summary, key=lambda x: x["total_views"], reverse=True)[:50]
    ranked = []
    for i, p in enumerate(top, 1):
        ranked.append({
            "rank": i,
            "product_name": p["product_name"],
            "count": p["count"],
            "total_views": p["total_views"],
            "avg_views": p["avg_views"],
        })
    return summary, ranked


def _top_videos(raw_rows: list) -> list:
    sorted_rows = sorted(raw_rows, key=lambda x: int(x.get("viewCount", 0)), reverse=True)[:50]
    return [{
        "id": r.get("id", ""),
        "channel": r.get("channelTitle", ""),
        "title": r.get("title", ""),
        "viewCount": r.get("viewCount", 0),
        "url": r.get("url", ""),
        "description": r.get("description", ""),
        "product_name": r.get("product_name", ""),
        "category": r.get("category", ""),
    } for r in sorted_rows]


def _extract_title_patterns(titles: list[str]) -> list[str]:
    if not titles:
        return []
    sample = titles[:80]
    prompt = (
        "다음 쇼핑쇼츠 제목 목록에서 조회수가 높을 때 자주 쓰이는 제목 패턴 TOP 10을 추출하세요.\n"
        "각 패턴은 한 줄에 하나, 번호와 함께 출력. 패턴만 작성 (예: 1. 이거 하나면 끝)\n\n"
        + "\n".join(f"- {t}" for t in sample)
    )
    res = gemini_service.generate_text(prompt, temperature=0.5)
    if res.get("error"):
        return [f"패턴 분석 실패: {res['error']}"]
    lines = []
    for line in (res.get("text") or "").splitlines():
        line = re.sub(r"^\d+[\.\)]\s*", "", line.strip())
        if line:
            lines.append(line)
    return lines[:10]


def _write_csvs(state: dict, ts: str) -> dict:
    _CSV_DIR.mkdir(parents=True, exist_ok=True)
    files = {}

    raw_name = f"benchmark_raw_{ts}.csv"
    raw_path = _CSV_DIR / raw_name
    with open(raw_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["채널", "제목", "조회수", "업로드일", "영상길이", "상품명", "브랜드", "카테고리", "URL"])
        for r in state.get("raw_rows", []):
            w.writerow([
                r.get("channelTitle", ""), r.get("title", ""), r.get("viewCount", 0),
                r.get("publishedAt", ""), r.get("durationLabel", ""),
                r.get("product_name", ""), r.get("brand", ""), r.get("category", ""),
                r.get("url", ""),
            ])
    files["raw"] = raw_name

    prod_name = f"benchmark_products_{ts}.csv"
    prod_path = _CSV_DIR / prod_name
    with open(prod_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["순위", "상품명", "등장횟수", "총조회수", "평균조회수"])
        for p in state.get("top_products", []):
            w.writerow([p.get("rank"), p.get("product_name"), p.get("count"),
                        p.get("total_views"), p.get("avg_views")])
    files["products"] = prod_name

    pat_name = f"benchmark_patterns_{ts}.csv"
    pat_path = _CSV_DIR / pat_name
    with open(pat_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["순위", "제목패턴"])
        for i, p in enumerate(state.get("title_patterns", []), 1):
            w.writerow([i, p])
    files["patterns"] = pat_name

    return files


def _run_job(job_id: str, params: dict, channels: list) -> None:
    global _STOP

    mode          = params.get("analysis_mode", "subtitle_first")
    whisper_model = params.get("whisper_model", "tiny")
    min_views     = int(params.get("min_views", 50000))
    max_per_ch    = int(params.get("max_videos_per_channel", 50))
    max_seconds   = int(params.get("max_shorts_seconds", 75))
    start_date    = params.get("start_date", "")
    end_date      = params.get("end_date", "")

    state = _load_state()
    raw_rows: list[dict] = []
    total = len(channels)

    for idx, ch in enumerate(channels):
        if _STOP:
            break

        ctitle = ch.get("title", "")
        cid    = ch.get("id", "")
        state = _load_state()
        state["current_channel"] = ctitle
        state["progress"] = int((idx / max(total, 1)) * 90)
        _log(state, f"{ctitle} 분석 시작")

        vids = yt_ch.fetch_channel_videos(
            cid, start_date, end_date,
            min_views=min_views, max_count=max_per_ch, max_seconds=max_seconds,
        )
        if vids.get("error"):
            _log(state, f"{ctitle} 영상 수집 실패: {vids['error']}")
            continue

        items = vids.get("items", [])
        _log(state, f"영상 {len(items)}개 수집 완료")

        for vi, video in enumerate(items):
            if _STOP:
                break
            transcript = transcript_service.get_transcript_text(
                video["id"], mode, whisper_model,
            )
            product = _extract_product(video, ch, transcript, mode)
            raw_rows.append({
                **video,
                "channelTitle": ctitle,
                "channelUrl": ch.get("url", ""),
                "subscriberCount": ch.get("subscriberCount", 0),
                **product,
            })

            if vi % 5 == 4:
                state = _load_state()
                state["raw_rows"] = raw_rows
                state["progress"] = int((idx / max(total, 1)) * 90 + (vi / max(len(items), 1)) * (90 / max(total, 1)))
                _save_state(state)

        state = _load_state()
        state["raw_rows"] = raw_rows
        _log(state, f"{ctitle} 상품 추출 완료")

    state = _load_state()
    state["progress"] = 92
    _log(state, "상품 집계 중...")
    summary, top_products = _aggregate_products(raw_rows)
    top_videos = _top_videos(raw_rows)
    titles = [r.get("title", "") for r in raw_rows if r.get("title")]
    patterns = _extract_title_patterns(titles)

    state["raw_rows"] = raw_rows
    state["product_summary"] = summary
    state["top_products"] = top_products
    state["top_videos"] = top_videos
    state["title_patterns"] = patterns

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    state["files"] = _write_csvs(state, ts)
    state["progress"] = 100
    state["current_channel"] = ""
    state["finished_at"] = datetime.now().isoformat()

    if _STOP:
        state["status"] = "stopped"
        _log(state, "분석 중지됨 — 부분 결과 저장")
    else:
        state["status"] = "done"
        _log(state, "벤치마킹 분석 완료")

    _save_state(state)
