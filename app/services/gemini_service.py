"""
Gemini API (텍스트 + Vision) 서비스
"""
import os
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

_BASE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def _call(model: str, parts: list, temperature: float = 0.75, max_tokens: int = 4096) -> dict:
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return {"error": "Gemini API 키가 설정되지 않았습니다. 설정 화면에서 키를 입력해 주세요."}

    url = _BASE.format(model=model)
    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
    }

    try:
        resp = requests.post(
            f"{url}?key={api_key}",
            json=payload,
            timeout=60,
            verify=False,
        )
    except requests.RequestException as e:
        return {"error": f"네트워크 오류: {str(e)}"}

    if not resp.ok:
        try:
            msg = resp.json().get("error", {}).get("message", resp.text)
        except Exception:
            msg = resp.text
        return {"error": f"Gemini API 오류 ({resp.status_code}): {msg}"}

    try:
        data = resp.json()
        text = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        )
        return {"text": text}
    except Exception as e:
        return {"error": f"응답 파싱 오류: {str(e)}"}


def generate_text(prompt: str, model: str = "gemini-2.0-flash") -> dict:
    return _call(model, [{"text": prompt}], temperature=0.75)


def generate_vision(frames: list[str], prompt: str, model: str = "gemini-2.0-flash") -> dict:
    if not frames:
        return {"error": "분석할 프레임이 없습니다."}

    parts: list = [{"text": prompt}]
    for frame in frames:
        parts.append({"inline_data": {"mime_type": "image/jpeg", "data": frame}})

    return _call(model, parts, temperature=0.65, max_tokens=4096)
