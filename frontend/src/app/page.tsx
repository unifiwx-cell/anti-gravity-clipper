"use client";

import React, { useState, useEffect, useCallback } from "react";
import { UrlInput }      from "../components/UrlInput";
import { ClipCard }      from "../components/ClipCard";
import { CaptionEditor } from "../components/CaptionEditor";
import { Clip, SessionStatus, VideoAnalysis, ProjectSummary, CaptionStyle } from "../types";
import {
  Sparkles, Flame, Wand2, ArrowLeft, FileText,
  TrendingUp, TrendingDown, CheckCircle2, AlertCircle,
  Youtube, BarChart3, Copy, Check, FolderOpen,
  Archive, Download, Plus, Trash2, Clock, Video,
  Zap, Layers, Sliders, Type, Search, Filter, Play
} from "lucide-react";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STAGES = [
  { key: "metadata",    label: "Video Metadata",  range: [0,  15] },
  { key: "transcript",  label: "Word Subtitles",  range: [15, 50] },
  { key: "ai",          label: "Viral Hooks",     range: [50, 70] },
  { key: "download",    label: "1080p Media",     range: [70, 78] },
  { key: "crop",        label: "9:16 Face Track", range: [78, 100] },
];

function stageIndex(progress: number) {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (progress >= STAGES[i].range[0]) return i;
  }
  return 0;
}

