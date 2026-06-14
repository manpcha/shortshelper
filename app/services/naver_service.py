"""
Naver DataLab Shopping Insight API 서비스
"""
import os
import requests
import urllib3
from datetime import datetime, timedelta

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

NAVER_URL = "https://openapi.naver.com/v1/datalab/shopping/category/keywords"


def _date_range(period: str) -> dict:
    today = datetime.today()
    if period == "today":
        start, unit = today - timedelta(days=7), "date"
    elif period == "7days":
        start, unit = today - timedelta(days=14), "date"
    else:  # 30days
        start, unit = today - timedelta(days=60), "week"
    return {
        "startDate": start.strftime("%Y-%m-%d"),
        "endDate":   today.strftime("%Y-%m-%d"),
        "timeUnit":  unit,
    }


def fetch_keyword_trends(keywords: list[str], period: str) -> dict | None:
    """
    Naver DataLab API로 키워드 트렌드 조회.
    키가 없거나 오류 시 None 반환 (호출자가 mock으로 fallback).
    """
    client_id     = os.getenv("NAVER_CLIENT_ID", "")
    client_secret = os.getenv("NAVER_CLIENT_SECRET", "")

    if not client_id or not client_secret:
        return None

    date_range = _date_range(period)
    payload = {
        **date_range,
        "category": "50000000",
        "keyword": [{"name": k, "param": [k]} for k in keywords],
        "device": "",
        "gender": "",
        "ages": [],
    }

    try:
        resp = requests.post(
            NAVER_URL,
            json=payload,
            headers={
                "X-Naver-Client-Id":     client_id,
                "X-Naver-Client-Secret": client_secret,
                "Content-Type":          "application/json",
            },
            timeout=15,
            verify=False,
        )
        if not resp.ok:
            return None

        results: dict[str, dict] = {}
        for item in resp.json().get("results", []):
            pts = item.get("data", [])
            if not pts:
                results[item["title"]] = {"score": 0, "changeRate": 0}
                continue
            latest = pts[-1]["ratio"]
            first  = pts[0]["ratio"]
            score      = min(100, round(latest))
            change_rate = round(((latest - first) / first) * 100) if first > 0 else 0
            results[item["title"]] = {"score": score, "changeRate": change_rate}
        return results

    except Exception:
        return None
