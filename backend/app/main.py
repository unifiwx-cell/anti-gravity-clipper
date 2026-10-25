import uuid
from typing import Dict, Any
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.config import settings
from app.services.downloader import YouTubeDownloader
from app.services.transcriber import WhisperTranscriber
from app.services.hook_detector import HookDetector
from app.services.video_processor import VideoProcessor
from app.services.subtitle_burner import SubtitleBurner

app = FastAPI(title="Anti-Gravity Clipper API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static/clips",   StaticFiles(directory=str(settings.CLIPS_DIR)),   name="clips")
app.mount("/static/renders", StaticFiles(directory=str(settings.RENDERS_DIR)), name="renders")

sessions_db: Dict[str, Dict[str, Any]] = {}

downloader      = YouTubeDownloader()
transcriber     = WhisperTranscriber()
hook_detector   = HookDetector(provider="openai")
video_processor = VideoProcessor()
subtitle_burner = SubtitleBurner()


# ── Request Models ────────────────────────────────────────────────────────────

class ProcessRequest(BaseModel):
    url: str

class RenderRequest(BaseModel):
    session_id: str
    clip_id:    int
    style:      str   = "hormozi"
    font_size:  int   = 72        # larger default for 1080p canvas
    pos_x_pct:  float = 50.0
    pos_y_pct:  float = 80.0


# ── Background pipeline ───────────────────────────────────────────────────────

def background_pipeline(session_id: str, url: str):
    session = sessions_db[session_id]
    try:
        # ── Stage 1: metadata ────────────────────────────────────────────────
        session.update(status="processing", stage="Extracting video metadata…", progress=8)
        info = downloader.extract_info(url)
        session["video_info"] = info

        # ── Stage 2: transcript (instant YouTube subs → Whisper fallback) ────
        session.update(stage="Fetching word-level transcript (instant)…", progress=20)
        transcript = downloader.get_instant_subtitles(url)

        if not transcript or len(transcript.get("words", [])) < 5:
            session.update(stage="Downloading audio for Whisper transcription…", progress=30)
            audio_path = downloader.download_audio_for_transcription(url, session_id)
            session.update(stage="Transcribing with Whisper…", progress=38)
            transcript = transcriber.transcribe_url_or_audio(url, audio_path, downloader)

        session["transcript"] = transcript

        # ── Stage 3: AI hook detection + YouTube SEO ─────────────────────────
        session.update(stage="AI analysing transcript → detecting viral hooks…", progress=50)
        ai_result  = hook_detector.detect_hooks(transcript, target_clips_count=8)
        clips      = ai_result.get("clips", [])
        video_analysis = ai_result.get("video_analysis", {})
        session["clips"]          = clips
        session["video_analysis"] = video_analysis

        # ── Stage 4: download 1080p video ────────────────────────────────────
        session.update(stage="Downloading 1080p video for cropping…", progress=62)
        video_path = downloader.download_video(url, session_id)
        session["source_video_path"] = str(video_path)

        # ── Stage 5: 9:16 vertical crop with speaker centering ───────────────
        session.update(stage="Cropping vertical 9:16 clips with speaker centering…", progress=72)
        total = len(clips)
        for idx, clip in enumerate(clips):
            clip_key  = f"{session_id}_{clip['clip_id']}"
            clip_path = video_processor.extract_clip_9_16(
                source_video=video_path,
                clip_id=clip_key,
                start_time=clip["start_time"],
                end_time=clip["end_time"],
            )
            clip["video_url"] = f"/static/clips/{clip_path.name}"

            c_start = clip["start_time"]
            c_end   = clip["end_time"]
            clip["words"] = [
                {
                    "word":  w["word"],
                    "start": max(0.0, round(w["start"] - c_start, 3)),
                    "end":   max(0.0, round(w["end"]   - c_start, 3)),
                }
                for w in transcript.get("words", [])
                if w["end"] >= c_start and w["start"] <= c_end
            ]
            session["progress"] = 72 + int(((idx + 1) / total) * 26)

        session.update(status="completed", stage="All clips ready! ✓", progress=100)

    except Exception as e:
        import traceback
        session.update(
            status="failed",
            error=str(e),
            stage=f"Pipeline error: {e}",
        )
        print(f"[Pipeline ERROR] {traceback.format_exc()}")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/api/process")
