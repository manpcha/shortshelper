"""
.env 파일 읽기/쓰기 관리 모듈
"""
import os
from pathlib import Path
from dotenv import load_dotenv, set_key

ENV_PATH = Path(__file__).parent.parent.parent / ".env"

KEY_MAP = {
    "geminiApiKey":      "GEMINI_API_KEY",
    "youtubeApiKey":     "YOUTUBE_API_KEY",
    "naverClientId":     "NAVER_CLIENT_ID",
    "naverClientSecret": "NAVER_CLIENT_SECRET",
}


def _ensure_env_file():
    if not ENV_PATH.exists():
        ENV_PATH.write_text(
            "GEMINI_API_KEY=\nYOUTUBE_API_KEY=\nNAVER_CLIENT_ID=\nNAVER_CLIENT_SECRET=\n",
            encoding="utf-8",
        )


def reload():
    """서버 재시작 없이 .env 즉시 반영"""
    load_dotenv(str(ENV_PATH), override=True)


def get_keys() -> dict:
    reload()
    return {k: os.getenv(env_var, "") for k, env_var in KEY_MAP.items()}


def get_status() -> dict:
    keys = get_keys()
    return {k: bool(v) for k, v in keys.items()}


def save_key(key_name: str, value: str) -> bool:
    _ensure_env_file()
    env_var = KEY_MAP.get(key_name)
    if not env_var:
        return False
    set_key(str(ENV_PATH), env_var, value)
    # Remove key from os.environ if value is empty so get_keys() picks it from file
    if not value and env_var in os.environ:
        del os.environ[env_var]
    reload()
    return True
