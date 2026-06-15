"""
TTS Service — ElevenLabs & Google Cloud Text-to-Speech

SSL 환경변수(GRPC_DEFAULT_SSL_ROOTS_FILE_PATH 등)는 app/main.py 최상단에서
모든 import 전에 설정된다. 이 파일에서 별도 설정은 불필요.
"""
import os
import re
import json
import uuid
import base64
import shutil
import subprocess
import tempfile
import requests
import urllib3
from datetime import datetime
from pathlib import Path

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

_ROOT        = Path(__file__).parent.parent.parent
AUDIO_DIR    = _ROOT / "outputs" / "audio"
PRESETS_FILE = _ROOT / "data" / "tts_presets.json"

GOOGLE_TTS_SYNTH_URL  = "https://texttospeech.googleapis.com/v1/text:synthesize"
GOOGLE_TTS_VOICES_URL = "https://texttospeech.googleapis.com/v1/voices"
DEFAULT_GOOGLE_VOICE  = "ko-KR-Chirp3-HD-Despina"
DEFAULT_GOOGLE_LANG   = "ko-KR"
TTS_CHUNK_MAX_LEN     = 80


def _ensure_audio_dir():
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)


def _ts_filename() -> str:
    return f"tts_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp3"


def _ca_path() -> str | bool:
    """
    requests verify 파라미터 값을 반환한다.
    우선순위: main.py가 생성한 통합 CA 번들 → certifi → True(시스템 기본)
    """
    v = os.getenv("REQUESTS_CA_BUNDLE") or os.getenv("SSL_CERT_FILE")
    if v and os.path.isfile(v):
        return v
    try:
        import certifi
        return certifi.where()
    except ImportError:
        return True


# ─── Voices ──────────────────────────────────────────────────────────────────

def get_voices_elevenlabs() -> list | dict:
    api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if not api_key:
        return {"error": "ELEVENLABS_API_KEY 미설정"}
    try:
        r = requests.get(
            "https://api.elevenlabs.io/v1/voices",
            headers={"xi-api-key": api_key},
            timeout=(5, 10),
            verify=_ca_path(),
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


# ─── Google TTS (REST v1 — TTS-APP과 동일 방식) ─────────────────────────────

def _google_credentials_path() -> str:
    return os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()


def _google_access_token(credentials_path: str) -> str:
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request as GoogleAuthRequest

    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    creds = service_account.Credentials.from_service_account_file(credentials_path, scopes=scopes)
    creds.refresh(GoogleAuthRequest())
    return creds.token


def _google_auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _is_chirp3_voice(voice_name: str) -> bool:
    return "Chirp3-HD" in (voice_name or "")


def _resolve_google_voice(voice_name: str) -> str:
    return (voice_name or "").strip() or os.getenv("GOOGLE_TTS_VOICE", DEFAULT_GOOGLE_VOICE).strip() or DEFAULT_GOOGLE_VOICE


def _resolve_google_language(language_code: str | None, voice_name: str) -> str:
    lang = (language_code or os.getenv("GOOGLE_TTS_LANGUAGE", DEFAULT_GOOGLE_LANG)).strip()
    if lang:
        return lang
    parts = voice_name.split("-")
    return "-".join(parts[:2]) if len(parts) >= 2 else DEFAULT_GOOGLE_LANG


# ─── TTS 입력 문장 분리 (Chirp3 간투사 감소) ─────────────────────────────────

def _clean_tts_chunk(text: str) -> str:
    """TTS 청크 정리: 중복 공백·장식 기호 제거 (낭독용)."""
    s = re.sub(r"\s+", " ", (text or "").strip())
    s = re.sub(r"^[^\w가-힣(.!?。]+", "", s)
    s = re.sub(r"[^\w가-힣.!?。]+$", "", s).strip()
    if not s or not re.search(r"[가-힣a-zA-Z0-9]", s):
        return ""
    return s


def _split_long_tts_segment(text: str, max_len: int = TTS_CHUNK_MAX_LEN) -> list[str]:
    if len(text) <= max_len:
        return [text]

    comma_parts = re.split(r"(?<=[,，;；])\s*", text)
    if len(comma_parts) == 1:
        chunks: list[str] = []
        rest = text
        while rest:
            if len(rest) <= max_len:
                chunk = _clean_tts_chunk(rest)
                if chunk:
                    chunks.append(chunk)
                break
            cut = rest.rfind(" ", 0, max_len + 1)
            if cut <= 0:
                cut = max_len
            piece = _clean_tts_chunk(rest[:cut])
            if piece:
                chunks.append(piece)
            rest = rest[cut:].strip()
        return chunks

    merged: list[str] = []
    current = ""
    for part in comma_parts:
        part = part.strip()
        if not part:
            continue
        if not current:
            candidate = part
        else:
            joiner = ", " if not current.endswith((",", "，", ";", "；")) else " "
            candidate = f"{current}{joiner}{part}"
        if len(candidate) <= max_len:
            current = candidate
            continue
        if current:
            merged.append(current)
        if len(part) > max_len:
            merged.extend(_split_long_tts_segment(part, max_len))
            current = ""
        else:
            current = part
    if current:
        merged.append(current)
    return merged


def split_tts_sentences(text: str, max_len: int = TTS_CHUNK_MAX_LEN) -> list[str]:
    """
    TTS 입력용 텍스트를 짧은 문장/구 단위로 분리.
    원본 자막/SRT는 변경하지 않음 — API 합성 직전에만 사용.
    """
    raw = (text or "").strip()
    if not raw:
        return []

    raw = re.sub(r"[ \t]+", " ", raw)
    raw = re.sub(r"\n{2,}", "\n", raw)

    parts = re.split(r"(?<=[.!?。])\s*|\n", raw)
    chunks: list[str] = []
    for part in parts:
        cleaned = _clean_tts_chunk(part)
        if not cleaned:
            continue
        chunks.extend(_split_long_tts_segment(cleaned, max_len))

    return chunks


def _ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def _merge_mp3_bytes(segments: list[bytes]) -> bytes:
    if not segments:
        raise RuntimeError("병합할 MP3 데이터가 없습니다.")
    if len(segments) == 1:
        return segments[0]
    if not _ffmpeg_available():
        raise RuntimeError(
            "ffmpeg가 설치되어 있지 않습니다. "
            "문장 단위 합성에는 ffmpeg가 필요합니다. "
            "https://ffmpeg.org 에서 설치 후 PATH에 추가하세요."
        )

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        list_lines: list[str] = []
        for i, seg_bytes in enumerate(segments):
            seg_path = tmp / f"seg_{i:04d}.mp3"
            seg_path.write_bytes(seg_bytes)
            # ffmpeg concat demuxer: Windows 경로도 슬래시로 통일
            path_str = seg_path.as_posix().replace("'", "'\\''")
            list_lines.append(f"file '{path_str}'")

        list_file = tmp / "list.txt"
        list_file.write_text("\n".join(list_lines), encoding="utf-8")
        out_path = tmp / "merged.mp3"

        cmd = [
            "ffmpeg", "-y",
            "-f", "concat", "-safe", "0",
            "-i", str(list_file),
            "-c", "copy",
            str(out_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            err = (result.stderr or result.stdout or "unknown error").strip()
            raise RuntimeError(f"MP3 병합 실패 (ffmpeg): {err[-400:]}")

        return out_path.read_bytes()


def _google_synthesize_bytes(
    text: str,
    token: str,
    vname: str,
    lang: str,
    speaking_rate: float,
    pitch: float,
) -> bytes | dict:
    """단일 텍스트 청크 → MP3 bytes. 실패 시 {"error": "..."} 반환."""

    def _payload(include_pitch: bool) -> dict:
        audio_cfg = {
            "audioEncoding": "MP3",
            "speakingRate":  speaking_rate,
        }
        if include_pitch:
            audio_cfg["pitch"] = pitch
        return {
            "input": {"text": text},
            "voice": {"languageCode": lang, "name": vname},
            "audioConfig": audio_cfg,
        }

    headers = _google_auth_headers(token)
    resp = requests.post(
        GOOGLE_TTS_SYNTH_URL,
        headers=headers,
        json=_payload(include_pitch=True),
        timeout=(10, 180),
        verify=_ca_path(),
    )
    if resp.status_code != 200 and "pitch" in resp.text.lower():
        resp = requests.post(
            GOOGLE_TTS_SYNTH_URL,
            headers=headers,
            json=_payload(include_pitch=False),
            timeout=(10, 180),
            verify=_ca_path(),
        )
    if resp.status_code != 200:
        return {"error": f"Google TTS {resp.status_code}: {resp.text[:400]}"}

    audio_b64 = resp.json().get("audioContent", "")
    if not audio_b64:
        return {"error": "Google TTS: audioContent 없음"}
    return base64.b64decode(audio_b64)


def get_voices_google() -> list | dict:
    cred_path = _google_credentials_path()
    if not cred_path:
        return {"error": "GOOGLE_APPLICATION_CREDENTIALS 미설정"}
    try:
        token = _google_access_token(cred_path)
        lang  = os.getenv("GOOGLE_TTS_LANGUAGE", DEFAULT_GOOGLE_LANG).strip()
        params = {"languageCode": lang} if lang else {}
        r = requests.get(
            GOOGLE_TTS_VOICES_URL,
            headers=_google_auth_headers(token),
            params=params,
            timeout=(5, 60),
            verify=_ca_path(),
        )
        if r.status_code != 200:
            return {"error": f"Google TTS 음성 목록 {r.status_code}: {r.text[:300]}"}

        items = []
        for v in r.json().get("voices", []):
            name = v.get("name", "")
            if not name:
                continue
            gender = (v.get("ssmlGender") or "").lower()
            label  = name.replace("ko-KR-", "")
            if _is_chirp3_voice(name):
                label = f"{label.split('-')[-1]} (Chirp3 HD{', ' + gender if gender else ''})"
            items.append({
                "id": name,
                "name": label,
                "labels": {"gender": gender} if gender else {},
            })

        def _sort_key(item: dict) -> tuple:
            n = item["id"]
            if n == DEFAULT_GOOGLE_VOICE:
                return (0, n)
            if _is_chirp3_voice(n):
                return (1, n)
            return (2, n)

        return sorted(items, key=_sort_key)
    except ImportError:
        return {"error": "google-auth 패키지가 필요합니다. pip install google-auth"}
    except Exception as e:
        return {"error": f"Google TTS 음성 목록 오류: {e}"}


def tts_google(
    text: str,
    voice_name: str,
    speaking_rate: float = 1.0,
    pitch: float         = 0.0,
    language_code: str | None = None,
    sentence_split: bool = True,
    progress_cb=None,
) -> dict:
    cred_path = _google_credentials_path()
    if not cred_path:
        return {"error": "GOOGLE_APPLICATION_CREDENTIALS 미설정"}

    vname = _resolve_google_voice(voice_name)
    lang  = _resolve_google_language(language_code, vname)

    try:
        token = _google_access_token(cred_path)

        if sentence_split:
            chunks = split_tts_sentences(text)
            if not chunks:
                return {"error": "TTS로 읽을 문장이 없습니다."}
        else:
            whole = (text or "").strip()
            if not whole:
                return {"error": "TTS로 읽을 문장이 없습니다."}
            chunks = [whole]

        total = len(chunks)
        if progress_cb:
            progress_cb(0, total, f"총 {total}문장 합성 준비...")

        if len(chunks) == 1:
            if progress_cb:
                progress_cb(0, 1, "문장 1/1 합성 중...")
            audio = _google_synthesize_bytes(chunks[0], token, vname, lang, speaking_rate, pitch)
            if isinstance(audio, dict):
                return audio
            _ensure_audio_dir()
            fname = _ts_filename()
            (AUDIO_DIR / fname).write_bytes(audio)
            if progress_cb:
                progress_cb(1, 1, "완료")
            return {"file": fname, "url": f"/audio/{fname}", "voice": vname, "chunks": 1}

        if not _ffmpeg_available():
            return {
                "error": (
                    "문장 단위 합성에 ffmpeg가 필요합니다. "
                    "ffmpeg를 설치하고 PATH에 추가한 뒤 다시 시도하세요."
                )
            }

        audio_parts: list[bytes] = []
        for i, chunk in enumerate(chunks):
            if progress_cb:
                progress_cb(i, total, f"문장 {i + 1}/{total} 합성 중...")
            result = _google_synthesize_bytes(chunk, token, vname, lang, speaking_rate, pitch)
            if isinstance(result, dict):
                return {"error": f"문장 {i + 1}/{total} 합성 실패: {result.get('error', result)}"}
            audio_parts.append(result)

        if progress_cb:
            progress_cb(total, total, "MP3 병합 중...")
        try:
            merged = _merge_mp3_bytes(audio_parts)
        except RuntimeError as e:
            return {"error": str(e)}

        _ensure_audio_dir()
        fname = _ts_filename()
        (AUDIO_DIR / fname).write_bytes(merged)
        if progress_cb:
            progress_cb(total, total, "완료")
        return {"file": fname, "url": f"/audio/{fname}", "voice": vname, "chunks": len(chunks)}
    except ImportError:
        return {"error": "google-auth 패키지가 필요합니다. pip install google-auth"}
    except Exception as e:
        return {"error": f"Google TTS 오류: {e}"}


# ─── TTS Generation ──────────────────────────────────────────────────────────

def tts_elevenlabs(
    text: str,
    voice_id: str,
    stability: float        = 0.5,
    similarity_boost: float = 0.75,
    style: float            = 0.0,
    speaker_boost: bool     = True,
    model: str              = "eleven_multilingual_v2",
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
            timeout=(5, 55),
            verify=_ca_path(),
        )
        if r.status_code != 200:
            return {"error": f"ElevenLabs API {r.status_code}: {r.text[:300]}"}

        _ensure_audio_dir()
        fname = _ts_filename()
        (AUDIO_DIR / fname).write_bytes(r.content)
        return {"file": fname, "url": f"/audio/{fname}"}
    except Exception as e:
        return {"error": f"ElevenLabs TTS 오류: {e}"}

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
