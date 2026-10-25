import os
import yt_dlp
from pathlib import Path
from app.config import settings


class YouTubeDownloader:
    def __init__(self, output_dir: Path = settings.DOWNLOADS_DIR):
        self.output_dir = output_dir

    def extract_info(self, url: str) -> dict:
        """Extract video metadata without downloading."""
        with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True}) as ydl:
            info = ydl.extract_info(url, download=False)
            return {
                "id":        info.get("id"),
                "title":     info.get("title"),
                "duration":  info.get("duration"),
                "thumbnail": info.get("thumbnail"),
                "uploader":  info.get("uploader"),
                "view_count": info.get("view_count"),
                "description": info.get("description", "")[:500],
            }

    def get_instant_subtitles(self, url: str) -> dict:
        """
        Pull YouTube's word-level JSON3 subtitle stream.
        Takes ~1-2 seconds for any video length — no audio download needed.
        Falls back gracefully if the video has no auto-captions.
        """
        import json
        import urllib.request

        ydl_opts = {
            "skip_download":      True,
            "writesubtitles":     True,
            "writeautomaticsub":  True,
            "subtitleslangs":     ["en", "en-US", "en-GB"],
            "subtitlesformat":    "json3",
            "quiet":              True,
            "no_warnings":        True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info      = ydl.extract_info(url, download=False)
                duration  = info.get("duration", 0)
                subs      = info.get("subtitles", {}) or {}
                auto_subs = info.get("automatic_captions", {}) or {}

                target_sub = None
                for lang in ["en", "en-US", "en-GB"]:
                    for s in subs.get(lang, []) + auto_subs.get(lang, []):
                        if s.get("ext") == "json3":
                            target_sub = s
                            break
                    if target_sub:
                        break

                if not target_sub:
                    return None

                req  = urllib.request.urlopen(target_sub["url"], timeout=15)
                data = json.loads(req.read().decode("utf-8"))

                words, segments, full_text = [], [], []

                for event in data.get("events", []):
                    ev_start = event.get("tStartMs", 0) / 1000.0
                    ev_dur   = event.get("dDurationMs", 500) / 1000.0
                    ev_end   = round(ev_start + ev_dur, 3)

                    segs = event.get("segs", [])
                    seg_words = []

                    for i, s in enumerate(segs):
                        w_text = s.get("utf8", "").replace("\u200b", "").strip()
                        if not w_text or w_text in ("\n", " "):
                            continue

                        w_offset = s.get("tOffsetMs", 0) / 1000.0
                        w_start  = round(ev_start + w_offset, 3)

                        # Word end = next word's start OR event end — whichever is sooner
                        if i + 1 < len(segs):
                            next_offset = segs[i + 1].get("tOffsetMs", 0) / 1000.0
                            w_end = round(ev_start + next_offset, 3)
                        else:
                            w_end = ev_end

                        w_end = max(w_start + 0.05, min(w_end, ev_end))

                        words.append({"word": w_text, "start": w_start, "end": w_end})
                        seg_words.append(w_text)

                    if seg_words:
                        joined = " ".join(seg_words)
                        full_text.append(joined)
                        segments.append({"start": ev_start, "end": ev_end, "text": joined})

                return {
                    "text":     " ".join(full_text),
                    "duration": duration,
                    "words":    words,
                    "segments": segments,
                    "source":   "youtube_instant_subtitles",
                }

        except Exception as e:
            print(f"[Downloader] Instant subtitles error: {e}")
            return None

    def download_audio_for_transcription(self, url: str, session_id: str) -> Path:
        """Download 16kHz mono WAV for Whisper fallback transcription."""
        output_template = str(self.output_dir / f"{session_id}_audio.%(ext)s")
        target_path     = self.output_dir / f"{session_id}_audio.wav"

        ydl_opts = {
            "format": "bestaudio[ext=m4a]/bestaudio/best",
            "outtmpl": output_template,
            "postprocessors": [{
                "key":              "FFmpegExtractAudio",
                "preferredcodec":   "wav",
                "preferredquality": "192",
            }],
            "postprocessor_args": ["-ar", "16000", "-ac", "1"],
            "quiet":       True,
            "no_warnings": True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        if not target_path.exists():
            matches = list(self.output_dir.glob(f"{session_id}_audio.*"))
            if matches:
                return matches[0]
            raise FileNotFoundError(f"Audio download failed for session {session_id}")
        return target_path

    def download_video(self, url: str, session_id: str) -> Path:
        """
        Download best available video up to 1080p (or 4K if available).
        Prefers mp4 container for direct compatibility with FFmpeg cropping.
        """
        output_template = str(self.output_dir / f"{session_id}_full.%(ext)s")
        target_path     = self.output_dir / f"{session_id}_full.mp4"

        ydl_opts = {
            # Try 1080p first, then 4K, then best available
            "format": (
                "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]"
                "/bestvideo[height<=1080]+bestaudio"
                "/bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]"
                "/bestvideo[height<=2160]+bestaudio"
                "/best[ext=mp4]/best"
            ),
            "outtmpl":              output_template,
            "merge_output_format":  "mp4",
            "quiet":                True,
            "no_warnings":          True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        if not target_path.exists():
            matches = list(self.output_dir.glob(f"{session_id}_full.*"))
            if matches:
                return matches[0]
            raise FileNotFoundError(f"Video download failed for session {session_id}")
        return target_path
