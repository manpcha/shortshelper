"""
영상 자막 / Whisper 추출 (벤치마킹용)
"""
import re


def get_transcript_text(video_id: str, mode: str, whisper_model: str = "tiny") -> str:
    """
    mode:
      - subtitle_first
      - subtitle_whisper
      - whisper
      - subtitle_only
      - title_only
    """
    if mode == "title_only":
        return ""

    if mode in ("subtitle_first", "subtitle_whisper", "subtitle_only"):
        text = _try_youtube_transcript(video_id)
        if text:
            return text
        if mode == "subtitle_only":
            return ""

    if mode in ("whisper", "subtitle_whisper"):
        text = _try_whisper(video_id, whisper_model)
        if text:
            return text

    return ""


def _try_youtube_transcript(video_id: str) -> str:
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        from youtube_transcript_api._errors import (
            TranscriptsDisabled, NoTranscriptFound, VideoUnavailable,
        )
    except ImportError:
        return ""

    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        transcript = None
        for lang in ("ko", "en"):
            try:
                transcript = transcript_list.find_transcript([lang])
                break
            except Exception:
                continue
        if transcript is None:
            try:
                transcript = transcript_list.find_generated_transcript(["ko", "en"])
            except Exception:
                try:
                    transcript = next(iter(transcript_list))
                except Exception:
                    return ""
        data = transcript.fetch()
        return " ".join(item.get("text", "") for item in data).strip()
    except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable):
        return ""
    except Exception:
        return ""


def _try_whisper(video_id: str, model: str) -> str:
    """Whisper fallback — faster-whisper + yt-dlp 설치 시 동작"""
    try:
        import tempfile
        import subprocess
        from pathlib import Path
    except ImportError:
        return ""

    tmp_dir = tempfile.mkdtemp(prefix="sh_whisper_")
    audio_path = Path(tmp_dir) / "audio.mp3"

    try:
        subprocess.run(
            [
                "yt-dlp", "-x", "--audio-format", "mp3",
                "-o", str(audio_path.with_suffix("")),
                f"https://www.youtube.com/watch?v={video_id}",
            ],
            capture_output=True, timeout=120, check=False,
        )
        actual = audio_path if audio_path.exists() else Path(str(audio_path.with_suffix("")) + ".mp3")
        if not actual.exists():
            return ""

        from faster_whisper import WhisperModel
        wm = WhisperModel(model, device="cpu", compute_type="int8")
        segments, _ = wm.transcribe(str(actual), language="ko")
        return " ".join(seg.text.strip() for seg in segments if seg.text).strip()
    except Exception:
        return ""
    finally:
        try:
            import shutil
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass
