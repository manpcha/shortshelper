"""
트렌드 키워드 서비스 (Mock 데이터 + Naver DataLab 통합)
"""
import random
from .naver_service import fetch_keyword_trends

# ─── 기본 Mock 키워드 ────────────────────────────────────────────────────────
BASE_KEYWORDS: list[dict] = [
    # 생활용품
    {"keyword": "싱크대 거름망",       "category": "생활용품", "trendScore": 94, "changeRate": 187, "isHot": True,  "isNew": False, "recommendedAction": "영상 제작 강력 추천"},
    {"keyword": "이불 건조대",         "category": "생활용품", "trendScore": 82, "changeRate":  54, "isHot": False, "isNew": False, "recommendedAction": "트렌드 선점 기회"},
    {"keyword": "미끄럼방지 매트",     "category": "생활용품", "trendScore": 71, "changeRate":  12, "isHot": False, "isNew": False, "recommendedAction": "안정적 수요"},
    {"keyword": "마그네틱 모기장",     "category": "생활용품", "trendScore": 88, "changeRate": 210, "isHot": True,  "isNew": True,  "recommendedAction": "영상 제작 강력 추천"},
    # 주방용품
    {"keyword": "에어프라이어 전용 라이너", "category": "주방용품", "trendScore": 91, "changeRate": 143, "isHot": True,  "isNew": False, "recommendedAction": "영상 제작 강력 추천"},
    {"keyword": "실리콘 냄비 뚜껑 세트",   "category": "주방용품", "trendScore": 76, "changeRate":  38, "isHot": False, "isNew": False, "recommendedAction": "트렌드 선점 기회"},
    {"keyword": "보온 도시락통",            "category": "주방용품", "trendScore": 68, "changeRate":  -5, "isHot": False, "isNew": False, "recommendedAction": "안정적 수요"},
    {"keyword": "에코 실리콘 수세미",       "category": "주방용품", "trendScore": 79, "changeRate":  62, "isHot": False, "isNew": False, "recommendedAction": "트렌드 선점 기회"},
    # 인테리어
    {"keyword": "LED 간접조명 바",     "category": "인테리어", "trendScore": 85, "changeRate":  97, "isHot": True,  "isNew": False, "recommendedAction": "급상승 주시"},
    {"keyword": "패브릭 포스터",       "category": "인테리어", "trendScore": 63, "changeRate":   8, "isHot": False, "isNew": False, "recommendedAction": "안정적 수요"},
    {"keyword": "창문 자석 방충망",    "category": "인테리어", "trendScore": 87, "changeRate": 175, "isHot": True,  "isNew": True,  "recommendedAction": "영상 제작 강력 추천"},
    {"keyword": "원목 벽 수납 선반",   "category": "인테리어", "trendScore": 72, "changeRate":  23, "isHot": False, "isNew": False, "recommendedAction": "트렌드 선점 기회"},
    # 뷰티
    {"keyword": "선크림 스틱",         "category": "뷰티", "trendScore": 96, "changeRate": 132, "isHot": True,  "isNew": False, "recommendedAction": "영상 제작 강력 추천"},
    {"keyword": "더마 롤러 홈케어",    "category": "뷰티", "trendScore": 83, "changeRate":  76, "isHot": False, "isNew": False, "recommendedAction": "트렌드 선점 기회"},
    {"keyword": "쿠션 파운데이션",     "category": "뷰티", "trendScore": 74, "changeRate":  -8, "isHot": False, "isNew": False, "recommendedAction": "경쟁 심화 주의"},
    {"keyword": "페이셜 미스트 스프레이", "category": "뷰티", "trendScore": 78, "changeRate":  41, "isHot": False, "isNew": False, "recommendedAction": "트렌드 선점 기회"},
    # 건강
    {"keyword": "마그네슘 보충제",     "category": "건강", "trendScore": 89, "changeRate": 108, "isHot": True,  "isNew": False, "recommendedAction": "급상승 주시"},
    {"keyword": "종합 유산균",         "category": "건강", "trendScore": 81, "changeRate":  29, "isHot": False, "isNew": False, "recommendedAction": "안정적 수요"},
    {"keyword": "저항 밴드 세트",      "category": "건강", "trendScore": 70, "changeRate":  15, "isHot": False, "isNew": False, "recommendedAction": "안정적 수요"},
    {"keyword": "혈당 측정기",         "category": "건강", "trendScore": 75, "changeRate":  44, "isHot": False, "isNew": True,  "recommendedAction": "트렌드 선점 기회"},
    # 육아
    {"keyword": "경량 유모차",         "category": "육아", "trendScore": 87, "changeRate":  68, "isHot": False, "isNew": False, "recommendedAction": "트렌드 선점 기회"},
    {"keyword": "아기 물티슈 캡",      "category": "육아", "trendScore": 65, "changeRate":   5, "isHot": False, "isNew": False, "recommendedAction": "안정적 수요"},
    {"keyword": "이유식 냉동 용기",    "category": "육아", "trendScore": 79, "changeRate":  83, "isHot": False, "isNew": True,  "recommendedAction": "영상 제작 강력 추천"},
    {"keyword": "유아 튜브 수영 보조대", "category": "육아", "trendScore": 92, "changeRate": 230, "isHot": True,  "isNew": False, "recommendedAction": "영상 제작 강력 추천"},
    # 디지털
    {"keyword": "무선 충전 멀티 패드", "category": "디지털", "trendScore": 86, "changeRate":  91, "isHot": True,  "isNew": False, "recommendedAction": "급상승 주시"},
    {"keyword": "태블릿 거치대",       "category": "디지털", "trendScore": 73, "changeRate":  17, "isHot": False, "isNew": False, "recommendedAction": "안정적 수요"},
    {"keyword": "접이식 블루투스 키보드", "category": "디지털", "trendScore": 80, "changeRate":  55, "isHot": False, "isNew": False, "recommendedAction": "트렌드 선점 기회"},
    {"keyword": "이어폰 보관 케이스",  "category": "디지털", "trendScore": 67, "changeRate":  -3, "isHot": False, "isNew": False, "recommendedAction": "경쟁 심화 주의"},
]

