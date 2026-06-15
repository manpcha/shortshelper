"""
한국어 발음 교정 서비스

data/pronunciation_dict.json 에 정의된 규칙을 적용하여
TTS 입력용 텍스트를 발음 표기로 변환한다.
원본 텍스트(자막, 화면 출력, 대본 저장)는 변경하지 않는다.
"""
import json
import re
from pathlib import Path

_DICT_PATH = Path(__file__).parent.parent.parent / "data" / "pronunciation_dict.json"


def load_dict() -> dict[str, str]:
    """발음 교정 사전 로드. 파일이 없으면 빈 dict 반환."""
    if _DICT_PATH.exists():
        try:
            return json.loads(_DICT_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def apply(text: str) -> str:
    """
    발음 교정 사전을 적용하여 TTS 전용 텍스트를 반환한다.
    - 긴 단어 우선 치환 (부분 치환 방지)
    - 단어 경계 고려: 단어 중간에 포함된 경우도 치환 (한국어 특성상 형태소 단위)
    """
    d = load_dict()
    if not d:
        return text

    # 길이 내림차순 정렬 → 긴 패턴 먼저 치환하여 짧은 패턴이 이를 오염시키지 않도록
    for src, dst in sorted(d.items(), key=lambda x: -len(x[0])):
        text = text.replace(src, dst)

    return text


def save_entry(src: str, dst: str) -> dict:
    """발음 교정 항목 추가/수정."""
    d = load_dict()
    d[src.strip()] = dst.strip()
    _DICT_PATH.parent.mkdir(parents=True, exist_ok=True)
    _DICT_PATH.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True, "count": len(d)}


def delete_entry(src: str) -> dict:
    """발음 교정 항목 삭제."""
    d = load_dict()
    d.pop(src.strip(), None)
    _DICT_PATH.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True, "count": len(d)}


def get_all() -> list[dict]:
    """전체 사전 목록 반환 (정렬된 리스트)."""
    d = load_dict()
    return sorted(
        [{"src": k, "dst": v} for k, v in d.items()],
        key=lambda x: x["src"]
    )
