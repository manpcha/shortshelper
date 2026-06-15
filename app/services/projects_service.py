"""
프로젝트 / 소재 저장 — data/projects.json
"""
import json
import re
import shutil
import uuid
from datetime import datetime
from pathlib import Path

_ROOT = Path(__file__).parent.parent.parent
PROJECTS_FILE = _ROOT / "data" / "projects.json"
DEFAULT_PROJECT_ID = "default"


def _now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _mat_id() -> str:
    return f"mat_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:4]}"


def _default_data() -> dict:
    now = _now_str()
    return {
        "projects": [{
            "id": DEFAULT_PROJECT_ID,
            "name": "기본 프로젝트",
            "created_at": now,
            "updated_at": now,
            "status": "draft",
            "category": "",
            "script_content": "",
            "analysis_content": "",
            "form_data": {},
            "materials": [],
        }]
    }


def _load_raw() -> dict:
    PROJECTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not PROJECTS_FILE.exists():
        data = _default_data()
        _save_raw(data)
        return data
    try:
        with open(PROJECTS_FILE, encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict) or not isinstance(data.get("projects"), list):
            raise ValueError("invalid projects list")
        return data
    except Exception:
        if PROJECTS_FILE.exists():
            bak = PROJECTS_FILE.with_suffix(".bak.json")
            try:
                shutil.copy2(PROJECTS_FILE, bak)
            except OSError:
                pass
        data = _default_data()
        _save_raw(data)
        return data


def _save_raw(data: dict) -> None:
    try:
        PROJECTS_FILE.parent.mkdir(parents=True, exist_ok=True)
        tmp = PROJECTS_FILE.with_suffix(".tmp.json")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        tmp.replace(PROJECTS_FILE)
    except OSError as e:
        raise RuntimeError(f"프로젝트 저장 실패 (권한/경로 오류): {e}") from e


def _find_project(data: dict, project_id: str) -> dict | None:
    for p in data.get("projects", []):
        if p.get("id") == project_id:
            return p
    return None


def _normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", (name or "").strip().lower())


def _find_by_name(data: dict, name: str) -> dict | None:
    key = _normalize_name(name)
    if not key:
        return None
    for p in data.get("projects", []):
        if p.get("id") == DEFAULT_PROJECT_ID:
            continue
        if _normalize_name(p.get("name")) == key:
            return p
    return None


def _merge_project_records(base: dict, other: dict) -> dict:
    merged = dict(base)
    for field in ("script_content", "analysis_content"):
        a = (merged.get(field) or "").strip()
        b = (other.get(field) or "").strip()
        if not a and b:
            merged[field] = other[field]
        elif a and b and len(b) > len(a):
            merged[field] = other[field]
    merged["form_data"] = {
        **(base.get("form_data") or {}),
        **(other.get("form_data") or {}),
    }
    if not merged.get("category") and other.get("category"):
        merged["category"] = other["category"]
    status_rank = {"completed": 3, "active": 2, "draft": 1, "archived": 0}
    if status_rank.get(other.get("status"), 0) > status_rank.get(merged.get("status"), 0):
        merged["status"] = other["status"]
    mats = list(merged.get("materials") or [])
    seen = {m.get("id") for m in mats}
    for m in other.get("materials") or []:
        if m.get("id") not in seen:
            mats.append(m)
    merged["materials"] = mats
    return merged


def _consolidate_duplicates(store: dict) -> bool:
    projects = store.get("projects", [])
    default_projects = [p for p in projects if p.get("id") == DEFAULT_PROJECT_ID]
    grouped: dict[str, list] = {}
    for p in projects:
        if p.get("id") == DEFAULT_PROJECT_ID:
            continue
        key = _normalize_name(p.get("name"))
        if not key:
            key = f"__id__:{p.get('id')}"
        grouped.setdefault(key, []).append(p)

    changed = False
    merged_projects: list[dict] = []
    for group in grouped.values():
        if len(group) == 1:
            merged_projects.append(group[0])
            continue
        combined = group[0]
        for other in group[1:]:
            combined = _merge_project_records(combined, other)
        combined["updated_at"] = _now_str()
        merged_projects.append(combined)
        changed = True

    if not changed:
        return False

    merged_projects.sort(key=lambda p: p.get("updated_at") or "", reverse=True)
    store["projects"] = default_projects + merged_projects
    _save_raw(store)
    return True


def _ensure_default(data: dict) -> dict:
    proj = _find_project(data, DEFAULT_PROJECT_ID)
    if proj:
        return proj
    now = _now_str()
    proj = {
        "id": DEFAULT_PROJECT_ID,
        "name": "기본 프로젝트",
        "created_at": now,
        "updated_at": now,
        "status": "draft",
        "category": "",
        "script_content": "",
        "analysis_content": "",
        "form_data": {},
        "materials": [],
    }
    data.setdefault("projects", []).insert(0, proj)
    return proj


def get_all() -> dict:
    try:
        store = _load_raw()
        if _consolidate_duplicates(store):
            store = _load_raw()
        return store
    except RuntimeError as e:
        return {"error": str(e), "projects": []}


