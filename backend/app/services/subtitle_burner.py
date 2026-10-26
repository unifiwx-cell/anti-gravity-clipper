"""
subtitle_burner.py  —  Anti-Gravity Clipper
============================================
Generates ASS subtitle files using proper karaoke \\kf timing so that:

  • The 4-word phrase line stays COMPLETELY FIXED on screen (no flicker)
  • The highlight sweeps LEFT -> RIGHT word-by-word following the speech
  • Words not yet spoken appear in white (SecondaryColour / pre-fill state)
  • Words being / already spoken appear in the accent colour (PrimaryColour / post-fill state)

ASS karaoke colour mapping:
  SecondaryColour = colour BEFORE the fill reaches a syllable  (unhighlighted / white)
  PrimaryColour   = colour AFTER  the fill passes a syllable  (highlighted / amber/cyan/green)
"""

import subprocess
from pathlib import Path
from typing import List, Dict, Any

from app.config import settings


class SubtitleBurner:
    def __init__(self, renders_dir: Path = settings.RENDERS_DIR):
        self.renders_dir = renders_dir

    # ── Time formatting ───────────────────────────────────────────────────────

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

    # ── ASS builder ───────────────────────────────────────────────────────────

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
    ):
        """
        Build an ASS file with per-phrase karaoke events.

        Each 4-word phrase = ONE Dialogue line.
        {\\kf<centiseconds>} before each word sweeps the fill colour
        from SecondaryColour (white/base) -> PrimaryColour (accent/highlight).
        This means the text never re-renders between words -> zero flicker.
        """
        # ── Filter & rebase words ────────────────────────────────────────────
        clip_words: List[Dict] = []
        for w in words:
            ws, we = w.get("start", 0), w.get("end", 0)
            if we >= clip_start and ws <= clip_end:
                clip_words.append({
                    "word":  w.get("word", "").strip(),
                    "start": max(0.0, round(ws - clip_start, 3)),
                    "end":   max(0.0, round(we - clip_start, 3)),
                })
        if not clip_words:
            # Write an empty ASS so FFmpeg doesn't fail
            self._write_ass(output_ass_path, canvas_width, canvas_height,
                            "", "", "", "", "", "", "", [], "")
            return

        # ── Pixel anchor for \\pos(x,y) ──────────────────────────────────────
        pos_x = int(canvas_width  * pos_x_pct / 100.0)
        pos_y = int(canvas_height * pos_y_pct / 100.0)

        # ── Style definitions ────────────────────────────────────────────────
        #
        # KEY: In ASS karaoke —
        #   SecondaryColour = text colour BEFORE fill sweeps through  -> WHITE / BASE
        #   PrimaryColour   = text colour AFTER  fill sweeps through  -> ACCENT / HIGHLIGHT
        #
        # &HAABBGGRR  (Alpha, Blue, Green, Red — reversed from normal RGB)
        #   &H00FFFFFF& = opaque white
        #   &H0000E5FF& = opaque amber/yellow   (Hormozi accent)
        #   &H00F0FF00& = opaque neon cyan       (Glow accent)
        #   &H0000FF7F& = opaque spring green    (Typewriter accent)

        if style == "hormozi":
            font_name        = "Impact"
            secondary_color  = "&H00FFFFFF&"   # unhighlighted words = WHITE
            primary_color    = "&H0000E5FF&"   # highlighted words   = AMBER/YELLOW
            outline_color    = "&H00000000&"   # pure black outline
            back_color       = "&H88000000&"   # semi-transparent black shadow box
            bold             = "-1"
            outline_sz       = "6"
            shadow_sz        = "3"
            uppercase        = True
        elif style == "glowing":
            font_name        = "Arial Black"
            secondary_color  = "&H00DDDDDD&"   # unhighlighted = light grey
            primary_color    = "&H00F0FF00&"   # highlighted   = neon cyan
            outline_color    = "&H00AA00FF&"   # magenta outline glow
            back_color       = "&H55000000&"
            bold             = "-1"
            outline_sz       = "5"
            shadow_sz        = "4"
            uppercase        = False
        else:  # typewriter
            font_name        = "Courier New"
            secondary_color  = "&H00AAAAAA&"   # unhighlighted = grey
            primary_color    = "&H0000FF7F&"   # highlighted   = spring green
            outline_color    = "&H99000000&"
            back_color       = "&H77000000&"
            bold             = "0"
            outline_sz       = "2"
            shadow_sz        = "1"
            uppercase        = False

        # ── Build Dialogue events ────────────────────────────────────────────
        CHUNK = 4
        events: List[str] = []
        pos_tag = f"{{\\pos({pos_x},{pos_y})}}"

        for i in range(0, len(clip_words), CHUNK):
            chunk = clip_words[i : i + CHUNK]
            if not chunk:
                continue

            t0 = chunk[0]["start"]
            t1 = chunk[-1]["end"]
            if t1 <= t0:
                t1 = t0 + max(0.5, sum(
                    max(0.05, w["end"] - w["start"]) for w in chunk
                ))

            line_start = self._ass_ts(t0)
            line_end   = self._ass_ts(t1)

            # Build karaoke-tagged text
            # {\\kf<N>}WORD  — N centiseconds for this word's fill duration
            tokens: List[str] = []
            for w in chunk:
                dur_cs = max(5, int(round(max(0.05, w["end"] - w["start"]) * 100)))
                text   = w["word"].upper() if uppercase else w["word"]
                tokens.append(f"{{\\kf{dur_cs}}}{text}")

            phrase = " ".join(tokens)
            events.append(
                f"Dialogue: 0,{line_start},{line_end},Default,,0,0,0,,{pos_tag}{phrase}"
            )

        self._write_ass(
            output_ass_path, canvas_width, canvas_height,
            font_name, str(font_size),
            primary_color, secondary_color, outline_color, back_color,
            bold, outline_sz, shadow_sz,
            events,
        )

    def _write_ass(
        self,
        path: Path,
        cw: int, ch: int,
        font: str, fsize: str,
        primary: str, secondary: str, outline: str, back: str,
        bold: str, outline_sz: str, shadow_sz: str,
        events: List[str],
    ):
        header = (
            f"[Script Info]\n"
            f"ScriptType: v4.00+\n"
            f"PlayResX: {cw}\n"
            f"PlayResY: {ch}\n"
            f"ScaledBorderAndShadow: yes\n"
            f"\n"
            f"[V4+ Styles]\n"
            f"Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
            f"OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
            f"ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
            f"Alignment, MarginL, MarginR, MarginV, Encoding\n"
            f"Style: Default,"
            f"{font},{fsize},"
            f"{primary},{secondary},{outline},{back},"
            f"{bold},0,0,0,"
            f"100,100,2,0,"           # ScaleX, ScaleY, Spacing, Angle
            f"1,{outline_sz},{shadow_sz},"  # BorderStyle, Outline, Shadow
            f"5,20,20,20,1\n"         # Alignment=5 (centered), margins, encoding
            f"\n"
            f"[Events]\n"
            f"Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
        )
        with open(path, "w", encoding="utf-8") as f:
            f.write(header + "\n".join(events) + "\n")

    # ── SRT builder ───────────────────────────────────────────────────────────

    def build_srt_file(
        self,
        words: List[Dict[str, Any]],
        clip_start: float,
        clip_end: float,
        output_srt_path: Path,
        words_per_line: int = 6,
        rebase: bool = True,
    ):
        """Generate a standard .srt subtitle file."""
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

    # ── Caption burner ────────────────────────────────────────────────────────

    def burn_captions(self, clip_path: Path, ass_path: Path, render_id: str) -> Path:
        """Burn ASS captions into the video using FFmpeg."""
        output_path = self.renders_dir / f"final_{render_id}.mp4"

        # Windows path escaping for FFmpeg subtitles filter
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
            raise RuntimeError(
                f"FFmpeg subtitle burn failed:\n{result.stderr[-1000:]}"
            )
        return output_path
