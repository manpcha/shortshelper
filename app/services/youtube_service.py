"""
YouTube Data API v3 — 쇼츠 검색 서비스
조건: 영상 길이 ≤ 60초, 댓글 수 ≥ 30
"""
import os
import re
import requests
import urllib3
from datetime import datetime, timedelta, timezone

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

SEARCH_URL  = "https://www.googleapis.com/youtube/v3/search"
VIDEOS_URL  = "https://www.googleapis.com/youtube/v3/videos"
SHORTS_MAX  = 60   # seconds
MIN_COMMENTS = 30


def _published_after(period: str) -> str:
    deltas = {"오늘": 1, "7일": 7, "30일": 30, "1년": 365}
    days = deltas.get(period, 7)
    dt = datetime.now(timezone.utc) - timedelta(days=days)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_duration(iso: str) -> int:
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    if not m:
        return 0
    h, mi, s = (int(x or 0) for x in m.groups())
    return h * 3600 + mi * 60 + s


def _fmt_duration(seconds: int) -> str:
    return f"{seconds // 60}:{seconds % 60:02d}"


def search_shorts(query: str, period: str = "7일") -> dict:
    api_key = os.getenv("YOUTUBE_API_KEY", "")
    if not api_key:
        return {"error": "YouTube API 키가 설정되지 않았습니다. 설정 화면에서 키를 입력해 주세요."}

    try:
        # ① 검색
        search_resp = requests.get(
            SEARCH_URL,
            params={
                "part": "snippet",
                "q": query,
                "type": "video",
                "videoDuration": "short",
                "order": "viewCount",
                "maxResults": 25,
                "regionCode": "KR",
                "relevanceLanguage": "ko",
                "publishedAfter": _published_after(period),
                "key": api_key,
            },
            timeout=15,
            verify=False,
        )
        if not search_resp.ok:
            try:
                msg = search_resp.json().get("error", {}).get("message", search_resp.text)
            except Exception:
                msg = search_resp.text
            return {"error": f"YouTube 검색 오류 ({search_resp.status_code}): {msg}"}

        candidates = search_resp.json().get("items", [])
        if not candidates:
            return {"items": [], "filtered": {"total": 0, "shortsDuration": 0, "minComments": 0}}

        # ② 상세 정보 (duration + statistics)
        ids = ",".join(c["id"]["videoId"] for c in candidates)
        videos_resp = requests.get(
            VIDEOS_URL,
            params={"part": "contentDetails,statistics", "id": ids, "key": api_key},
            timeout=15,
            verify=False,
        )
        detail_map = {}
        if videos_resp.ok:
            for v in videos_resp.json().get("items", []):
                detail_map[v["id"]] = v

        # ③ 필터링
        items = []
        after_duration = 0
        after_comments = 0

        for c in candidates:
            vid_id = c["id"]["videoId"]
            detail = detail_map.get(vid_id)
            if not detail:
                continue

            seconds = _parse_duration(detail.get("contentDetails", {}).get("duration", ""))
            stats   = detail.get("statistics", {})
            comments = int(stats.get("commentCount", 0))
            views    = int(stats.get("viewCount", 0))

            if seconds > SHORTS_MAX:
                continue
            after_duration += 1

            if comments < MIN_COMMENTS:
                continue
            after_comments += 1

            snippet    = c["snippet"]
            thumbs     = snippet.get("thumbnails", {})
            thumb_url  = (
                thumbs.get("medium", thumbs.get("default", {})).get("url", "")
            )
            items.append({
                "id":            vid_id,
                "title":         snippet["title"],
                "channelName":   snippet["channelTitle"],
                "thumbnailUrl":  thumb_url,
                "publishedAt":   snippet["publishedAt"],
                "description":   snippet.get("description", ""),
                "durationSeconds": seconds,
                "durationLabel": _fmt_duration(seconds),
                "commentCount":  comments,
                "viewCount":     views,
            })

        return {
            "items": items,
            "filtered": {
                "total":         len(candidates),
                "shortsDuration": after_duration,
                "minComments":   after_comments,
            },
        }

    except requests.RequestException as e:
        return {"error": f"네트워크 오류: {str(e)}"}
