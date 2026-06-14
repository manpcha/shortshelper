"""
TTS Service — ElevenLabs & Google Cloud Text-to-Speech
"""
import os
import json
import uuid
import requests
from datetime import datetime
from pathlib import Path

_ROOT       = Path(__file__).parent.parent.parent
AUDIO_DIR   = _ROOT / "outputs" / "audio"
PRESETS_FILE = _ROOT / "data" / "tts_presets.json"


def _ensure_audio_dir():
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)


def _ts_filename() -> str:
    return f"tts_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp3"


# ─── Voices ──────────────────────────────────────────────────────────────────

def get_voices_elevenlabs() -> list | dict:
    api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if not api_key:
        return {"error": "ELEVENLABS_API_KEY 미설정"}
    try:
        r = requests.get(
            "https://api.elevenlabs.io/v1/voices",
            headers={"xi-api-key": api_key},
            timeout=15,
        )
        r.raise_for_status()
        voices = r.json().get("voices", [])
        return sorted(
            [{"id": v["voice_id"], "name": v["name"], "labels": v.get("labels", {})}
             for v in voices],
            key=lambda x: x["name"],
        )
    except Exception as e:
        return {"error": f"ElevenLabs 음성 목록 오류: {e}"}


def get_voices_google() -> list | dict:
    cred = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if not cred:
        return {"error": "GOOGLE_APPLICATION_CREDENTIALS 미설정"}
    try:
        from google.cloud import texttospeech  # type: ignore
        client = texttospeech.TextToSpeechClient()
        resp   = client.list_voices(language_code="ko-KR")
        return sorted(
            [{"id": v.name, "name": v.name} for v in resp.voices],
            key=lambda x: x["name"],
        )
    except ImportError:
        return {"error": "google-cloud-texttospeech 패키지가 설치되지 않았습니다."}
    except Exception as e:
        return {"error": f"Google TTS 음성 목록 오류: {e}"}


# ─── TTS Generation ──────────────────────────────────────────────────────────

def tts_elevenlabs(
    text: str,
    voice_id: str,
    stability: float      = 0.5,
    similarity_boost: float = 0.75,
    style: float          = 0.0,
    speaker_boost: bool   = True,
    model: str            = "eleven_multilingual_v2",
) -> dict:
    api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if not api_key:
        return {"error": "ELEVENLABS_API_KEY 미설정"}
    vid = voice_id or os.getenv("ELEVENLABS_VOICE_ID", "").strip()
    if not vid:
        return {"error": "음성 ID를 선택하거나 .env에 ELEVENLABS_VOICE_ID를 설정하세요."}

    try:
        r = requests.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{vid}",
            headers={"xi-api-key": api_key, "Content-Type": "application/json"},
            json={
                "text": text,
                "model_id": model,
                "voice_settings": {
                    "stability":         stability,
                    "similarity_boost":  similarity_boost,
                    "style":             style,
                    "use_speaker_boost": speaker_boost,
                },
            },
            timeout=60,
        )
        if r.status_code != 200:
            return {"error": f"ElevenLabs API {r.status_code}: {r.text[:300]}"}

        _ensure_audio_dir()
        fname = _ts_filename()
        (AUDIO_DIR / fname).write_bytes(r.content)
        return {"file": fname, "url": f"/audio/{fname}"}
    except Exception as e:
        return {"error": f"ElevenLabs TTS 오류: {e}"}


def tts_google(
    text: str,
    voice_name: str,
    speaking_rate: float = 1.0,
    pitch: float         = 0.0,
) -> dict:
    cred = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if not cred:
        return {"error": "GOOGLE_APPLICATION_CREDENTIALS 미설정"}
    try:
        from google.cloud import texttospeech  # type: ignore
        client     = texttospeech.TextToSpeechClient()
        vname      = voice_name or os.getenv("GOOGLE_TTS_VOICE", "ko-KR-Neural2-A")
        lang_code  = "-".join(vname.split("-")[:2]) if vname else "ko-KR"
        voice      = texttospeech.VoiceSelectionParams(language_code=lang_code, name=vname)
        audio_cfg  = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=speaking_rate,
            pitch=pitch,
        )
        resp = client.synthesize_speech(
            input=texttospeech.SynthesisInput(text=text),
            voice=voice,
            audio_config=audio_cfg,
        )
        _ensure_audio_dir()
        fname = _ts_filename()
        (AUDIO_DIR / fname).write_bytes(resp.audio_content)
        return {"file": fname, "url": f"/audio/{fname}"}
    except ImportError:
        return {"error": "google-cloud-texttospeech 패키지가 설치되지 않았습니다."}
    except Exception as e:
        return {"error": f"Google TTS 오류: {e}"}


# ─── Presets ─────────────────────────────────────────────────────────────────

def _load_presets() -> list:
    if PRESETS_FILE.exists():
        try:
            return json.loads(PRESETS_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return []


def _save_presets(presets: list):
    PRESETS_FILE.parent.mkdir(parents=True, exist_ok=True)
    PRESETS_FILE.write_text(json.dumps(presets, ensure_ascii=False, indent=2), encoding="utf-8")


def get_presets() -> list:
    return _load_presets()


def save_preset(preset: dict) -> dict:
    presets = _load_presets()
    if not preset.get("id"):
        preset["id"] = str(uuid.uuid4())[:8]
    for i, p in enumerate(presets):
        if p.get("id") == preset["id"]:
            presets[i] = preset
            _save_presets(presets)
            return preset
    presets.append(preset)
    _save_presets(presets)
    return preset


def delete_preset(preset_id: str) -> dict:
    presets = [p for p in _load_presets() if p.get("id") != preset_id]
    _save_presets(presets)
    return {"ok": True}
