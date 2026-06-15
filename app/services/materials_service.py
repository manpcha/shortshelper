"""
소재탐색 — 저장된 소재 DB (JSON)
"""
import json
import uuid
from datetime import datetime
from pathlib import Path

_ROOT = Path(__file__).parent.parent.parent
_MATERIALS_FILE = _ROOT / "data" / "materials.json"


def _load() -> list:
    if not _MATERIALS_FILE.exists():
        return []
    try:
        with open(_MATERIALS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _save(items: list) -> None:
    _MATERIALS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(_MATERIALS_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def get_all() -> list:
    return _load()


def add_material(data: dict) -> dict:
    items = _load()
    entry = {
        "id": uuid.uuid4().hex[:12],
        "created_at": datetime.now().isoformat(),
        "product_name": data.get("product_name", ""),
        "category": data.get("category", ""),
        "features": data.get("features", []),
        "hook": data.get("hook", ""),
        "cta": data.get("cta", ""),
        "selling_points": data.get("selling_points", []),
        "video_id": data.get("video_id", ""),
        "video_url": data.get("video_url", ""),
        "channel_name": data.get("channel_name", ""),
        "video_title": data.get("video_title", ""),
    }
    items.insert(0, entry)
    _save(items)
    return {"ok": True, "material": entry}


def delete_material(material_id: str) -> dict:
    items = _load()
    new_items = [m for m in items if m.get("id") != material_id]
    if len(new_items) == len(items):
        return {"error": "소재를 찾을 수 없습니다."}
    _save(new_items)
    return {"ok": True}