def save_project(data: dict) -> dict:
    try:
        store = _load_raw()
        projects = store.setdefault("projects", [])
        pid = (data.get("id") or "").strip()
        existing = _find_project(store, pid) if pid else None

        name = data.get("name") or "제목 없음"
        if not existing:
            by_name = _find_by_name(store, name)
            if by_name:
                existing = by_name
                pid = by_name["id"]

        if not pid:
            pid = uuid.uuid4().hex[:12]

        now = _now_str()
        script_in = data.get("script_content")
        if script_in is None:
            script_in = data.get("scriptContent")
        analysis_in = data.get("analysis_content")
        if analysis_in is None:
            analysis_in = data.get("analysisContent")
        new_form = data.get("form_data") or data.get("formData") or {}

        if existing:
            script = script_in if script_in else existing.get("script_content", "")
            analysis = analysis_in if analysis_in else existing.get("analysis_content", "")
            form_data = {**(existing.get("form_data") or {}), **new_form}
            category = data.get("category") or existing.get("category") or ""
            status = data.get("status") or existing.get("status") or "draft"
            created_at = existing.get("created_at", now)
        else:
            script = script_in or ""
            analysis = analysis_in or ""
            form_data = new_form
            category = data.get("category") or ""
            status = data.get("status") or "draft"
            created_at = now

        entry = {
            "id": pid,
            "name": name,
            "created_at": created_at,
            "updated_at": now,
            "status": status,
            "category": category,
            "script_content": script or "",
            "analysis_content": analysis or "",
            "form_data": form_data,
            "materials": existing.get("materials", []) if existing else [],
        }

        if existing:
            idx = projects.index(existing)
            projects[idx] = entry
        else:
            projects.insert(0, entry)

        _save_raw(store)
        _consolidate_duplicates(store)
        verified = _find_project(_load_raw(), pid)
        if not verified:
            return {"error": "저장 후 확인 실패 — projects.json에 반영되지 않았습니다."}
        return {"ok": True, "project": verified}
    except RuntimeError as e:
        return {"error": str(e)}


def add_material(data: dict) -> dict:
    """소재 등록 = 저장된 프로젝트에 새 항목 추가 (기본 프로젝트 버킷 사용 안 함)."""
    features = data.get("features") or []
    if isinstance(features, str):
        features = [x.strip() for x in features.split(",") if x.strip()]

    selling = data.get("selling_points") or []
    form_data = data.get("form_data") or data.get("formData") or {}
    if not isinstance(form_data, dict):
        form_data = {}

    merged_form = {
        **form_data,
        "source": data.get("source") or "unknown",
        "name": data.get("product_name") or form_data.get("name") or "",
        "features": form_data.get("features") or (
            ", ".join(features) if isinstance(features, list) else str(features or "")
        ),
        "hook": data.get("hook") or form_data.get("hook") or "",
        "cta": data.get("cta") or form_data.get("cta") or "",
        "target": form_data.get("target") or data.get("target") or "",
        "video_id": data.get("video_id") or form_data.get("video_id") or "",
        "video_url": data.get("video_url") or form_data.get("video_url") or "",
        "channel_name": data.get("channel_name") or form_data.get("channel_name") or "",
        "video_title": data.get("video_title") or form_data.get("video_title") or "",
        "selling_points": selling or form_data.get("selling_points") or [],
        "image_url": data.get("image_url") or form_data.get("image_url") or "",
    }

    name = (
        data.get("product_name")
        or merged_form.get("name")
        or data.get("video_title")
        or "소재"
    )

    store = _load_raw()
    existing = _find_by_name(store, name)
    payload = {
        "name": name,
        "category": data.get("category") or form_data.get("category") or "",
        "status": "draft",
        "analysis_content": data.get("analysis_content") or data.get("analysisContent") or "",
        "form_data": merged_form,
    }
    if existing:
        payload["id"] = existing["id"]
        if not payload["category"]:
            payload["category"] = existing.get("category") or ""
        payload["status"] = existing.get("status") or "draft"

    return save_project(payload)


def delete_project(project_id: str) -> dict:
    if project_id == DEFAULT_PROJECT_ID:
        return {"error": "기본 프로젝트는 삭제할 수 없습니다."}
    try:
        store = _load_raw()
        before = len(store.get("projects", []))
        store["projects"] = [p for p in store.get("projects", []) if p.get("id") != project_id]
        if len(store["projects"]) == before:
            return {"error": "프로젝트를 찾을 수 없습니다."}
        _save_raw(store)
        return {"ok": True}
    except RuntimeError as e:
        return {"error": str(e)}


def delete_material(project_id: str, material_id: str) -> dict:
    try:
        store = _load_raw()
        project = _find_project(store, project_id or DEFAULT_PROJECT_ID)
        if not project:
            return {"error": "프로젝트를 찾을 수 없습니다."}
        mats = project.get("materials", [])
        new_mats = [m for m in mats if m.get("id") != material_id]
        if len(new_mats) == len(mats):
            return {"error": "소재를 찾을 수 없습니다."}
        project["materials"] = new_mats
        project["updated_at"] = _now_str()
        _save_raw(store)
        return {"ok": True}
    except RuntimeError as e:
        return {"error": str(e)}


def migrate_local_projects(items: list) -> dict:
    """localStorage 형식 프로젝트 목록을 서버로 가져오기."""
    migrated = 0
    errors = []
    for item in items:
        if not isinstance(item, dict):
            continue
        result = save_project({
            "id": item.get("id"),
            "name": item.get("name"),
            "category": item.get("category"),
            "status": item.get("status"),
            "script_content": item.get("scriptContent") or item.get("script_content"),
            "analysis_content": item.get("analysisContent") or item.get("analysis_content"),
            "form_data": item.get("formData") or item.get("form_data"),
        })
        if result.get("error"):
            errors.append(result["error"])
        else:
            migrated += 1
    return {"ok": True, "migrated": migrated, "errors": errors}
