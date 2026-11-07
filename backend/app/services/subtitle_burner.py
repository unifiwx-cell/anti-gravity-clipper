"""
subtitle_burner.py — Cliphi Style Caption Engine
================================================
Generates ASS subtitle files using precision karaoke \\kf timing for viral short-form videos.

Supported Cliphi Text Styles:
  1. hormozi:    Impact ultra-bold, white base, amber/yellow highlight, thick black outline.
  2. beast:      Impact/Arial Black, white base, electric lime/green highlight, heavy stroke.
  3. glowing:    Arial Black, white base, radiant cyan highlight, neon magenta glow outline.
  4. redalert:   Impact/Arial Black, white base, punchy scarlet red highlight, bold outline.
  5. typewriter: Courier New monospace, dark translucent backing box, spring green highlight.
  6. minimal:    Inter/Montserrat modern bold sans, white base, soft champagne gold sweep.

Also supports:
  • Optional on-screen top hook banner badge (e.g. "WAIT FOR THE END 🤯")
  • Configurable chunk size (1 word punchy vs 3-4 words phrase)
"""

import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional

from app.config import settings


class SubtitleBurner:
    def __init__(self, renders_dir: Path = settings.RENDERS_DIR):
        self.renders_dir = renders_dir

    def _ass_ts(self, seconds: float) -> str:
        """Float seconds -> ASS timestamp H:MM:SS.cs"""
        seconds = max(0.0, seconds)
        h  = int(seconds // 3600)
        m  = int((seconds % 3600) // 60)
        s  = int(seconds % 60)
        cs = min(99, int(round((seconds % 1) * 100)))
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

    def _srt_ts(self, seconds: float) -> str:
        """Float seconds -> SRT timestamp HH:MM:SS,mmm"""
        seconds = max(0.0, seconds)
        h  = int(seconds // 3600)
        m  = int((seconds % 3600) // 60)
        s  = int(seconds % 60)
        ms = min(999, int(round((seconds % 1) * 1000)))
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    def build_ass_file(
        self,
        words: List[Dict[str, Any]],
        clip_start: float,
        clip_end: float,
        style: str,
        font_size: int,
        pos_x_pct: float,
        pos_y_pct: float,
        output_ass_path: Path,
        canvas_width:  int = 1080,
        canvas_height: int = 1920,
        hook_title: Optional[str] = None,
        chunk_size: int = 4,
        custom_highlight_color: Optional[str] = None,
    ):
        """
        Build an ASS file with Cliphi-styled karaoke word highlights.
        """
        # Rebase words relative to clip start
        clip_words: List[Dict] = []
        for w in words:
            ws, we = w.get("start", 0), w.get("end", 0)
            if we >= clip_start and ws <= clip_end:
                clip_words.append({
                    "word":  w.get("word", "").strip(),
                    "start": max(0.0, round(ws - clip_start, 3)),
                    "end":   max(0.0, round(we - clip_start, 3)),
                })

        # Pixel anchor for \pos(x,y)
        pos_x = int(canvas_width  * (pos_x_pct / 100.0))
        pos_y = int(canvas_height * (pos_y_pct / 100.0))

        # ── Color mappings in ASS &HAABBGGRR (Blue-Green-Red reversed) ────────
        # Hormozi:   &H0000E5FF& (Amber Yellow)
        # Beast:     &H0033FF00& (Electric Lime/Green)
        # Glowing:   &H00F0FF00& (Vibrant Cyan) with &H00AA00FF& (Neon Magenta outline)
        # Red Alert: &H002020FF& (Punchy Red)
        # Typewriter:&H0000FF7F& (Spring Green)
        # Minimal:   &H0066E0FF& (Soft Champagne Gold)

        style_lower = style.lower().strip()

        # Multi-color creator rainbow palette (Yellow, Lime Green, Cyan, Coral Pink, Amber Orange)
        # ASS hex colors are &HAABBGGRR& (Blue, Green, Red reversed)
        multicolor_palette = [
            "&H0000E5FF&",   # Vibrant Hormozi Yellow (#FFE500)
            "&H0066FF00&",   # Electric Lime Green (#00FF66)
            "&H00FFF000&",   # Luminous Cyan (#00F0FF)
            "&H006633FF&",   # Coral Neon Pink (#FF3366)
            "&H000099FF&",   # Punchy Amber Orange (#FF9900)
        ]

        if style_lower == "multicolor":
            font_name        = "Impact,Arial Black,sans-serif"
            secondary_color  = "&H00FFFFFF&"   # Unspoken: Pure White
            primary_color    = "&H0000E5FF&"
            palette          = multicolor_palette
            outline_color    = "&H00000000&"   # Deep Black
            back_color       = "&H99000000&"
            bold             = "-1"
            outline_sz       = "7"
            shadow_sz        = "4"
            uppercase        = True
        elif style_lower == "beast":
            font_name        = "Impact,Arial Black,sans-serif"
            secondary_color  = "&H00FFFFFF&"   # Unspoken: Pure White
            primary_color    = custom_highlight_color or "&H0066FF00&"   # Spoken: Electric Lime
            palette          = [primary_color]
            outline_color    = "&H00000000&"   # Deep Black
            back_color       = "&H99000000&"
            bold             = "-1"
            outline_sz       = "7"
            shadow_sz        = "4"
            uppercase        = True
        elif style_lower == "glowing":
            font_name        = "Arial Black,Impact,sans-serif"
            secondary_color  = "&H00E0E0E0&"
            primary_color    = custom_highlight_color or "&H00FFF000&"   # Neon Cyan
            palette          = ["&H00FFF000&", "&H00AA00FF&"]          # Cyan + Magenta
            outline_color    = "&H00AA00FF&"   # Neon Magenta glow
            back_color       = "&H66000000&"
            bold             = "-1"
            outline_sz       = "6"
            shadow_sz        = "5"
            uppercase        = False
        elif style_lower == "redalert":
            font_name        = "Impact,Arial Black,sans-serif"
            secondary_color  = "&H00FFFFFF&"
            primary_color    = custom_highlight_color or "&H002020FF&"   # Scarlet Red
            palette          = [primary_color]
            outline_color    = "&H00000000&"
            back_color       = "&H99000000&"
            bold             = "-1"
            outline_sz       = "6"
            shadow_sz        = "3"
            uppercase        = True
        elif style_lower == "typewriter":
            font_name        = "Courier New,monospace"
            secondary_color  = "&H00BBBBBB&"
            primary_color    = custom_highlight_color or "&H0000FF7F&"   # Spring Green
            palette          = [primary_color]
            outline_color    = "&H99000000&"
            back_color       = "&H88000000&"
            bold             = "0"
            outline_sz       = "3"
            shadow_sz        = "1"
            uppercase        = False
        elif style_lower == "minimal":
            font_name        = "Montserrat,Arial,sans-serif"
            secondary_color  = "&H00FFFFFF&"
            primary_color    = custom_highlight_color or "&H0066E0FF&"   # Champagne Gold
            palette          = [primary_color]
            outline_color    = "&H77000000&"
            back_color       = "&H44000000&"
            bold             = "-1"
            outline_sz       = "4"
            shadow_sz        = "2"
            uppercase        = False
        else: # hormozi (default)
            font_name        = "Impact,Arial Black,sans-serif"
            secondary_color  = "&H00FFFFFF&"   # Unspoken: Pure White
            primary_color    = custom_highlight_color or "&H0000E5FF&"   # Spoken: Hormozi Yellow
            palette          = [primary_color]
            outline_color    = "&H00000000&"   # Thick Black
            back_color       = "&H88000000&"
            bold             = "-1"
            outline_sz       = "7"
            shadow_sz        = "4"
            uppercase        = True

        # Header with styles: Default for captions (base unspoken color), HookBadge for top hook title
        header = (
            f"[Script Info]\n"
            f"ScriptType: v4.00+\n"
            f"PlayResX: {canvas_width}\n"
            f"PlayResY: {canvas_height}\n"
            f"ScaledBorderAndShadow: yes\n\n"
            f"[V4+ Styles]\n"
            f"Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
            f"Style: Default,{font_name},{font_size},{secondary_color},{primary_color},{outline_color},{back_color},{bold},0,0,0,100,100,2,0,1,{outline_sz},{shadow_sz},5,20,20,20,1\n"
            f"Style: HookBadge,Impact,{int(font_size * 0.75)},&H00FFFFFF&,&H00FFFFFF&,&H00000000&,&HAA000000&,-1,0,0,0,100,100,2,0,1,5,3,5,20,20,20,1\n\n"
            f"[Events]\n"
            f"Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
        )

        events: List[str] = []

        # Optional Top Hook Banner (Stays visible across whole clip duration)
        clip_dur = max(1.0, clip_end - clip_start)
        if hook_title and hook_title.strip():
            clean_hook = hook_title.strip().upper()
            h_start = self._ass_ts(0.0)
            h_end   = self._ass_ts(clip_dur)
            hook_pos = f"{{\\pos({int(canvas_width / 2)},240)}}"
            events.append(
                f"Dialogue: 1,{h_start},{h_end},HookBadge,,0,0,0,,{hook_pos}{{\\b1}}{clean_hook}"
            )

        # Build progressive combining highlight events that stay active for the entire speech duration
        effective_chunk = max(1, min(chunk_size, 6))
        chunks = [
            clip_words[i : i + effective_chunk]
            for i in range(0, len(clip_words), effective_chunk)
            if clip_words[i : i + effective_chunk]
        ]
        pos_tag = f"{{\\pos({pos_x},{pos_y})}}"

        for c_idx, chunk in enumerate(chunks):
            for w_idx, active_w in enumerate(chunk):
                w_start = active_w["start"]

                # If first chunk starts shortly after video begins, start at 0.0s for instant readability
                if c_idx == 0 and w_idx == 0 and w_start > 0.0 and w_start <= 0.6:
                    t_start = 0.0
                else:
                    t_start = w_start

                # Highlight end: seamless transition to next word or next chunk (no gaps)
                if w_idx + 1 < len(chunk):
                    t_end = max(t_start + 0.08, chunk[w_idx + 1]["start"])
                else:
                    # Last word in chunk: hold highlight seamlessly until next chunk starts
                    if c_idx + 1 < len(chunks):
                        next_chunk_start = chunks[c_idx + 1][0]["start"]
                        if next_chunk_start > t_start and (next_chunk_start - active_w["end"]) <= 1.8:
                            t_end = next_chunk_start
                        else:
                            t_end = max(t_start + 0.15, min(clip_dur, active_w["end"] + 1.2))
                    else:
                        t_end = max(t_start + 0.2, clip_dur)

                t_start_str = self._ass_ts(t_start)
                t_end_str   = self._ass_ts(t_end)

                # Format words in chunk:
                # 1. Spoken words (j < w_idx): stay in their vibrant combined color!
                # 2. Active word (j == w_idx): pops in active color + 114% scale!
                # 3. Unspoken words (j > w_idx): crisp white base
                words_fmt = []
                for j, w in enumerate(chunk):
                    word_str = w["word"].upper() if uppercase else w["word"]
                    word_color = palette[j % len(palette)]

                    if j < w_idx:
                        # Already spoken: stays highlighted in combined color
                        words_fmt.append(
                            f"{{\\c{word_color}\\fscx100\\fscy100}}{word_str}"
                        )
                    elif j == w_idx:
                        # Actively spoken right now: pops in vibrant color + scale!
                        words_fmt.append(
                            f"{{\\c{word_color}\\fscx114\\fscy114}}{word_str}"
                        )
                    else:
                        # Upcoming unspoken word: base white
                        words_fmt.append(
                            f"{{\\c{secondary_color}\\fscx100\\fscy100}}{word_str}"
                        )

                phrase = " ".join(words_fmt)
                events.append(
                    f"Dialogue: 0,{t_start_str},{t_end_str},Default,,0,0,0,,{pos_tag}{phrase}"
                )

        with open(output_ass_path, "w", encoding="utf-8") as f:
            f.write(header + "\n".join(events) + "\n")

    def build_srt_file(
        self,
        words: List[Dict[str, Any]],
        clip_start: float,
        clip_end: float,
        output_srt_path: Path,
        words_per_line: int = 6,
        rebase: bool = True,
    ):
        """Generate standard .srt subtitle file."""
        clip_words: List[Dict] = []
        for w in words:
            ws, we = w.get("start", 0), w.get("end", 0)
            if we >= clip_start and ws <= clip_end:
                offset = clip_start if rebase else 0.0
                clip_words.append({
                    "word":  w.get("word", "").strip(),
                    "start": max(0.0, ws - offset),
                    "end":   max(0.0, we - offset),
                })

        lines: List[str] = []
        idx = 1
        for i in range(0, len(clip_words), words_per_line):
            chunk = clip_words[i : i + words_per_line]
            if not chunk:
                continue
            s_ts = self._srt_ts(chunk[0]["start"])
            e_ts = self._srt_ts(chunk[-1]["end"])
            text = " ".join(w["word"] for w in chunk)
            lines.append(f"{idx}\n{s_ts} --> {e_ts}\n{text}\n")
            idx += 1

        with open(output_srt_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

    def burn_captions(self, clip_path: Path, ass_path: Path, render_id: str) -> Path:
        """Burn ASS captions onto vertical video using FFmpeg."""
        output_path = self.renders_dir / f"final_{render_id}.mp4"
        ass_str = str(ass_path).replace("\\", "/").replace(":", "\\:")

        cmd = [
            "ffmpeg", "-y",
            "-i", str(clip_path),
            "-vf", f"subtitles='{ass_str}'",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "18",
            "-c:a", "copy",
            str(output_path),
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg subtitle burn failed:\n{result.stderr[-800:]}")
        return output_path