async def start_process(req: ProcessRequest, background_tasks: BackgroundTasks):
    session_id = str(uuid.uuid4())[:8]
    sessions_db[session_id] = {
        "id":             session_id,
        "url":            req.url,
        "status":         "queued",
        "stage":          "Initialising…",
        "progress":       0,
        "clips":          [],
        "video_info":     {},
        "video_analysis": {},
        "transcript":     {},
    }
    background_tasks.add_task(background_pipeline, session_id, req.url)
    return {"session_id": session_id}


@app.get("/api/status/{session_id}")
async def get_status(session_id: str):
    if session_id not in sessions_db:
        raise HTTPException(404, "Session not found")
    return sessions_db[session_id]


@app.post("/api/render")
async def render_clip(req: RenderRequest):
    if req.session_id not in sessions_db:
        raise HTTPException(404, "Session not found")

    session  = sessions_db[req.session_id]
    clip     = next((c for c in session.get("clips", []) if c["clip_id"] == req.clip_id), None)
    if not clip:
        raise HTTPException(404, "Clip not found")

    clip_file = settings.CLIPS_DIR / f"clip_{req.session_id}_{req.clip_id}.mp4"
    if not clip_file.exists():
        raise HTTPException(404, f"Clip file missing: {clip_file.name}")

    render_id = f"{req.session_id}_{req.clip_id}_{uuid.uuid4().hex[:6]}"
    ass_path  = settings.RENDERS_DIR / f"{render_id}.ass"

    subtitle_burner.build_ass_file(
        words=session["transcript"]["words"],
        clip_start=clip["start_time"],
        clip_end=clip["end_time"],
        style=req.style,
        font_size=req.font_size,
        pos_x_pct=req.pos_x_pct,
        pos_y_pct=req.pos_y_pct,
        output_ass_path=ass_path,
        canvas_width=1080,
        canvas_height=1920,
    )

    final_path = subtitle_burner.burn_captions(
        clip_path=clip_file,
        ass_path=ass_path,
        render_id=render_id,
    )

    return {
        "render_id":    render_id,
        "download_url": f"/api/download/{render_id}",
        "preview_url":  f"/static/renders/{final_path.name}",
    }


@app.get("/api/download/{render_id}")
async def download_video(render_id: str):
    path = settings.RENDERS_DIR / f"final_{render_id}.mp4"
    if not path.exists():
        raise HTTPException(404, "Rendered file not found")
    return FileResponse(path, media_type="video/mp4",
                        filename=f"antigravity_clip_{render_id}.mp4")


# ── SRT / Caption export ──────────────────────────────────────────────────────

@app.get("/api/captions/{session_id}")
async def full_video_srt(session_id: str):
    """Full-video SRT for YouTube upload."""
    if session_id not in sessions_db:
        raise HTTPException(404, "Session not found")
    session    = sessions_db[session_id]
    transcript = session.get("transcript", {})
    words      = transcript.get("words", [])
    if not words:
        raise HTTPException(404, "No transcript available")

    srt_path = settings.RENDERS_DIR / f"captions_{session_id}_full.srt"
    subtitle_burner.build_srt_file(
        words=words,
        clip_start=0.0,
        clip_end=float("inf"),
        output_srt_path=srt_path,
        words_per_line=7,
        rebase=False,
    )
    title     = session.get("video_info", {}).get("title", "video")
    safe_name = "".join(c if c.isalnum() or c in " _-" else "_" for c in title)[:50]
    return FileResponse(srt_path, media_type="text/plain",
                        filename=f"{safe_name}_captions.srt")


@app.get("/api/captions/{session_id}/clip/{clip_id}")
async def clip_srt(session_id: str, clip_id: int):
    """Per-clip SRT with timestamps relative to clip start."""
    if session_id not in sessions_db:
        raise HTTPException(404, "Session not found")
    session = sessions_db[session_id]
    clip    = next((c for c in session.get("clips", []) if c["clip_id"] == clip_id), None)
    if not clip:
        raise HTTPException(404, "Clip not found")
    words = session.get("transcript", {}).get("words", [])
    if not words:
        raise HTTPException(404, "No transcript available")

    srt_path = settings.RENDERS_DIR / f"captions_{session_id}_clip{clip_id}.srt"
    subtitle_burner.build_srt_file(
        words=words,
        clip_start=clip["start_time"],
        clip_end=clip["end_time"],
        output_srt_path=srt_path,
        words_per_line=6,
        rebase=True,
    )
    safe_title = "".join(
        c if c.isalnum() or c in " _-" else "_"
        for c in clip.get("viral_title", f"clip_{clip_id}")
    )[:50]
    return FileResponse(srt_path, media_type="text/plain",
                        filename=f"{safe_title}.srt")
