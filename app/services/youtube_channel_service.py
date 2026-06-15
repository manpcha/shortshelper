"""
YouTube Data API v3 — 채널 조회 / 영상 수집 (벤치마킹용)
"""
import os
import re
import requests
import urllib3
from datetime import datetime, timezone

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels"
SEARCH_URL   = "https://www.googleapis.com/youtube/v3/search"
VIDEOS_URL   = "https://www.googleapis.com/youtube/v3/videos"


def _api_key() -> str:
    return os.getenv("YOUTUBE_API_KEY", "")


def _get(url: str, params: dict) -> dict:
    key = _api_key()
    if not key:
        return {"error": "YouTube API 키가 설정되지 않았습니다. 설정 화면에서 키를 입력해 주세요."}
    params = {**params, "key": key}
    try:
        resp = requests.get(url, params=params, timeout=20, verify=False)
    except requests.RequestException as e:
        return {"error": f"네트워크 오류: {e}"}
    if not resp.ok:
        try:
            msg = resp.json().get("error", {}).get("message", resp.text)
        except Exception:
            msg = resp.text
        return {"error": f"YouTube API 오류 ({resp.status_code}): {msg}"}
    return resp.json()


def parse_channel_input(line: str) -> dict:
    """URL / @handle / Channel ID → {type, value}"""
    line = (line or "").strip()
    if not line:
        return {"type": "empty", "value": ""}

    m = re.search(r"youtube\.com/@([^/?#\s]+)", line, re.I)
    if m:
        return {"type": "handle", "value": m.group(1)}

    m = re.search(r"youtube\.com/channel/(UC[\w-]{10,})", line, re.I)
    if m:
        return {"type": "id", "value": m.group(1)}

    m = re.search(r"youtube\.com/c/([^/?#\s]+)", line, re.I)
    if m:
        return {"type": "handle", "value": m.group(1)}

    if line.startswith("@"):
        return {"type": "handle", "value": line[1:]}
    if re.match(r"^UC[\w-]{10,}$", line):
        return {"type": "id", "value": line}
    return {"type": "handle", "value": line.lstrip("@")}


def resolve_channel(line: str) -> dict:
    parsed = parse_channel_input(line)
    if parsed["type"] == "empty":
        return {"error": "빈 입력"}

    if parsed["type"] == "id":
        data = _get(CHANNELS_URL, {
            "part": "snippet,statistics",
            "id": parsed["value"],
        })
    else:
        data = _get(CHANNELS_URL, {
            "part": "snippet,statistics",
            "forHandle": parsed["value"],
        })

    if "error" in data:
        return {"input": line, "error": data["error"]}

    items = data.get("items", [])
    if not items:
        return {"input": line, "error": f"채널을 찾을 수 없습니다: {line}"}

    ch = items[0]
    cid = ch["id"]
    sn  = ch.get("snippet", {})
    st  = ch.get("statistics", {})
    title = sn.get("title", "")
    custom = sn.get("customUrl", "")
    url = f"https://www.youtube.com/channel/{cid}"
    if custom:
        url = f"https://www.youtube.com/@{custom.lstrip('@')}"

    return {
        "input": line,
        "id": cid,
        "title": title,
        "url": url,
        "subscriberCount": int(st.get("subscriberCount", 0)),
        "videoCount": int(st.get("videoCount", 0)),
    }


def verify_channels(lines: list[str]) -> dict:
    results = []
    errors = 0
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        r = resolve_channel(line)
        if r.get("error"):
            errors += 1
        results.append(r)
    return {"channels": results, "okCount": sum(1 for r in results if not r.get("error")), "errorCount": errors}


def _parse_duration(iso: str) -> int:
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    if not m:
        return 0
    h, mi, s = (int(x or 0) for x in m.groups())
    return h * 3600 + mi * 60 + s


def _fmt_duration(seconds: int) -> str:
    return f"{seconds // 60}:{seconds % 60:02d}"


def _to_rfc3339(date_str: str, end_of_day: bool = False) -> str:
    """YYYY-MM-DD → RFC3339 UTC"""
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    if end_of_day:
        dt = dt.replace(hour=23, minute=59, second=59)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_channel_videos(
    channel_id: str,
    start_date: str,
    end_date: str,
    min_views: int = 50000,
    max_count: int = 50,
    max_seconds: int = 75,
) -> dict:
    """채널 영상 수집 + 필터"""
    published_after  = _to_rfc3339(start_date)
    published_before = _to_rfc3339(end_date, end_of_day=True)

    video_ids: list[str] = []
    page_token = None

    while len(video_ids) < max_count:
        params = {
            "part": "id",
            "channelId": channel_id,
            "type": "video",
            "order": "date",
            "maxResults": min(50, max_count - len(video_ids)),
            "publishedAfter": published_after,
            "publishedBefore": published_before,
        }
        if page_token:
            params["pageToken"] = page_token

        data = _get(SEARCH_URL, params)
        if "error" in data:
            return {"error": data["error"]}

        for item in data.get("items", []):
            vid = item.get("id", {}).get("videoId")
            if vid:
                video_ids.append(vid)
        page_token = data.get("nextPageToken")
        if not page_token or len(video_ids) >= max_count:
            break

    if not video_ids:
        return {"items": [], "total": 0}

    # 상세 정보 (50개씩)
    items = []
    for i in range(0, len(video_ids), 50):
        batch = ",".join(video_ids[i:i + 50])
        data = _get(VIDEOS_URL, {"part": "snippet,contentDetails,statistics", "id": batch})
        if "error" in data:
            return {"error": data["error"]}
        for v in data.get("items", []):
            seconds = _parse_duration(v.get("contentDetails", {}).get("duration", ""))
            stats   = v.get("statistics", {})
            views   = int(stats.get("viewCount", 0))
            if seconds > max_seconds:
                continue
            if views < min_views:
                continue
            sn = v.get("snippet", {})
            items.append({
                "id": v["id"],
                "title": sn.get("title", ""),
                "url": f"https://www.youtube.com/shorts/{v['id']}" if seconds <= 60 else f"https://www.youtube.com/watch?v={v['id']}",
                "viewCount": views,
                "publishedAt": sn.get("publishedAt", "")[:10],
                "durationSeconds": seconds,
                "durationLabel": _fmt_duration(seconds),
                "description": sn.get("description", ""),
            })

    items.sort(key=lambda x: x["viewCount"], reverse=True)
    return {"items": items[:max_count], "total": len(items)}
