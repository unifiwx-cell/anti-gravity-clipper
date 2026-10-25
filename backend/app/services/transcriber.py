import os
from pathlib import Path
from typing import List, Dict, Any
from openai import OpenAI
from app.config import settings

def is_valid_api_key(key: str) -> bool:
    return bool(key and not key.startswith("your_") and len(key) > 20)

class WhisperTranscriber:
    def __init__(self, api_key: str = None):
        raw_key = api_key or settings.OPENAI_API_KEY
        if is_valid_api_key(raw_key):
            self.api_key = raw_key
            self.client = OpenAI(api_key=self.api_key)
        else:
            self.api_key = None
            self.client = None

    def transcribe(self, audio_path: Path) -> Dict[str, Any]:
        """
        Transcribe audio file into text with word-level timestamps.
        Returns a dict containing full text and a list of words with start/end times.
        """
        if self.client:
            try:
                return self._transcribe_with_api(audio_path)
            except Exception as e:
                # If API key is rejected or expired, fall back to local transcription
                print(f"[Whisper] API error ({e}), falling back to local transcription...")
                return self._transcribe_with_local(audio_path)
        else:
            return self._transcribe_with_local(audio_path)

    def _transcribe_with_api(self, audio_path: Path) -> Dict[str, Any]:
        """Transcribe using OpenAI Whisper API with timestamp_granularities=['word']."""
        with open(audio_path, "rb") as audio_file:
            transcript = self.client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                timestamp_granularities=["word", "segment"]
            )
            
        data = transcript.model_dump() if hasattr(transcript, "model_dump") else dict(transcript)
        
        words = []
        for w in data.get("words", []):
            words.append({
                "word": w.get("word", "").strip(),
                "start": round(float(w.get("start", 0)), 3),
                "end": round(float(w.get("end", 0)), 3),
            })
            
        return {
            "text": data.get("text", ""),
            "language": data.get("language", "en"),
            "duration": data.get("duration", 0),
            "words": words,
            "segments": data.get("segments", [])
        }

    def transcribe_url_or_audio(self, url: str, audio_path: Path, downloader) -> Dict[str, Any]:
        """
        Ultra-fast transcription pipeline:
        1. Instant YouTube Subtitles API (1-2 seconds, zero CPU load)
        2. OpenAI Whisper API (if API key is valid)
        3. Local faster-whisper tiny.en model (optimized for fast CPU execution)
        """
        # Step 1: Instant YouTube subtitle extraction
        print(f"[Transcriber] Checking for instant YouTube word-level subtitles...")
        instant_subs = downloader.get_instant_subtitles(url)
        if instant_subs and len(instant_subs.get("words", [])) > 10:
            print(f"[Transcriber] Extracted {len(instant_subs['words'])} words from YouTube native stream in ~1s!")
            return instant_subs

        # Step 2: OpenAI Whisper API
        if self.client:
            try:
                print(f"[Transcriber] Using OpenAI Whisper API...")
                return self._transcribe_with_api(audio_path)
            except Exception as e:
                print(f"[Whisper] API error ({e}), falling back to local model...")

        # Step 3: Local faster-whisper fallback
        return self._transcribe_with_local(audio_path)

    def _transcribe_with_local(self, audio_path: Path) -> Dict[str, Any]:
        """
        Ultra-fast local fallback using faster_whisper 'tiny.en' (39MB) with int8 quantization.
        """
        try:
            from faster_whisper import WhisperModel
            print("[Whisper] Loading ultra-fast tiny.en model for CPU...")
            model = WhisperModel("tiny.en", device="cpu", compute_type="int8", cpu_threads=4)
            segments, info = model.transcribe(str(audio_path), word_timestamps=True, beam_size=1)
            
            words = []
            segment_list = []
            full_text = []
            
            for seg in segments:
                full_text.append(seg.text)
                segment_list.append({
                    "start": round(seg.start, 2),
                    "end": round(seg.end, 2),
                    "text": seg.text
                })
                if seg.words:
                    for w in seg.words:
                        words.append({
                            "word": w.word.strip(),
                            "start": round(w.start, 3),
                            "end": round(w.end, 3),
                        })
                        
            return {
                "text": " ".join(full_text),
                "language": info.language,
                "duration": info.duration,
                "words": words,
                "segments": segment_list
            }
        except Exception as e:
            raise RuntimeError(f"Local transcription failed: {e}")
