# Google TTS 생성 코드 정리

ShortsHelper 프로젝트에서 Google Cloud Text-to-Speech(TTS) 생성과 관련된 코드 위치 및 파라미터 정리 문서입니다.

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `app/services/tts_service.py` | Google TTS 핵심 로직 (`get_voices_google`, `tts_google`) |
| `app/main.py` | REST API 엔드포인트 (`POST /api/tts`, `GET /api/tts/voices`) |
| `static/app.js` | 프론트엔드 TTS UI 및 `/api/tts` 호출 |
| `templates/script.html` | Google TTS 옵션 UI (Pitch 슬라이더 등) |
| `requirements.txt` | `google-cloud-texttospeech` 패키지 |

---

## 호출 흐름

```
[script.html / app.js]
  → POST /api/tts  { provider: "google", voice_id, speaking_rate, pitch, text, ... }
    → app/main.py :: api_tts()
      → pronunciation_service.apply() (발음 교정, 선택)
      → tts_service.tts_google()
        → google.cloud.texttospeech.TextToSpeechClient.synthesize_speech()
```

---

## 항목별 정리

### 1. `voice.name`

**사용 여부:** ✅ 사용

**설정 위치:** `app/services/tts_service.py` → `tts_google()`

```python
vname = voice_name or os.getenv("GOOGLE_TTS_VOICE", "ko-KR-Neural2-A")
voice = texttospeech.VoiceSelectionParams(language_code=lang_code, name=vname)
```

| 항목 | 값 |
|------|-----|
| 파라미터명 | `VoiceSelectionParams.name` |
| UI 입력 | `voice_id` (음성 선택 드롭다운 값) |
| 환경변수 fallback | `GOOGLE_TTS_VOICE` |
| 기본값 | `"ko-KR-Neural2-A"` |
| 예시 | `ko-KR-Neural2-A`, `ko-KR-Wavenet-A` 등 |

음성 목록은 `GET /api/tts/voices?provider=google` → `get_voices_google()`에서 `list_voices(language_code="ko-KR")`로 조회하며, 각 항목의 `id`와 `name` 모두 `v.name`을 사용합니다.

---

### 2. `language_code`

**사용 여부:** ✅ 사용

**설정 위치:** `app/services/tts_service.py` → `tts_google()`

```python
lang_code = "-".join(vname.split("-")[:2]) if vname else "ko-KR"
voice = texttospeech.VoiceSelectionParams(language_code=lang_code, name=vname)
```

| 항목 | 값 |
|------|-----|
| 파라미터명 | `VoiceSelectionParams.language_code` |
| 산출 방식 | `voice.name`에서 앞 2 segment 추출 |
| 예시 | `ko-KR-Neural2-A` → `ko-KR` |
| fallback | `"ko-KR"` |

음성 목록 조회(`get_voices_google`)에서는 `list_voices(language_code="ko-KR")`로 고정 필터링합니다.

---

### 3. `model`

**사용 여부:** ❌ 명시적으로 설정하지 않음

Google Cloud TTS Python SDK의 `VoiceSelectionParams`에는 ElevenLabs처럼 별도 `model` 필드를 넘기지 않습니다.

| 항목 | 설명 |
|------|------|
| 현재 구현 | `voice.name`에 모델 계열이 포함됨 (예: `Neural2`, `Wavenet`, `Standard`, `Studio`) |
| SDK 필드 | `VoiceSelectionParams`에 `model` 파라미터 없음 |
| Google API | 음성 이름으로 엔진/품질 계열이 결정됨 |

즉, 모델 선택은 **음성 이름 선택**으로 간접적으로 이루어집니다.

---

### 4. `AudioConfig`

**사용 여부:** ✅ 사용 (일부 필드만)

**설정 위치:** `app/services/tts_service.py` → `_make_audio_cfg()`

```python
def _make_audio_cfg(use_pitch: bool) -> object:
    kwargs = dict(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=speaking_rate,
    )
    if use_pitch and pitch != 0.0:
        kwargs["pitch"] = pitch
    return texttospeech.AudioConfig(**kwargs)
```

| AudioConfig 필드 | 사용 여부 | 값 |
|------------------|-----------|-----|
| `audio_encoding` | ✅ | `MP3` |
| `speaking_rate` | ✅ | UI / API 파라미터 (기본 `1.0`) |
| `pitch` | ⚠️ 조건부 | `pitch != 0.0`일 때만 포함 |
| `volume_gain_db` | ❌ | 미사용 |
| `effects_profile_id` | ❌ | 미사용 |
| `sample_rate_hertz` | ❌ | 미사용 (Google 기본값 사용) |

**Neural2 / Studio 음성 pitch 미지원 처리:**

pitch 포함 요청이 실패하고 에러 메시지에 `"pitch"`가 포함되면, pitch 없이 재시도합니다.

```python
try:
    resp = client.synthesize_speech(..., audio_config=_make_audio_cfg(use_pitch=True))
except Exception as e:
    if "pitch" in str(e).lower():
        resp = client.synthesize_speech(..., audio_config=_make_audio_cfg(use_pitch=False))
    else:
        raise
```

---

### 5. `speaking_rate`

**사용 여부:** ✅ 사용

| 계층 | 위치 | 설명 |
|------|------|------|
| 프론트엔드 | `static/app.js` → `generateTTS()` | `#tts-rate` 슬라이더 값 전송 |
| UI 범위 | `templates/script.html` | `min="0.5" max="2.0" step="0.1" value="1.0"` |
| API | `app/main.py` → `TTSBody.speaking_rate` | 기본값 `1.0` |
| 서비스 | `tts_service.tts_google()` | `AudioConfig.speaking_rate`에 전달 |

```python
# main.py
speaking_rate=body.speaking_rate or 1.0

# tts_service.py
speaking_rate: float = 1.0
kwargs["speaking_rate"] = speaking_rate
```

---

### 6. `pitch`

**사용 여부:** ⚠️ 조건부 사용

| 계층 | 위치 | 설명 |
|------|------|------|
| 프론트엔드 | `static/app.js` | Google TTS 선택 시 `#tts-pitch` 슬라이더 표시 |
| UI 범위 | `templates/script.html` | `min="-10" max="10" step="0.5" value="0"` |
| API | `app/main.py` → `TTSBody.pitch` | 기본값 `0.0` |
| 서비스 | `tts_service.tts_google()` | **`pitch != 0.0`일 때만** `AudioConfig`에 포함 |

```python
pitch: float = 0.0

if use_pitch and pitch != 0.0:
    kwargs["pitch"] = pitch
```

pitch가 `0.0`이면 AudioConfig에 아예 넣지 않습니다. Neural2/Studio 등 pitch 미지원 음성은 실패 시 pitch 없이 재시도합니다.

---

### 7. `volume_gain_db`

**사용 여부:** ❌ 미사용

코드베이스 전체에서 `volume_gain_db` 설정 없음. Google TTS API 기본 볼륨 그대로 사용.

---

### 8. `effects_profile_id`

**사용 여부:** ❌ 미사용

코드베이스 전체에서 `effects_profile_id` 설정 없음. 디바이스 프로필(예: `telephony-class-application`) 미적용.

---

### 9. SSML 사용 여부

**사용 여부:** ❌ SSML 미사용 (Plain Text)

```python
input=texttospeech.SynthesisInput(text=text)
```

| 항목 | 현재 구현 |
|------|-----------|
| 입력 방식 | `SynthesisInput(text=...)` |
| SSML | `SynthesisInput(ssml=...)` **미사용** |
| 발음 교정 | SSML이 아닌 `pronunciation_service.apply()`로 텍스트 치환 후 plain text 전달 |

발음 교정은 `app/main.py`의 `api_tts()`에서 Google/ElevenLabs 공통으로 적용됩니다.

```python
tts_text = pronunciation_service.apply(body.text) if body.use_pronunciation else body.text
```

---

### 10. Google TTS API 호출 코드

#### 10-1. 음성 목록 조회

**파일:** `app/services/tts_service.py` → `get_voices_google()`

```python
from google.cloud import texttospeech

client = texttospeech.TextToSpeechClient(transport="rest")
resp   = client.list_voices(language_code="ko-KR")

return sorted(
    [{"id": v.name, "name": v.name} for v in resp.voices],
    key=lambda x: x["name"],
)
```

**API 엔드포인트:** `GET /api/tts/voices?provider=google`

**인증:** 환경변수 `GOOGLE_APPLICATION_CREDENTIALS` (서비스 계정 JSON 경로)

---

#### 10-2. 음성 합성 (TTS 생성)

**파일:** `app/services/tts_service.py` → `tts_google()`