// ── Cliperg Video Intelligence & Analysis Panel ───────────────────────────────
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
    <div className="glass fade-up p-6 space-y-5 mb-8 border-purple-500/30">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">Cliperg Video Intelligence</h3>
            <p className="text-[11px] text-neutral-400">Contextual retention analysis &amp; YouTube SEO strategy</p>
          </div>
        </div>

        <a
          href={`${API}/api/captions/${sessionId}`}
          download
          className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl border border-emerald-700/40 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/40 transition font-semibold"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Full Video Subtitles (SRT)</span>
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {analysis.best_moments && (
          <div className="rounded-xl p-4 bg-emerald-950/20 border border-emerald-800/30">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> High Retention Moments
            </p>
            <p className="text-xs text-neutral-300 leading-relaxed">{analysis.best_moments}</p>
          </div>
        )}
        {analysis.weak_moments && (
          <div className="rounded-xl p-4 bg-red-950/20 border border-red-800/30">
            <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5" /> Low Engagement Sections (Skip)
            </p>
            <p className="text-xs text-neutral-300 leading-relaxed">{analysis.weak_moments}</p>
          </div>
        )}
      </div>

      {analysis.recommended_youtube_title && (
        <div className="rounded-xl p-4 bg-red-950/20 border border-red-900/30 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
              <Youtube className="w-4 h-4" /> Ready-Made Full YouTube Upload Copy
            </p>
            <button
              onClick={() => copy(
                `${analysis.recommended_youtube_title}\n\n${analysis.recommended_youtube_description || ""}`
              )}
              className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition font-medium"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied!" : "Copy Title + Description"}</span>
            </button>
          </div>

          <div>
            <p className="text-[11px] text-neutral-500 mb-0.5 font-medium">Recommended Title</p>
            <p className="text-sm text-white font-bold">{analysis.recommended_youtube_title}</p>
          </div>

          {analysis.recommended_youtube_description && (
            <div>
              <p className="text-[11px] text-neutral-500 mb-0.5 font-medium">Recommended Description</p>
              <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-line line-clamp-3">
                {analysis.recommended_youtube_description}
              </p>
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
  const [viewMode,        setViewMode]        = useState<"clipper" | "projects" | "styles">("clipper");
  const [projectSearch,   setProjectSearch]   = useState("");
  const [categoryFilter,  setCategoryFilter]  = useState<string>("all");

  const refreshProjects = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/projects`);
      setProjects(res.data);
    } catch {
      // Backend may be initializing
    }
  }, []);

  // Restore active session from localStorage on reload
  useEffect(() => {
    refreshProjects();
    const saved = localStorage.getItem("cliperg_current_session") || localStorage.getItem("cliphi_current_session");
    if (saved) {
      setSessionId(saved);
      axios.get(`${API}/api/status/${saved}`).then((res) => {
        setStatus(res.data);
      }).catch(() => {
        localStorage.removeItem("cliperg_current_session");
        localStorage.removeItem("cliphi_current_session");
      });
    }
  }, [refreshProjects]);

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem("cliperg_current_session", sessionId);
    }
  }, [sessionId]);

  // Poll status while pipeline is running
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
    setViewMode("clipper");
    try {
      const res = await axios.post(`${API}/api/process`, { url });
      setSessionId(res.data.session_id);
    } catch {
      alert("Could not reach backend on port 8000. Please ensure the server is active.");
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const selectProject = (id: string) => {
    setSessionId(id);
    setSelectedClip(null);
    setViewMode("clipper");
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
        localStorage.removeItem("cliperg_current_session");
        localStorage.removeItem("cliphi_current_session");
      }
      refreshProjects();
    } catch { /* ignore */ }
  };

  const startNewProject = () => {
    setSessionId(null);
    setStatus(null);
    setSelectedClip(null);
    setViewMode("clipper");
    localStorage.removeItem("cliperg_current_session");
    localStorage.removeItem("cliphi_current_session");
  };

  const isRunning  = status && status.status !== "completed" && status.status !== "failed";
  const isDone     = status?.status === "completed";
  const hasFailed  = status?.status === "failed";
  const activeStageIdx = status ? stageIndex(status.progress) : -1;

  const fmtDur = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

  // Filter projects by search query
  const filteredProjects = projects.filter((p) =>
    p.title.toLowerCase().includes(projectSearch.toLowerCase()) ||
    p.url.toLowerCase().includes(projectSearch.toLowerCase())
  );

  // Filter clips by category
  const filteredClips = (status?.clips || []).filter((clip) => {
    if (categoryFilter === "all") return true;
    if (categoryFilter === "high") return clip.hook_score >= 90;
    return clip.category?.toLowerCase() === categoryFilter.toLowerCase();
  });

  return (
    <main className="min-h-screen" style={{ background: "#090a10" }}>
      {/* Cliperg Ambient Radiant Background */}
      <div className="orb-purple" />
      <div className="orb-indigo" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-28">

        {/* ── CLIPERG TOP NAVIGATION BAR ─────────────────────────────────── */}
        <nav className="flex items-center justify-between py-5 border-b border-white/10 mb-8 flex-wrap gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={startNewProject}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-xl shadow-purple-600/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white font-sans">
                  CLIP<span className="text-purple-400">ERG</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30">
                  STUDIO
                </span>
              </div>
              <p className="text-[10px] text-neutral-500 tracking-wider uppercase font-semibold">
                AI Short-Form Video Repurposing
              </p>            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 p-1 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <button
              onClick={() => { setViewMode("clipper"); }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === "clipper"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Auto Clipper</span>
            </button>

            <button
              onClick={() => { setViewMode("projects"); refreshProjects(); }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === "projects"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Past Projects</span>
              {projects.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white/10 text-neutral-200 text-[10px] font-mono">
                  {projects.length}
                </span>
              )}
            </button>

            <button
              onClick={() => { setViewMode("styles"); }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === "styles"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Caption Styles</span>
            </button>
          </div>

          {/* Action Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={startNewProject}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-200 text-xs font-bold transition"
            >
              <Plus className="w-3.5 h-3.5 text-purple-400" />
              <span>New Clipper</span>
            </button>
          </div>
        </nav>

        {/* ── VIEW 1: PAST PROJECTS DASHBOARD (EXACT CLIPERG DASHBOARD) ───── */}
        {viewMode === "projects" && (
          <div className="space-y-6 fade-up">
            {/* Header with Stats */}
            <div className="glass p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 border-purple-500/20">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2 mb-1">
                  <FolderOpen className="w-5 h-5 text-purple-400" />
                  <span>My Repurposed Projects ({projects.length})</span>
                </h2>
                <p className="text-xs text-neutral-400">
                  All processed videos and viral vertical clips are permanently saved on your device.
                </p>
              </div>

              {/* Quick Metrics */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="px-4 py-2.5 rounded-xl bg-black/40 border border-white/5 text-center">
                  <div className="text-lg font-black text-white">{projects.length}</div>
                  <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Videos</div>
                </div>
                <div className="px-4 py-2.5 rounded-xl bg-black/40 border border-white/5 text-center">
                  <div className="text-lg font-black text-purple-400">
                    {projects.reduce((acc, p) => acc + (p.clips_count || 0), 0)}
                  </div>
                  <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Shorts Made</div>
                </div>
                <div className="px-4 py-2.5 rounded-xl bg-black/40 border border-white/5 text-center">
                  <div className="text-lg font-black text-amber-400">92%</div>
                  <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Avg Viral Score</div>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Search previous projects by title or YouTube URL..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Projects Grid */}
            {filteredProjects.length === 0 ? (
              <div className="glass p-12 text-center space-y-3 rounded-2xl">
                <Video className="w-10 h-10 text-neutral-600 mx-auto" />
                <p className="text-sm font-semibold text-neutral-400">No past projects found</p>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Paste any YouTube URL in the Auto Clipper to generate your first 8-9 viral shorts with CapCut subtitles.
                </p>
                <button
                  onClick={() => setViewMode("clipper")}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-lg shadow-purple-600/25"
                >
                  Go to Auto Clipper
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredProjects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => selectProject(p.id)}
                    className="glass p-4 rounded-2xl cursor-pointer hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/10 transition group flex flex-col justify-between"
                  >
                    <div>
                      {/* Video Thumbnail */}
                      <div className="relative w-full aspect-video rounded-xl bg-black/60 overflow-hidden mb-3 border border-white/5">
                        {p.thumbnail ? (
                          <img
                            src={p.thumbnail}
                            alt={p.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-700">
                            <Video className="w-8 h-8" />
                          </div>
                        )}
                        <span className="absolute bottom-2 right-2 bg-black/85 px-2 py-0.5 rounded text-[11px] font-mono text-neutral-300 backdrop-blur-md">
                          {p.duration ? fmtDur(p.duration) : "Video"}
                        </span>
                        <div className="absolute top-2 left-2 badge badge-purple text-[10px]">
                          1080p
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-white line-clamp-2 mb-2 group-hover:text-purple-300 transition">
                        {p.title}
                      </h4>
                    </div>

                    <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                      <span className="font-bold text-purple-400">
                        {p.clips_count > 0 ? `${p.clips_count} Viral Shorts Ready` : `${p.progress}% Processing`}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => deleteProject(e, p.id)}
                          title="Delete Project"
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-white/5 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          className="px-3 py-1 rounded-lg bg-purple-600/30 text-purple-300 text-xs font-bold group-hover:bg-purple-600 group-hover:text-white transition"
                        >
                          Open Studio
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── VIEW 2: CAPTION STYLES SHOWCASE (CLIPERG PRESETS) ───────────── */}
        {viewMode === "styles" && (
          <div className="space-y-6 fade-up">
            <div className="glass p-6 rounded-2xl border-purple-500/20">
              <h2 className="text-xl font-black text-white flex items-center gap-2 mb-1">
                <Type className="w-5 h-5 text-purple-400" />
                <span>Cliperg Caption Typography Presets</span>
              </h2>
              <p className="text-xs text-neutral-400">
                Modeled after top creators (Alex Hormozi, MrBeast, Ali Abdaal) with real-time speech karaoke highlights.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  name: "Combined Multi-Color",
                  creator: "Viral Creator Pop",
                  desc: "Dynamic rainbow highlight: Yellow, Lime Green, Cyan, and Coral Pink combine word by word.",
                  preview: "bg-gradient-to-r from-yellow-400 via-emerald-400 to-cyan-400 text-black font-black",
                  sampleActive: "text-yellow-300 font-black",
                  sampleBase: "text-white font-black"
                },
                {
                  name: "Hormozi Classic",
                  creator: "Alex Hormozi",
                  desc: "Ultra-bold Impact, pure white base, vibrant amber/yellow highlight, thick black outline.",
                  preview: "bg-amber-400 text-black",
                  sampleActive: "text-yellow-300 font-black",
                  sampleBase: "text-white font-black"
                },
                {
                  name: "MrBeast Pop",
                  creator: "MrBeast",
                  desc: "Electric lime word pop, bouncy animation sync, heavy drop shadow.",
                  preview: "bg-emerald-400 text-black",
                  sampleActive: "text-emerald-400 font-black",
                  sampleBase: "text-white font-black"
                },
                {
                  name: "Cyber Neon Glow",
                  creator: "Cyberpunk",
                  desc: "Neon cyan words with radiant magenta glow for high visual retention.",
                  preview: "bg-cyan-400 text-black",
                  sampleActive: "text-cyan-300 font-extrabold",
                  sampleBase: "text-neutral-200 font-extrabold"
                },
                {
                  name: "Red Alert",
                  creator: "Ali Abdaal",
                  desc: "High-contrast clean white with scarlet red keyword punches.",
                  preview: "bg-red-500 text-white",
                  sampleActive: "text-red-500 font-black",
                  sampleBase: "text-white font-black"
                },
                {
                  name: "Typewriter Terminal",
                  creator: "Monospace",
                  desc: "Clean dark boxed container with spring green monospace highlight.",
                  preview: "bg-green-500/30 text-green-300",
                  sampleActive: "text-emerald-300 font-mono font-bold bg-emerald-950 px-1 rounded",
                  sampleBase: "text-neutral-300 font-mono font-bold"
                },
                {
                  name: "Minimalist Clean",
                  creator: "Modern Clean",
                  desc: "Subtle modern sans with champagne gold speech sweeps.",
                  preview: "bg-neutral-200 text-black",
                  sampleActive: "text-amber-200 font-bold",
                  sampleBase: "text-white/90 font-bold"
                }
              ].map((s, idx) => (
                <div key={idx} className="glass p-5 rounded-2xl border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">{s.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${s.preview}`}>
                      {s.creator}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-black/70 border border-white/5 text-center">
                    <span className={`text-base tracking-wide uppercase ${s.sampleBase}`}>WATCH HOW THIS </span>
                    <span className={`text-base tracking-wide uppercase ${s.sampleActive}`}>POPS!</span>
                  </div>

                  <p className="text-xs text-neutral-400 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── VIEW 3: CLIPERG AUTO CLIPPER (PRIMARY WORKFLOW) ─────────────── */}
        {viewMode === "clipper" && (
          <div>
            {/* Hero Section (When no active clips) */}
            {!status && !isSubmitting && (
              <section className="text-center max-w-3xl mx-auto mb-12 fade-up">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-950/40 border border-purple-800/40 text-purple-300 text-xs font-semibold mb-6 shadow-lg shadow-purple-600/10">
                  <Wand2 className="w-3.5 h-3.5 text-purple-400" />
                  Cliperg Engine · 1 Long Video ➔ 8 to 9 Viral Reels
                </div>

                <h2 className="text-5xl sm:text-6xl font-black tracking-tight text-white mb-5 leading-[1.05]">
                  Turn Long Videos Into <br />
                  <span className="gradient-text">Viral 9:16 Shorts</span>
                </h2>

                <p className="text-neutral-400 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
                  AI scans audio context for viral hooks, tracks speakers in vertical 9:16, generates ready-made titles, and burns CapCut word-highlight captions.
                </p>

                {/* Cliperg Feature Bar */}
                <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                  {[
                    { icon: "⚡", t: "Instant Subtitles", d: "Zero wait transcript stream" },
                    { icon: "🎯", t: "Speaker Centering", d: "YuNet face tracking 9:16" },
                    { icon: "✍️", t: "Cliperg Text Styles", d: "Hormozi, Beast, Neon, Red" },
                    { icon: "🔥", t: "Ready-Made Titles", d: "YouTube, TikTok, Reels copy" },
                  ].map((f) => (
                    <div key={f.t} className="glass p-3.5 rounded-xl border-white/10">
                      <div className="text-xl mb-1">{f.icon}</div>
                      <div className="text-xs font-bold text-white mb-0.5">{f.t}</div>
                      <div className="text-[10px] text-neutral-500 leading-snug">{f.d}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* URL Input Bar */}
            {(!status || !isDone) && (
              <div className="mb-10">
                <UrlInput onSubmit={handleSubmit} isLoading={isSubmitting} />
              </div>
            )}

            {/* ── Pipeline Progress Bar ───────────────────────────────────── */}
            {isRunning && (
              <div className="glass max-w-2xl mx-auto p-6 mb-12 fade-up border-purple-500/30">
                <div className="flex items-center justify-between mb-5">
                  {STAGES.map((s, i) => (
                    <div key={s.key} className="flex flex-col items-center gap-1.5 flex-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                        i < activeStageIdx  ? "bg-purple-600 text-white" :
                        i === activeStageIdx? "bg-purple-500 text-white ring-2 ring-purple-400/50 scale-110 shadow-lg shadow-purple-600/30" :
                                              "bg-neutral-800 text-neutral-600"
                      }`}>
                        {i < activeStageIdx ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                      </div>
                      <span className={`text-[10px] text-center font-medium hidden sm:block ${
                        i === activeStageIdx ? "text-purple-300 font-bold" : "text-neutral-500"
                      }`}>{s.label}</span>
                    </div>
                  ))}
                </div>

                <div className="w-full bg-neutral-900 rounded-full h-2.5 mb-3 overflow-hidden border border-white/5">
                  <div
                    className="progress-bar h-2.5 rounded-full transition-all duration-700"
                    style={{ width: `${status?.progress ?? 0}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
                    {status?.stage}
                  </span>
                  <span className="font-mono text-purple-400 font-bold">{status?.progress}%</span>
                </div>
              </div>
            )}

            {/* ── Error Notification ──────────────────────────────────────── */}
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

            {/* ── Active Caption Editor (Studio Modal) ────────────────────── */}
            {selectedClip && sessionId && (
              <div className="mb-12 fade-up">
                <button
                  onClick={() => setSelectedClip(null)}
                  className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition px-3 py-1.5 rounded-lg bg-white/5 border border-white/10"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to all clips</span>
                </button>
                <CaptionEditor
                  clip={selectedClip}
                  sessionId={sessionId!}
                  apiBaseUrl={API}
                  onClose={() => setSelectedClip(null)}
                />
              </div>
            )}

            {/* ── Viral Shorts Grid (Cliperg Style Grid) ───────────────────── */}
            {isDone && status.clips?.length > 0 && !selectedClip && (
              <section className="space-y-8 fade-up">
                {/* Full Video Intelligence & SEO */}
                {status.video_analysis && (
                  <VideoAnalysisPanel
                    analysis={status.video_analysis}
                    sessionId={sessionId!}
                  />
                )}

                {/* Section Header with Category Filters & Bulk Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
                  <div>
                    <div className="flex items-center gap-2">
                      <Flame className="w-6 h-6 text-amber-400" />
                      <h3 className="text-2xl font-black text-white">
                        {status.clips.length} Viral Shorts Ready
                      </h3>
                      <span className="badge badge-purple text-xs">1080p Full HD</span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">
                      Pick ready-made title angles, copy social hooks, or click Edit to customize CapCut subtitles.
                    </p>
                  </div>

                  {/* Bulk Download Buttons */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <a
                      href={`${API}/api/download/all/${sessionId}`}
                      download
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:brightness-110 text-white text-xs font-bold transition shadow-xl shadow-purple-600/30 shrink-0"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Download All (.ZIP)</span>
                    </a>

                    <a
                      href={`${API}/api/captions/${sessionId}`}
                      download
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-700/40 bg-emerald-950/20 text-emerald-300 text-xs font-semibold hover:bg-emerald-900/30 transition shrink-0"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Full SRT</span>
                    </a>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-2 flex-wrap pb-2">
                  {[
                    { id: "all", label: "All Clips" },
                    { id: "high", label: "🔥 90%+ Viral Score" },
                    { id: "mindset", label: "🧠 Mindset" },
                    { id: "contrarian", label: "⚡ Contrarian" },
                    { id: "business", label: "💼 Business" },
                    { id: "tactical", label: "🎯 Tactical" },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setCategoryFilter(filter.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                        categoryFilter === filter.id
                          ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                          : "bg-white/5 border border-white/10 text-neutral-400 hover:text-white"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                {/* Shorts Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredClips.map((clip, i) => (
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

                {/* Bottom Footer */}
                <div className="text-center text-xs text-neutral-600 pt-6">
                  Cliperg Engine · 9:16 Vertical Cropping · Face Centering · Precision Karaoke Highlights
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
