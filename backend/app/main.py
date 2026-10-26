import sys
import os
import io
import json
import uuid
import zipfile
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path

# Force UTF-8 stdout/stderr on Windows to avoid 'charmap' codec crashes
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.config import settings
from app.services.downloader import YouTubeDownloader
from app.services.transcriber import WhisperTranscriber
from app.services.hook_detector import HookDetector
from app.services.video_processor import VideoProcessor
from app.services.subtitle_burner import SubtitleBurner

app = FastAPI(title="Anti-Gravity Clipper API", version="2.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static/clips",   StaticFiles(directory=str(settings.CLIPS_DIR)),   name="clips")
app.mount("/static/renders", StaticFiles(directory=str(settings.RENDERS_DIR)), name="renders")

PROJECTS_FILE = settings.STORAGE_DIR / "projects.json"

# In-memory session store
sessions_db: Dict[str, Dict[str, Any]] = {}

def load_projects_from_disk():
    global sessions_db
    if PROJECTS_FILE.exists():
        try:
            with open(PROJECTS_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                sessions_db.update(saved)
                print(f"[Storage] Loaded {len(saved)} project(s) from disk.")
        except Exception as e:
            print(f"[Storage] Failed to read projects: {e}")

def save_projects_to_disk():
    try:
        clean = {}
        for s_id, s in sessions_db.items():
            clean[s_id] = {
                "id":             s.get("id"),
                "url":            s.get("url"),
                "status":         s.get("status"),
                "stage":          s.get("stage"),
                "progress":       s.get("progress"),
                "clips":          s.get("clips", []),
                "video_info":     s.get("video_info", {}),
                "video_analysis": s.get("video_analysis", {}),
                "transcript":     s.get("transcript", {}),
                "created_at":     s.get("created_at"),
            }
        with open(PROJECTS_FILE, "w", encoding="utf-8") as f:
            json.dump(clean, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[Storage] Failed to save projects: {e}")

# Load existing projects at startup
load_projects_from_disk()

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
    font_size:  int   = 72        # scale for 1080p canvas
    pos_x_pct:  float = 50.0
    pos_y_pct:  float = 80.0


# ── Background pipeline ───────────────────────────────────────────────────────

def background_pipeline(session_id: str, url: str):
    session = sessions_db[session_id]
    try:
        # ── Stage 1: metadata ────────────────────────────────────────────────
        session.update(status="processing", stage="Extracting video metadata...", progress=8)
        save_projects_to_disk()
        info = downloader.extract_info(url)
        session["video_info"] = info
        save_projects_to_disk()

        # ── Stage 2: transcript (instant YouTube subs -> Whisper fallback) ────
        session.update(stage="Fetching word-level transcript (instant)...", progress=20)
        save_projects_to_disk()
        transcript = downloader.get_instant_subtitles(url)

        if not transcript or len(transcript.get("words", [])) < 5:
            session.update(stage="Downloading audio for Whisper fallback...", progress=30)
            save_projects_to_disk()
            audio_path = downloader.download_audio_for_transcription(url, session_id)
            session.update(stage="Transcribing with Whisper...", progress=38)
            save_projects_to_disk()
            transcript = transcriber.transcribe_url_or_audio(url, audio_path, downloader)

        session["transcript"] = transcript
        save_projects_to_disk()

        # ── Stage 3: AI hook detection + YouTube SEO ─────────────────────────
        session.update(stage="AI analysing transcript -> detecting viral hooks...", progress=50)
        save_projects_to_disk()
        ai_result  = hook_detector.detect_hooks(transcript, target_clips_count=8)
        clips      = ai_result.get("clips", [])
        video_analysis = ai_result.get("video_analysis", {})
        session["clips"]          = clips
        session["video_analysis"] = video_analysis
        save_projects_to_disk()

        # ── Stage 4: download 1080p video ────────────────────────────────────
        session.update(stage="Downloading 1080p video for cropping...", progress=62)
        save_projects_to_disk()
        video_path = downloader.download_video(url, session_id)
        session["source_video_path"] = str(video_path)

        # ── Stage 5: 9:16 vertical crop with speaker centering ───────────────
        session.update(stage="Cropping vertical 9:16 clips with speaker centering...", progress=72)
        save_projects_to_disk()
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
            save_projects_to_disk()

        session.update(status="completed", stage="All clips ready!", progress=100)
        save_projects_to_disk()

    except Exception as e:
        import traceback
        err_msg = str(e)
        session.update(
            status="failed",
            error=err_msg,
            stage=f"Pipeline error: {err_msg}",
        )
        save_projects_to_disk()
        print(f"[Pipeline ERROR] {traceback.format_exc()}")


# ── Project Endpoints ─────────────────────────────────────────────────────────

@app.get("/api/projects")
async def list_projects():
    """Returns all past projects sorted newest first."""
    projects = []
    for s_id, s in sessions_db.items():
        v_info = s.get("video_info") or {}
        projects.append({
            "id":          s_id,
            "url":         s.get("url", ""),
            "title":       v_info.get("title") or "YouTube Video",
            "thumbnail":   v_info.get("thumbnail") or "",
            "duration":    v_info.get("duration") or 0,
            "status":      s.get("status", "queued"),
            "progress":    s.get("progress", 0),
            "clips_count": len(s.get("clips") or []),
            "created_at":  s.get("created_at") or "",
        })
    # Sort newest first
    projects.sort(key=lambda p: p.get("created_at") or "", reverse=True)
    return projects


@app.get("/api/projects/{session_id}")
async def get_project(session_id: str):
    """Retrieve full project details by ID."""
    if session_id not in sessions_db:
        raise HTTPException(404, "Project not found")
    return sessions_db[session_id]


@app.delete("/api/projects/{session_id}")
async def delete_project(session_id: str):
    """Remove a project from the projects list."""
    if session_id in sessions_db:
        del sessions_db[session_id]
        save_projects_to_disk()
    return {"message": "Project deleted"}


# ── Processing & Status Endpoints ─────────────────────────────────────────────

@app.post("/api/process")
async def start_process(req: ProcessRequest, background_tasks: BackgroundTasks):
    session_id = str(uuid.uuid4())[:8]
    now_iso = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    sessions_db[session_id] = {
        "id":             session_id,
        "url":            req.url,
        "status":         "queued",
        "stage":          "Initialising...",
        "progress":       0,
        "clips":          [],
        "video_info":     {},
        "video_analysis": {},
        "transcript":     {},
        "created_at":     now_iso,
    }
    save_projects_to_disk()
    background_tasks.add_task(background_pipeline, session_id, req.url)
    return {"session_id": session_id}


@app.get("/api/status/{session_id}")
async def get_status(session_id: str):
    if session_id not in sessions_db:
        raise HTTPException(404, "Session not found")
    return sessions_db[session_id]


# ── Render Endpoints ──────────────────────────────────────────────────────────

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
async def download_rendered_video(render_id: str):
    path = settings.RENDERS_DIR / f"final_{render_id}.mp4"
    if not path.exists():
        raise HTTPException(404, "Rendered file not found")
    return FileResponse(
        path,
        media_type="video/mp4",
        filename=f"antigravity_clip_{render_id}.mp4",
        headers={"Content-Disposition": f"attachment; filename=antigravity_clip_{render_id}.mp4"}
    )


@app.get("/api/download/clip/{session_id}/{clip_id}")
async def download_raw_clip(session_id: str, clip_id: int):
    """Direct download of the 9:16 vertical MP4 video clip."""
    clip_file = settings.CLIPS_DIR / f"clip_{session_id}_{clip_id}.mp4"
    if not clip_file.exists():
        raise HTTPException(404, "Video clip not found")
    return FileResponse(
        clip_file,
        media_type="video/mp4",
        filename=f"clip_{clip_id}.mp4",
        headers={"Content-Disposition": f"attachment; filename=clip_{clip_id}.mp4"}
    )


@app.get("/api/download/all/{session_id}")
async def download_all_clips_zip(session_id: str):
    """Downloads all generated 9:16 clips and SRT files in a single .zip archive."""
    if session_id not in sessions_db:
        raise HTTPException(404, "Session not found")
    session = sessions_db[session_id]
    clips = session.get("clips") or []
    if not clips:
        raise HTTPException(404, "No clips generated yet")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for clip in clips:
            c_id = clip["clip_id"]
            c_path = settings.CLIPS_DIR / f"clip_{session_id}_{c_id}.mp4"
            if c_path.exists():
                safe_title = "".join(c if c.isalnum() or c in " _-" else "_" for c in clip.get("viral_title", f"clip_{c_id}"))[:40]
                zf.write(c_path, arcname=f"clip_{c_id}_{safe_title}.mp4")

                # Also generate and include SRT in zip
                srt_name = f"clip_{c_id}_{safe_title}.srt"
                temp_srt = settings.RENDERS_DIR / f"temp_{session_id}_{c_id}.srt"
                subtitle_burner.build_srt_file(
                    words=session.get("transcript", {}).get("words", []),
                    clip_start=clip["start_time"],
                    clip_end=clip["end_time"],
                    output_srt_path=temp_srt,
                    rebase=True
                )
                if temp_srt.exists():
                    zf.write(temp_srt, arcname=srt_name)
                    temp_srt.unlink(missing_ok=True)

    zip_buffer.seek(0)
    title = session.get("video_info", {}).get("title", "clips")
    safe_title = "".join(c if c.isalnum() or c in " _-" else "_" for c in title)[:40]
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={safe_title}_all_clips.zip"}
    )


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
    return FileResponse(
        srt_path,
        media_type="text/plain",
        filename=f"{safe_name}_captions.srt",
        headers={"Content-Disposition": f"attachment; filename={safe_name}_captions.srt"}
    )


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
    return FileResponse(
        srt_path,
        media_type="text/plain",
        filename=f"{safe_title}.srt",
        headers={"Content-Disposition": f"attachment; filename={safe_title}.srt"}
    )
