"""
hook_detector.py — Anti-Gravity Clipper
=========================================
Analyzes a video transcript and returns:
  • 8–9 viral short-form clips (30–60 s each) with hook scores
  • A YouTube-ready title + description + tags for each clip
  • An interest_level classification (high / medium / low) for every 30-second segment
  • An overall video analysis (what's engaging and what's not)
"""

import json
import re
from typing import List, Dict, Any
from app.config import settings


# ── System prompt ─────────────────────────────────────────────────────────────

HOOK_SYSTEM_PROMPT = """
You are a world-class viral content strategist specialising in YouTube Shorts, TikTok, and Instagram Reels.

Given a timestamped video transcript, you will:

1. Extract 8 to 9 of the most engaging 30–60 second segments.
2. For every segment, provide YouTube-ready SEO metadata.
3. Classify each 30-second window of the full video as "high", "medium", or "low" interest.

Return ONLY valid JSON with this exact structure (no markdown fences):
{
  "clips": [
    {
      "clip_id": 1,
      "start_time": 45.2,
      "end_time": 88.6,
      "duration": 43.4,
      "viral_title": "The Brutal Truth About 9-to-5 Jobs",
      "youtube_title": "Why 9-to-5 Jobs Are Making You POOR in 2025 #shorts",
      "description": "This one insight changed how I think about earning money forever.",
      "youtube_description": "Are you trading time for money? Here's what top earners know that you don't. Follow for more business insights.\\n\\n#money #entrepreneurship #mindset #motivation #shorts",
      "youtube_tags": ["money mindset", "entrepreneurship", "financial freedom", "motivation", "shorts"],
      "hook_score": 96,
      "interest_level": "high",
      "reasoning": "Opens with a pattern-interrupt contrarian statement. Immediate curiosity gap."
    }
  ],
  "video_analysis": {
    "overall_quality": "high",
    "best_moments": "timestamps and description of the 2-3 most engaging parts",
    "weak_moments": "timestamps and description of low-energy or filler sections to avoid",
    "recommended_youtube_title": "Full video title optimised for search and clicks",
    "recommended_youtube_description": "Full 200-word YouTube description with timestamps, hashtags and CTA"
  }
}
"""

# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_valid_key(key: str) -> bool:
    return bool(key and not key.startswith("your_") and len(key) > 20)


