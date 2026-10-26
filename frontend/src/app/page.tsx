"use client";

import React, { useState, useEffect, useCallback } from "react";
import { UrlInput }      from "../components/UrlInput";
import { ClipCard }      from "../components/ClipCard";
import { CaptionEditor } from "../components/CaptionEditor";
import { Clip, SessionStatus, VideoAnalysis, ProjectSummary } from "../types";
import {
  Sparkles, Flame, Wand2, ArrowLeft, FileText,
  TrendingUp, TrendingDown, CheckCircle2, AlertCircle,
  Youtube, BarChart3, Copy, Check, FolderOpen,
  Archive, Download, Plus, Trash2, Clock, Video,
} from "lucide-react";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STAGES = [
  { key: "metadata",    label: "Metadata",     range: [0,  15] },
  { key: "transcript",  label: "Transcript",   range: [15, 50] },
  { key: "ai",          label: "AI Analysis",  range: [50, 70] },
  { key: "download",    label: "Downloading",  range: [70, 78] },
  { key: "crop",        label: "Cropping",     range: [78, 100] },
];

function stageIndex(progress: number) {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (progress >= STAGES[i].range[0]) return i;
  }
  return 0;
}

// ── Video Analysis Panel ──────────────────────────────────────────────────────
const VideoAnalysisPanel: React.FC<{ analysis: VideoAnalysis; sessionId: string }> = ({
  analysis, sessionId,
}) => {
  const [copied, setCopied] = useState(false);
  if (!analysis || !Object.keys(analysis).length) return null;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass fade-up p-6 space-y-5 mb-10">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-400" />
          Full Video Analysis
        </h3>
        <div className="flex items-center gap-2">
          <a
            href={`${API}/api/captions/${sessionId}`}
            download
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-emerald-700/40 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-900/30 transition font-semibold"
          >
            <FileText className="w-3.5 h-3.5" />
            Full SRT
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {analysis.best_moments && (
          <div className="rounded-xl p-4 bg-emerald-950/20 border border-emerald-800/30">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> High Engagement Highlights
            </p>
            <p className="text-sm text-neutral-300 leading-relaxed">{analysis.best_moments}</p>
          </div>
        )}
        {analysis.weak_moments && (
          <div className="rounded-xl p-4 bg-red-950/20 border border-red-800/30">
            <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5" /> Low Retention / Filler Sections
            </p>
            <p className="text-sm text-neutral-300 leading-relaxed">{analysis.weak_moments}</p>
          </div>
        )}
      </div>

      {analysis.recommended_youtube_title && (
        <div className="rounded-xl p-4 bg-red-950/20 border border-red-800/30 space-y-3">
          <p className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
            <Youtube className="w-3.5 h-3.5" /> Recommended YouTube Upload Title &amp; Description
          </p>
          <div>
            <p className="text-[11px] text-neutral-500 mb-1 font-medium">Suggested Title</p>
            <p className="text-sm text-white font-semibold">{analysis.recommended_youtube_title}</p>
          </div>
          {analysis.recommended_youtube_description && (
            <div>
              <p className="text-[11px] text-neutral-500 mb-1 font-medium">Suggested Description</p>
              <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-line line-clamp-4">
                {analysis.recommended_youtube_description}
              </p>
              <button
                onClick={() => copy(
                  `${analysis.recommended_youtube_title}\n\n${analysis.recommended_youtube_description}`
                )}
                className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500 hover:text-emerald-400 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied to clipboard!" : "Copy Title & Description"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [sessionId,       setSessionId]       = useState<string | null>(null);
  const [status,          setStatus]          = useState<SessionStatus | null>(null);
  const [isSubmitting,    setIsSubmitting]    = useState(false);
  const [selectedClip,    setSelectedClip]    = useState<Clip | null>(null);
  const [projects,        setProjects]        = useState<ProjectSummary[]>([]);
  const [showProjects,    setShowProjects]    = useState(false);

  // Fetch past projects list
  const refreshProjects = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/projects`);
      setProjects(res.data);
    } catch {
      // Backend may be starting
    }
  }, []);

  // Restore active session from localStorage on reload
  useEffect(() => {
    refreshProjects();
    const saved = localStorage.getItem("antigravity_clipper_session");
    if (saved) {
      setSessionId(saved);
      axios.get(`${API}/api/status/${saved}`).then((res) => {
        setStatus(res.data);
      }).catch(() => {
        // If not found, clear
        localStorage.removeItem("antigravity_clipper_session");
      });
    }
  }, [refreshProjects]);

  // Save session ID whenever it changes
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem("antigravity_clipper_session", sessionId);
    }
  }, [sessionId]);

  // Poll status while pipeline is actively running
  useEffect(() => {
    if (!sessionId) return;
    if (status?.status === "completed" || status?.status === "failed") return;
    const iv = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/api/status/${sessionId}`);
        setStatus(res.data);
        if (res.data.status === "completed") {
          refreshProjects();
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(iv);
  }, [sessionId, status?.status, refreshProjects]);

  const handleSubmit = useCallback(async (url: string) => {
    setIsSubmitting(true);
    setStatus(null);
    setSelectedClip(null);
    setShowProjects(false);
    try {
      const res = await axios.post(`${API}/api/process`, { url });
      setSessionId(res.data.session_id);
    } catch {
      alert("Could not reach the backend. Please verify FastAPI backend is running on port 8000.");
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const selectProject = (id: string) => {
    setSessionId(id);
    setSelectedClip(null);
    setShowProjects(false);
    axios.get(`${API}/api/status/${id}`).then((res) => {
      setStatus(res.data);
    });
  };

  const deleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API}/api/projects/${id}`);
      if (sessionId === id) {
        setSessionId(null);
        setStatus(null);
        setSelectedClip(null);
        localStorage.removeItem("antigravity_clipper_session");
      }
      refreshProjects();
    } catch { /* ignore */ }
  };

  const startNewProject = () => {
    setSessionId(null);
    setStatus(null);
    setSelectedClip(null);
    localStorage.removeItem("antigravity_clipper_session");
  };

  const isRunning  = status && status.status !== "completed" && status.status !== "failed";
  const isDone     = status?.status === "completed";
  const hasFailed  = status?.status === "failed";
  const activeStageIdx = status ? stageIndex(status.progress) : -1;

  const fmtDur = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Ambient glow */}
      <div className="orb-purple" />
      <div className="orb-indigo" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">

        {/* ── Top Navigation ──────────────────────────────────────────────── */}
        <nav className="flex items-center justify-between py-6 border-b border-white/5 mb-10 flex-wrap gap-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={startNewProject}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-600/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white leading-none">
                Anti-Gravity <span className="gradient-text">Clipper</span>
              </h1>
              <p className="text-[10px] text-neutral-600 tracking-wide uppercase">AI Viral Shorts Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* New project button */}
            {sessionId && (
              <button
                onClick={startNewProject}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Video</span>
              </button>
            )}

            {/* Projects drawer button */}
            <button
              onClick={() => setShowProjects(!showProjects)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                showProjects
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25"
                  : "border border-white/10 bg-neutral-900 hover:border-purple-500/40 text-neutral-300"
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 text-purple-400" />
              <span>Previous Projects</span>
              {projects.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-mono">
                  {projects.length}
                </span>
              )}
            </button>
          </div>
        </nav>

        {/* ── Previous Projects Section ───────────────────────────────────── */}
        {showProjects && (
          <div className="glass p-6 mb-10 fade-up border-purple-500/30">
            <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-purple-400" />
                <span>Your Saved Works ({projects.length})</span>
              </h3>
              <p className="text-xs text-neutral-500">
                All projects are preserved on your device across reloads
              </p>
            </div>

            {projects.length === 0 ? (
              <p className="text-xs text-neutral-500 py-6 text-center">
                No previous projects found yet. Paste a YouTube URL below to generate your first set of clips!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => selectProject(p.id)}
                    className={`glass p-3.5 rounded-xl cursor-pointer hover:border-purple-500/50 transition flex flex-col justify-between group ${
                      sessionId === p.id ? "border-purple-500 bg-purple-950/20" : ""
                    }`}
                  >
                    <div>
                      {/* Thumbnail or placeholder */}
                      <div className="relative w-full aspect-video rounded-lg bg-neutral-900 overflow-hidden mb-2.5">
                        {p.thumbnail ? (
                          <img
                            src={p.thumbnail}
                            alt={p.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-700">
                            <Video className="w-6 h-6" />
                          </div>
                        )}
                        <span className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-mono text-neutral-300">
                          {p.duration ? fmtDur(p.duration) : "Video"}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-white line-clamp-2 mb-1 group-hover:text-purple-300 transition">
                        {p.title}
                      </h4>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-neutral-500">
                      <span className="flex items-center gap-1 font-semibold text-purple-400">
                        {p.clips_count > 0 ? `${p.clips_count} Clips` : `${p.progress}%`}
                      </span>
                      <button
                        onClick={(e) => deleteProject(e, p.id)}
                        title="Delete project"
                        className="text-neutral-600 hover:text-red-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Hero (Shown when no project is loaded) ───────────────────────── */}
        {!status && !isSubmitting && (
          <section className="text-center max-w-3xl mx-auto mb-14 fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-950/40 border border-purple-800/40 text-purple-300 text-xs font-semibold mb-6">
              <Wand2 className="w-3.5 h-3.5" />
              1 Long YouTube Video  ->  8–9 Viral Shorts with Captions
            </div>

            <h2 className="text-5xl sm:text-6xl font-black tracking-tight text-white mb-5 leading-[1.05]">
              Turn Any Video Into{" "}
              <span className="gradient-text">Viral Reels</span>
            </h2>

            <p className="text-neutral-400 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              AI detects the most gripping 30–60 second moments. FFmpeg crops 9:16 with speaker-tracking.
              CapCut-style word-highlighted captions burn directly in.
            </p>

            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
              {[
                { icon: "⚡", t: "Instant transcript", d: "Word-level YouTube captions" },
                { icon: "🎯", t: "Speaker tracking",   d: "YuNet face detection pan" },
                { icon: "✍️", t: "Stable captions",    d: "Karaoke word highlight · no flicker" },
                { icon: "📺", t: "1080p quality",       d: "Full HD vertical downloads" },
              ].map((f) => (
                <div key={f.t} className="glass p-4 rounded-xl">
                  <div className="text-xl mb-1.5">{f.icon}</div>
                  <div className="text-xs font-bold text-white mb-0.5">{f.t}</div>
                  <div className="text-[10px] text-neutral-500 leading-snug">{f.d}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── URL Input ────────────────────────────────────────────────────── */}
        {(!status || !isDone) && (
          <div className="mb-12">
            <UrlInput onSubmit={handleSubmit} isLoading={isSubmitting} />
          </div>
        )}

        {/* ── Pipeline Progress Stepper ───────────────────────────────────── */}
        {isRunning && (
          <div className="glass max-w-2xl mx-auto p-6 mb-12 fade-up">
            {/* Stage dots */}
            <div className="flex items-center justify-between mb-5">
              {STAGES.map((s, i) => (
                <div key={s.key} className="flex flex-col items-center gap-1.5 flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    i < activeStageIdx  ? "bg-purple-600 text-white"            :
                    i === activeStageIdx? "bg-purple-500 text-white ring-2 ring-purple-400/40 scale-110" :
                                          "bg-neutral-800 text-neutral-600"
                  }`}>
                    {i < activeStageIdx ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className={`text-[10px] text-center font-medium hidden sm:block ${
                    i === activeStageIdx ? "text-purple-400" : "text-neutral-600"
                  }`}>{s.label}</span>
                </div>
              ))}
            </div>

            {/* Bar */}
            <div className="w-full bg-neutral-800 rounded-full h-2 mb-3 overflow-hidden">
              <div
                className="progress-bar h-2 rounded-full transition-all duration-700"
                style={{ width: `${status?.progress ?? 0}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping" />
                {status?.stage}
              </span>
              <span className="font-mono text-purple-400">{status?.progress}%</span>
            </div>
          </div>
        )}

        {/* ── Pipeline Error ──────────────────────────────────────────────── */}
        {hasFailed && (
          <div className="max-w-2xl mx-auto mb-10 p-5 rounded-2xl bg-red-950/30 border border-red-800/50 text-red-300 text-sm flex items-start gap-3 fade-up">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
            <div className="flex-1">
              <p className="font-bold mb-1">Pipeline encountered an issue</p>
              <p className="text-xs text-red-400/90 leading-relaxed">{status?.error}</p>
              <button
                onClick={startNewProject}
                className="mt-3 px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-800/50 text-red-200 text-xs font-semibold transition"
              >
                Try Another Video
              </button>
            </div>
          </div>
        )}

        {/* ── Active Caption Editor ───────────────────────────────────────── */}
        {selectedClip && sessionId && (
          <div className="mb-12 fade-up">
            <button
              onClick={() => setSelectedClip(null)}
              className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-neutral-500 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to all generated clips
            </button>
            <CaptionEditor
              clip={selectedClip}
              sessionId={sessionId!}
              apiBaseUrl={API}
              onClose={() => setSelectedClip(null)}
            />
          </div>
        )}

        {/* ── Generated Clips Grid ────────────────────────────────────────── */}
        {isDone && status.clips?.length > 0 && !selectedClip && (
          <section className="space-y-8 fade-up">
            {/* Video Analysis Panel */}
            {status.video_analysis && (
              <VideoAnalysisPanel
                analysis={status.video_analysis}
                sessionId={sessionId!}
              />
            )}

            {/* Clips Header Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/6">
              <div>
                <h3 className="text-2xl font-black text-white flex items-center gap-2.5">
                  <Flame className="w-6 h-6 text-amber-400" />
                  {status.clips.length} Viral Clips Ready
                </h3>
                <p className="text-sm text-neutral-500 mt-0.5">
                  Click any clip to customize CapCut captions, or download clips directly below.
                </p>
              </div>

              {/* Bulk download actions */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <a
                  href={`${API}/api/download/all/${sessionId}`}
                  download
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white text-xs font-bold transition shadow-lg shadow-purple-600/25 shrink-0"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Download All Clips (.zip)</span>
                </a>

                <a
                  href={`${API}/api/captions/${sessionId}`}
                  download
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-700/40 bg-emerald-950/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-900/30 transition shrink-0"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Full Video SRT</span>
                </a>
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {status.clips.map((clip, i) => (
                <ClipCard
                  key={clip.clip_id}
                  clip={clip}
                  sessionId={sessionId!}
                  index={i}
                  onSelect={setSelectedClip}
                  isSelected={selectedClip?.clip_id === clip.clip_id}
                />
              ))}
            </div>

            <div className="text-center text-xs text-neutral-600 pt-4">
              All clips cropped in 9:16 vertical Full HD · Face-centered speaker tracking · Millisecond word captions
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