```python
from google.cloud import texttospeech

client = texttospeech.TextToSpeechClient(transport="rest")
vname  = voice_name or os.getenv("GOOGLE_TTS_VOICE", "ko-KR-Neural2-A")
lang_code = "-".join(vname.split("-")[:2]) if vname else "ko-KR"

voice = texttospeech.VoiceSelectionParams(
    language_code=lang_code,
    name=vname,
)

audio_config = texttospeech.AudioConfig(
    audio_encoding=texttospeech.AudioEncoding.MP3,
    speaking_rate=speaking_rate,
    # pitch는 0.0이 아닐 때만 추가
)

resp = client.synthesize_speech(
    input=texttospeech.SynthesisInput(text=text),
    voice=voice,
    audio_config=audio_config,
)

# resp.audio_content → outputs/audio/tts_YYYYMMDD_HHMMSS.mp3
```

**API 엔드포인트:** `POST /api/tts`

**요청 Body 예시 (`app/main.py` → `TTSBody`):**

```json
{
  "text": "낭독할 대본 텍스트",
  "provider": "google",
  "voice_id": "ko-KR-Neural2-A",
  "speaking_rate": 1.0,
  "pitch": 0.0,
  "use_pronunciation": true
}
```

**응답 예시:**

```json
{
  "file": "tts_20260615_143022.mp3",
  "url": "/audio/tts_20260615_143022.mp3"
}
```

---

#### 10-3. FastAPI 라우트

**파일:** `app/main.py`

```python
@app.post("/api/tts")
async def api_tts(body: TTSBody):
    env_manager.reload()
    loop = asyncio.get_event_loop()

    tts_text = pronunciation_service.apply(body.text) if body.use_pronunciation else body.text

    if body.provider == "google":
        fn = lambda: tts_service.tts_google(
            tts_text, body.voice_id,
            speaking_rate=body.speaking_rate or 1.0,
            pitch=body.pitch or 0.0,
        )
    else:
        fn = lambda: tts_service.tts_elevenlabs(...)

    return await loop.run_in_executor(None, fn)
```

---

#### 10-4. 프론트엔드 호출

**파일:** `static/app.js` → `generateTTS()`

```javascript
const data = await post('/api/tts', {
  text,
  provider:         document.getElementById('tts-provider').value,
  voice_id:         document.getElementById('tts-voice').value,
  speaking_rate:    parseFloat(document.getElementById('tts-rate').value),
  pitch:            parseFloat(document.getElementById('tts-pitch').value),
  use_pronunciation: true,
});
```

---

## 환경변수

| 변수 | 용도 |
|------|------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Google Cloud 서비스 계정 JSON 경로 (필수) |
| `GOOGLE_TTS_VOICE` | UI에서 음성 미선택 시 fallback 음성 이름 |

---

## 요약 표

| # | 항목 | 사용 | 현재 값 / 방식 |
|---|------|------|----------------|
| 1 | `voice.name` | ✅ | UI `voice_id` 또는 `GOOGLE_TTS_VOICE`, 기본 `ko-KR-Neural2-A` |
| 2 | `language_code` | ✅ | `voice.name`에서 `ko-KR` 형태로 추출 |
| 3 | `model` | ❌ | 별도 미설정, `voice.name`에 포함된 계열 사용 |
| 4 | `AudioConfig` | ✅ | `MP3` + `speaking_rate` + (조건부) `pitch` |
| 5 | `speaking_rate` | ✅ | 기본 `1.0`, UI 범위 `0.5 ~ 2.0` |
| 6 | `pitch` | ⚠️ | 기본 `0.0`, 0이 아닐 때만 전달, 미지원 음성은 재시도 |
| 7 | `volume_gain_db` | ❌ | 미사용 |
| 8 | `effects_profile_id` | ❌ | 미사용 |
| 9 | SSML | ❌ | Plain text (`SynthesisInput(text=...)`) |
| 10 | API 호출 | ✅ | `TextToSpeechClient(transport="rest").synthesize_speech()` |

---

## 참고: Transport

Google TTS 클라이언트는 **gRPC가 아닌 REST transport**를 사용합니다.

```python
texttospeech.TextToSpeechClient(transport="rest")
```

Windows SSL/truststore 이슈 회피 및 `app/main.py`의 CA 번들 설정과 맞추기 위한 선택입니다.
