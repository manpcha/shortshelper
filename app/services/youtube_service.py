"""
YouTube Data API v3 — 키워드 검색 (Insight Search 통합)
"""
import os
import re
import requests
import urllib3
from datetime import datetime, timedelta, timezone

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

SEARCH_URL   = "https://www.googleapis.com/youtube/v3/search"
VIDEOS_URL   = "https://www.googleapis.com/youtube/v3/videos"
CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels"
SHORTS_MAX   = 60
MAX_PAGES    = 4   # 50 × 4 = 200


def _published_after(period: str) -> str:
    now = datetime.now(timezone.utc)
    if period == "오늘":
        dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "어제":
        dt = now - timedelta(days=1)
    else:
        deltas = {"7일": 7, "30일": 30, "1년": 365}
        days = deltas.get(period, 7)
        dt = now - timedelta(days=days)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_duration(iso: str) -> int:
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    if not m:
        return 0
    h, mi, s = (int(x or 0) for x in m.groups())
    return h * 3600 + mi * 60 + s


def _fmt_duration(seconds: int) -> str:
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def _fetch_video_details(api_key: str, video_ids: list[str]) -> dict:
    detail_map: dict = {}
    for i in range(0, len(video_ids), 50):
        chunk = ",".join(video_ids[i:i + 50])
        resp = requests.get(
            VIDEOS_URL,
            params={
                "part": "snippet,contentDetails,statistics",
                "id": chunk,
                "key": api_key,
            },
            timeout=20,
            verify=False,
        )
        if resp.ok:
            for v in resp.json().get("items", []):
                detail_map[v["id"]] = v
    return detail_map


def _fetch_channel_subs(api_key: str, channel_ids: list[str]) -> dict:
    channel_map: dict = {}
    unique = list(set(channel_ids))
    for i in range(0, len(unique), 50):
        chunk = ",".join(unique[i:i + 50])
        resp = requests.get(
            CHANNELS_URL,
            params={"part": "statistics", "id": chunk, "key": api_key},
            timeout=20,
            verify=False,
        )
        if resp.ok:
            for c in resp.json().get("items", []):
                subs = int(c.get("statistics", {}).get("subscriberCount") or 0)
                channel_map[c["id"]] = subs if subs > 0 else 1
    return channel_map


def search_shorts(
    query: str,
    period: str = "오늘",
    duration_filter: str = "shorts",
    comment_min: int = 0,
    order: str = "relevance",
) -> dict:
    api_key = os.getenv("YOUTUBE_API_KEY", "")
    if not api_key:
        return {"error": "YouTube API 키가 설정되지 않았습니다. 설정 화면에서 키를 입력해 주세요."}

    valid_orders = {"relevance", "viewCount", "date", "rating"}
    api_order = order if order in valid_orders else "relevance"
    yt_duration_param = "short" if duration_filter == "shorts" else "any"

    try:
        candidates = []
        next_page_token = ""
        for _ in range(MAX_PAGES):
            params = {
                "part": "snippet",
                "q": query,
                "type": "video",
                "videoDuration": yt_duration_param,
                "order": api_order,
                "maxResults": 50,
                "regionCode": "KR",
                "relevanceLanguage": "ko",
                "publishedAfter": _published_after(period),
                "key": api_key,
            }
            if next_page_token:
                params["pageToken"] = next_page_token

            search_resp = requests.get(SEARCH_URL, params=params, timeout=20, verify=False)
            if not search_resp.ok:
                try:
                    msg = search_resp.json().get("error", {}).get("message", search_resp.text)
                except Exception:
                    msg = search_resp.text
                return {"error": f"YouTube 검색 오류 ({search_resp.status_code}): {msg}"}

            body = search_resp.json()
            batch = body.get("items", [])
            if not batch:
                break
            candidates.extend(batch)
            next_page_token = body.get("nextPageToken", "")
            if not next_page_token:
                break

        if not candidates:
            return {"items": [], "filtered": {"total": 0, "afterDuration": 0, "afterComments": 0}}

        video_ids = [c["id"]["videoId"] for c in candidates if c.get("id", {}).get("videoId")]
        detail_map = _fetch_video_details(api_key, video_ids)
        channel_ids = [
            c["snippet"]["channelId"]
            for c in candidates
            if c.get("snippet", {}).get("channelId")
        ]
        channel_map = _fetch_channel_subs(api_key, channel_ids)

        items = []
        after_duration = 0
        after_comments = 0

        for c in candidates:
            vid_id = c["id"]["videoId"]
            detail = detail_map.get(vid_id)
            if not detail:
                continue

            snippet = detail.get("snippet") or c.get("snippet", {})
            stats = detail.get("statistics", {})
            seconds = _parse_duration(detail.get("contentDetails", {}).get("duration", ""))
            comments = int(stats.get("commentCount") or 0)
            views = int(stats.get("viewCount") or 0)
            channel_id = snippet.get("channelId") or c.get("snippet", {}).get("channelId", "")
            sub_count = channel_map.get(channel_id, 1)
            viral_score = (views / sub_count) * 100 if sub_count else 0.0

            if duration_filter == "shorts" and seconds > SHORTS_MAX:
                continue
            after_duration += 1

            if comment_min > 0 and comments < comment_min:
                continue
            after_comments += 1

            thumbs = snippet.get("thumbnails", {})
            thumb_url = (
                thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}
            ).get("url", "")
            tags = snippet.get("tags") or []
            published_at = snippet.get("publishedAt") or c.get("snippet", {}).get("publishedAt", "")

            items.append({
                "id": vid_id,
                "title": snippet.get("title", ""),
                "channelName": snippet.get("channelTitle", ""),
                "channelId": channel_id,
                "channelTitle": snippet.get("channelTitle", ""),
                "thumbnailUrl": thumb_url,
                "publishedAt": published_at,
                "publishedDate": published_at[:10] if published_at else "",
                "description": snippet.get("description", ""),
                "durationSeconds": seconds,
                "durationLabel": _fmt_duration(seconds),
                "commentCount": comments,
                "viewCount": views,
                "subCount": sub_count,
                "viralScore": round(viral_score, 2),
                "tags": ", ".join(tags[:20]),
                "url": f"https://www.youtube.com/watch?v={vid_id}",
            })

        return {
            "items": items,
            "filtered": {
                "total": len(candidates),
                "afterDuration": after_duration,
                "afterComments": after_comments,
            },
            "filterInfo": {
                "durationFilter": duration_filter,
                "commentMin": comment_min,
                "order": api_order,
            },
        }

    except requests.RequestException as e:
        return {"error": f"네트워크 오류: {str(e)}"}