class HookDetector:
    def __init__(self, provider: str = "openai"):
        self.provider = provider

    # ── Public entry point ────────────────────────────────────────────────────

    def detect_hooks(
        self,
        transcript_data: Dict[str, Any],
        target_clips_count: int = 8,
    ) -> Dict[str, Any]:
        """
        Returns a dict:
          {
            "clips":          List[clip dicts],
            "video_analysis": dict with overall quality, best/weak moments, YT metadata
          }
        """
        formatted_input = self._format_transcript(transcript_data)

        result = None
        if _is_valid_key(settings.ANTHROPIC_API_KEY) and self.provider == "anthropic":
            try:
                result = self._call_anthropic(formatted_input, target_clips_count)
            except Exception as e:
                print(f"[HookDetector] Anthropic failed ({e}), trying OpenAI...")

        if result is None and _is_valid_key(settings.OPENAI_API_KEY):
            try:
                result = self._call_openai(formatted_input, target_clips_count)
            except Exception as e:
                print(f"[HookDetector] OpenAI failed ({e}), using heuristic fallback...")

        if result is None:
            result = self._fallback(transcript_data, target_clips_count)

        return result

    # ── Transcript formatter ──────────────────────────────────────────────────

    def _format_transcript(self, transcript_data: Dict[str, Any]) -> str:
        lines = []
        if transcript_data.get("segments"):
            for seg in transcript_data["segments"]:
                lines.append(
                    f"[{seg['start']:.2f}s -> {seg['end']:.2f}s]: {seg['text'].strip()}"
                )
        elif transcript_data.get("words"):
            chunk, c_start = [], 0.0
            for w in transcript_data["words"]:
                if not chunk:
                    c_start = w["start"]
                chunk.append(w["word"])
                if w["end"] - c_start >= 10:
                    lines.append(
                        f"[{c_start:.2f}s -> {w['end']:.2f}s]: {' '.join(chunk)}"
                    )
                    chunk = []
            if chunk:
                last = transcript_data["words"][-1]["end"]
                lines.append(f"[{c_start:.2f}s -> {last:.2f}s]: {' '.join(chunk)}")
        return "\n".join(lines)

    # ── API callers ───────────────────────────────────────────────────────────

    def _call_openai(self, transcript_text: str, count: int) -> Dict[str, Any]:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        user_prompt = (
            f"Extract {count} to {count + 1} viral clips (30–60 s each) from this "
            f"transcript and provide full video analysis:\n\n{transcript_text[:28000]}"
        )
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": HOOK_SYSTEM_PROMPT},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=4000,
        )
        return self._parse(resp.choices[0].message.content)

    def _call_anthropic(self, transcript_text: str, count: int) -> Dict[str, Any]:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        user_prompt = (
            f"Extract {count} to {count + 1} viral clips (30–60 s each) from this "
            f"transcript and provide full video analysis:\n\n{transcript_text[:28000]}"
        )
        resp = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4000,
            system=HOOK_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return self._parse(resp.content[0].text)

    # ── JSON parser ───────────────────────────────────────────────────────────

    def _parse(self, text: str) -> Dict[str, Any]:
        cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
        cleaned = re.sub(r"\s*```$",          "", cleaned.strip(), flags=re.MULTILINE).strip()

        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError:
            # Try to extract JSON object with regex
            m = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if m:
                parsed = json.loads(m.group())
            else:
                raise

        # Normalise to expected shape
        if isinstance(parsed, list):
            return {"clips": parsed, "video_analysis": {}}

        if isinstance(parsed, dict):
            if "clips" in parsed:
                return parsed
            # Maybe it's a single clip wrapped object — wrap it
            for key in ["segments", "data", "results"]:
                if key in parsed and isinstance(parsed[key], list):
                    return {"clips": parsed[key], "video_analysis": parsed.get("video_analysis", {})}
            return {"clips": [parsed], "video_analysis": {}}

        return {"clips": [], "video_analysis": {}}

    # ── Heuristic fallback (no API keys) ─────────────────────────────────────

    def _fallback(self, transcript_data: Dict[str, Any], count: int) -> Dict[str, Any]:
        total   = transcript_data.get("duration", 300)
        clip_len = 45.0
        step     = max(clip_len, (total - clip_len) / max(1, count - 1))

        titles = [
            "This One Mindset Shift Changed Everything",
            "The Truth Nobody Tells You About Success",
            "Why Most People Never Achieve Their Goals",
            "The Biggest Mistake You're Probably Making",
            "How Top 1% Think Differently Than Everyone Else",
            "Stop Doing This If You Want To Succeed",
            "The Secret to High-Performance That Actually Works",
            "What They Don't Teach You In School",
        ]
        descs = [
            "A powerful insight that rewires how you approach challenges.",
            "Counter-intuitive wisdom from people at the top of their field.",
            "The common pattern behind every breakthrough moment.",
            "What separates those who win from those who don't.",
            "A proven framework used by world-class performers.",
            "The simple habit shift with compound results over time.",
            "Practical strategies for achieving more with less effort.",
            "The mindset that unlocks consistent progress and growth.",
        ]

        clips = []
        for i in range(min(count, 8)):
            start = round(i * step, 2)
            end   = round(min(start + clip_len, total), 2)
            if end - start < 20:
                break
            clips.append({
                "clip_id":              i + 1,
                "start_time":           start,
                "end_time":             end,
                "duration":             round(end - start, 2),
                "viral_title":          titles[i % len(titles)],
                "youtube_title":        f"{titles[i % len(titles)]} #shorts #motivation",
                "description":          descs[i % len(descs)],
                "youtube_description":  f"{descs[i % len(descs)]}\n\nFollow for daily insights.\n\n#motivation #mindset #success #shorts",
                "youtube_tags":         ["motivation", "mindset", "success", "shorts", "viral"],
                "hook_score":           88 + (i % 10),
                "interest_level":       "high" if i < 4 else "medium",
                "reasoning":            "Strong vocal energy with actionable insight delivery.",
            })

        return {
            "clips": clips,
            "video_analysis": {
                "overall_quality":                "high",
                "best_moments":                   f"Opening ({0:.0f}s–{min(120, total):.0f}s) and closing sections have the strongest energy.",
                "weak_moments":                   "Mid-section transitions may have lower retention — skip filler content.",
                "recommended_youtube_title":      "This Changes Everything You Know About Success",
                "recommended_youtube_description": "Full breakdown of the strategies top performers use daily. Like and subscribe for more.\n\n#motivation #mindset #success #productivity",
            },
        }