_PERIOD_MULT = {"today": (1.0, 1.0), "7days": (0.88, 0.65), "30days": (0.72, 0.42)}

_mock_cache: dict = {}


def _calc_action(score: int, change_rate: int) -> str:
    if score >= 80 and change_rate >= 60:
        return "영상 제작 강력 추천"
    if change_rate >= 100:
        return "급상승 주시"
    if score >= 65 and change_rate >= 15:
        return "트렌드 선점 기회"
    if change_rate < -5:
        return "경쟁 심화 주의"
    return "안정적 수요"


def _apply_period(keywords: list[dict], period: str) -> list[dict]:
    sm, rm = _PERIOD_MULT.get(period, (1.0, 1.0))
    result = []
    for kw in keywords:
        score      = min(100, round(kw["trendScore"] * sm + random.uniform(-2, 2)))
        change_rate = round(kw["changeRate"] * rm)
        result.append({**kw, "trendScore": score, "changeRate": change_rate})
    return sorted(result, key=lambda x: -x["trendScore"])


def get_mock_keywords(period: str, category: str = "전체") -> list[dict]:
    key = f"{period}_{category}"
    if key not in _mock_cache:
        data = _apply_period(BASE_KEYWORDS, period)
        if category != "전체":
            data = [k for k in data if k["category"] == category]
        _mock_cache[key] = [dict(k, rank=i + 1) for i, k in enumerate(data)]
    return _mock_cache[key]


def get_trend_keywords(period: str, category: str = "전체") -> list[dict]:
    """Naver API 사용 가능 시 실시간 데이터, 그렇지 않으면 Mock 반환"""
    source = BASE_KEYWORDS if category == "전체" else [k for k in BASE_KEYWORDS if k["category"] == category]
    keyword_names = [k["keyword"] for k in source]

    # Naver API 시도 (5개씩 배치)
    all_scores: dict = {}
    try:
        for i in range(0, len(keyword_names), 5):
            batch = keyword_names[i : i + 5]
            result = fetch_keyword_trends(batch, period)
            if result:
                all_scores.update(result)
    except Exception:
        pass

    if not all_scores:
        return get_mock_keywords(period, category)

    merged = []
    for kw in source:
        naver = all_scores.get(kw["keyword"])
        score       = naver["score"]       if naver and naver["score"] > 0 else kw["trendScore"]
        change_rate = naver["changeRate"]  if naver and naver["score"] > 0 else kw["changeRate"]
        merged.append({
            **kw,
            "trendScore":        score,
            "changeRate":        change_rate,
            "isHot":             change_rate >= 80 or score >= 88,
            "recommendedAction": _calc_action(score, change_rate),
        })

    merged.sort(key=lambda x: -x["trendScore"])
    return [dict(k, rank=i + 1) for i, k in enumerate(merged)]
