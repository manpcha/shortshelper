# ShortsHelper vs TTS-APP — Google TTS 차이 및 수정 내역

## 왜 같은 음성인데 다르게 들렸나?

| 원인 | TTS-APP (기존) | ShortsHelper (수정 전) | 영향 |
|------|----------------|------------------------|------|
| **기본 fallback 음성** | `ko-KR-Chirp3-HD-Achernar` | `ko-KR-Neural2-A` | UI에서 음성 미선택 시 **구세대 Neural2**로 합성 → 로봇 같은 톤 |
| **API 호출 방식** | REST `text:synthesize` 직접 호출 | Python SDK `TextToSpeechClient` | 동일 API지만 payload/버전 차이 가능 |
| **language_code** | `google_language_code` = `ko-KR` 명시 | voice name에서 파생 | 대부분 동일하나 명시 방식 다름 |
| **pitch** | 항상 `audioConfig.pitch` 전송 (0.0 포함) | `pitch == 0.0`이면 **미전송** | 미미한 차이 |
| **발음 교정** | 없음 (원문 그대로) | `pronunciation_dict.json` 기본 ON | "좋아요→조아요" 등 치환 → Chirp3 자연스러운 억양 저해 |
| **음성 자동 선택** | 설정에 voice name 저장 | 목록 로드 후 수동 선택 필요 | Chirp3 미선택 시 fallback 발생 |

**Chirp3-HD**(`ko-KR-Chirp3-HD-Despina`)는 Google 최신 생성형 HD 음성이고, **Neural2/Wavenet**는 이전 세대라 같은 이름을 골랐다고 해도 실제로 Neural2가 쓰이면 "옛날 로봇"처럼 들립니다.

---

## 수정 내용 (ShortsHelper)

1. **TTS-APP과 동일 REST v1 호출** — `POST https://texttospeech.googleapis.com/v1/text:synthesize`
2. **기본 음성** → `ko-KR-Chirp3-HD-Despina`
3. **language_code** → `GOOGLE_TTS_LANGUAGE=ko-KR` (또는 voice와 별도 env)
4. **pitch 항상 전송** (TTS-APP과 동일 payload)
5. **Google TTS는 발음 교정 미적용** (Chirp3 원문 유지)
6. **음성 목록 로드 시 Despina 자동 선택**, Chirp3-HD 우선 정렬
7. **Google 선택 시 음성 미선택이면 MP3 생성 차단**

---

## 환경변수 (.env)

```env
GOOGLE_APPLICATION_CREDENTIALS=credentials/tts-key.json
GOOGLE_TTS_VOICE=ko-KR-Chirp3-HD-Despina
GOOGLE_TTS_LANGUAGE=ko-KR
```

---

## 의존성

```bash
pip install google-auth
```

(Google TTS는 SDK 대신 REST + `google-auth` 사용)
