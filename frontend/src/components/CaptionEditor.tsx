"use client";

import React, { useState, useRef, useEffect } from "react";
import { Rnd } from "react-rnd";
import {
  Play, Pause, Download, Sliders, Type, Sparkles,
  Check, RefreshCw, FileText, X, Copy,
} from "lucide-react";
import { Clip, CaptionStyle, WordTimestamp } from "../types";
import axios from "axios";

interface CaptionEditorProps {
  clip:        Clip;
  sessionId:   string;
  apiBaseUrl?: string;
  onClose?:    () => void;
}

const STYLES: { id: CaptionStyle; label: string; desc: string; preview: string }[] = [
  { id: "hormozi",    label: "Hormozi Bold",  desc: "Impact font · black outline · amber highlight", preview: "bg-gradient-to-r from-amber-400 to-yellow-300" },
  { id: "glowing",    label: "Neon Glow",     desc: "Arial Black · magenta outline · cyan highlight", preview: "bg-gradient-to-r from-cyan-400 to-fuchsia-400" },
  { id: "typewriter", label: "Typewriter",    desc: "Monospace · dark box · green highlight",          preview: "bg-gradient-to-r from-emerald-400 to-teal-400" },
];

export const CaptionEditor: React.FC<CaptionEditorProps> = ({
  clip, sessionId, apiBaseUrl = "http://localhost:8000", onClose,
}) => {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [playing,       setPlaying]       = useState(false);
  const [currentTime,   setCurrentTime]   = useState(0);
  const [duration,      setDuration]      = useState(clip.duration || 30);
  const [style,         setStyle]         = useState<CaptionStyle>("hormozi");
  const [fontSize,      setFontSize]      = useState(28);
  const [isRendering,   setIsRendering]   = useState(false);
  const [downloadUrl,   setDownloadUrl]   = useState<string | null>(null);
  const [copied,        setCopied]        = useState(false);
  const [positionPct,   setPositionPct]   = useState({ x: 50, y: 82 });
  const [rndPos,        setRndPos]        = useState({ x: 20, y: 400 });
  const [rndSize,       setRndSize]       = useState({ width: 270, height: 72 });

  // Sync rnd position when positionPct changes
  useEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setRndPos({
      x: Math.max(0, (positionPct.x / 100) * rect.width  - rndSize.width  / 2),
      y: Math.max(0, (positionPct.y / 100) * rect.height - rndSize.height / 2),
    });
  }, [positionPct]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) { videoRef.current.pause(); setPlaying(false); }
    else          { videoRef.current.play();  setPlaying(true);  }
  };

  // Active word display
  const words: WordTimestamp[] = clip.words || [];
  const activeIdx = words.findIndex((w) => currentTime >= w.start && currentTime <= w.end);

  const getDisplayWords = () => {
    if (words.length === 0) return [{ word: "ANTIGRAVITY", isActive: true }, { word: "CAPTIONS", isActive: false }];
    const base   = activeIdx !== -1 ? activeIdx : words.findIndex((w) => currentTime < w.start);
    const pivot  = base !== -1 ? Math.max(0, base - 1) : 0;
    const end    = Math.min(words.length, pivot + 4);
    return words.slice(pivot, end).map((w, i) => ({
      word:     w.word,
      isActive: pivot + i === activeIdx,
    }));
  };

  const stylePreview = {
    hormozi: {
      font:   "font-black tracking-wider uppercase",
      base:   "text-white [text-shadow:_0_2px_0_#000,_0_-2px_0_#000,_2px_0_0_#000,_-2px_0_0_#000]",
      active: "text-amber-400 scale-110 [text-shadow:_0_3px_0_#000,_0_-3px_0_#000,_3px_0_0_#000,_-3px_0_0_#000]",
    },
    glowing: {
      font:   "font-extrabold tracking-wide",
      base:   "text-neutral-100",
      active: "text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,1)] scale-105",
    },
    typewriter: {
      font:   "font-mono font-bold",
      base:   "text-neutral-200 bg-neutral-900/80 px-1 rounded",
      active: "text-emerald-300 bg-emerald-950/90 border border-emerald-500/40 px-1.5 rounded scale-105",
    },
  }[style];

  const handleDragStop = (_: any, d: { x: number; y: number }) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setRndPos({ x: d.x, y: d.y });
    setPositionPct({
      x: Math.round(((d.x + rndSize.width  / 2) / rect.width)  * 100),
      y: Math.round(((d.y + rndSize.height / 2) / rect.height) * 100),
    });
  };

  const handleRender = async () => {
    setIsRendering(true);
    try {
      const res = await axios.post(`${apiBaseUrl}/api/render`, {
        session_id: sessionId,
        clip_id:    clip.clip_id,
        style,
        font_size:  fontSize * 2,   // scale up for 1080p canvas
        pos_x_pct:  positionPct.x,
        pos_y_pct:  positionPct.y,
      });
      const url = `${apiBaseUrl}${res.data.download_url}`;
      setDownloadUrl(url);
      // Auto-trigger download
      const a = document.createElement("a");
      a.href = url;
      a.download = `clip_${clip.clip_id}_captioned.mp4`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (err) {
      console.error("Render failed:", err);
      alert("Render failed — check backend logs.");
    } finally {
      setIsRendering(false);
    }
  };

  const copyYtDesc = () => {
    if (!clip.youtube_description) return;
    navigator.clipboard.writeText(clip.youtube_description);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass fade-up shadow-2xl max-w-6xl w-full mx-auto overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Caption Editor</h3>
            <p className="text-[11px] text-neutral-500 line-clamp-1">{clip.viral_title}</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center transition">
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-11 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-white/5">
        {/* ── Video Preview ───────────────────────────────────────────────── */}
        <div className="lg:col-span-5 flex flex-col items-center p-6 gap-4">
          <div
            ref={containerRef}
            className="relative rounded-2xl overflow-hidden border border-white/8 shadow-2xl"
            style={{ width: 300, height: 533, background: "#000" }}
          >
            <video
              ref={videoRef}
              src={clip.video_url ? `${apiBaseUrl}${clip.video_url}` : undefined}
              onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
              onLoadedMetadata={() => videoRef.current && setDuration(videoRef.current.duration)}
              onEnded={() => setPlaying(false)}
              className="w-full h-full object-cover pointer-events-none"
              playsInline
              loop
            />

            {/* Caption overlay — draggable */}
            <Rnd
              bounds="parent"
              position={rndPos}
              size={rndSize}
              onDragStop={handleDragStop}
              onResizeStop={(_e, _dir, ref, _delta, pos) => {
                setRndSize({ width: parseInt(ref.style.width), height: parseInt(ref.style.height) });
                setRndPos(pos);
              }}
              className="z-20 flex items-center justify-center p-2 rounded-lg border border-dashed border-purple-400/40 bg-black/20 backdrop-blur-sm cursor-move hover:border-purple-400/70 transition"
            >
              <div
                className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-0 text-center transition-all ${stylePreview.font}`}
                style={{ fontSize: `${fontSize}px`, lineHeight: 1.15 }}
              >
                {getDisplayWords().map((item, i) => (
                  <span
                    key={i}
                    className={`inline-block transition-all duration-100 ${item.isActive ? stylePreview.active : stylePreview.base}`}
                  >
                    {item.word}
                  </span>
                ))}
              </div>
            </Rnd>

            {/* Play/pause overlay */}
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/25 transition group z-10"
            >
              <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center shadow-xl group-hover:scale-110 transition">
                {playing ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
              </div>
            </button>
          </div>

          {/* Timeline */}
          <div className="w-[300px] flex items-center gap-3 text-xs text-neutral-500 font-mono">
            <span>{currentTime.toFixed(1)}s</span>
            <input
              type="range" min={0} max={duration} step={0.05} value={currentTime}
              onChange={(e) => {
                const t = parseFloat(e.target.value);
                setCurrentTime(t);
                if (videoRef.current) videoRef.current.currentTime = t;
              }}
              className="flex-1"
            />
            <span>{duration.toFixed(1)}s</span>
          </div>

          {/* Position hint */}
          <p className="text-[11px] text-neutral-600 text-center w-[300px]">
            🖱 Drag the caption box on the video to reposition · Resize from corners
          </p>
        </div>

        {/* ── Controls ────────────────────────────────────────────────────── */}
        <div className="lg:col-span-6 p-6 space-y-6">
          {/* Style Presets */}
          <div>
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Type className="w-3.5 h-3.5 text-purple-400" />
              Caption Style
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    style === s.id
                      ? "border-purple-500/60 bg-purple-500/10 text-white shadow-[0_0_16px_rgba(139,92,246,.15)]"
                      : "border-white/7 bg-white/3 hover:border-white/15 text-neutral-400"
                  }`}
                >
                  <div className={`w-full h-1 rounded-full mb-2 ${s.preview}`} />
                  <div className="font-semibold text-xs">{s.label}</div>
                  <div className="text-[10px] opacity-60 mt-0.5 leading-tight">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                Font Size
              </p>
              <span className="text-xs font-mono text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
                {fontSize}px
              </span>
            </div>
            <input
              type="range" min={16} max={52} value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Position display */}
          <div className="rounded-xl bg-white/3 border border-white/6 p-4 text-xs space-y-1">
            <div className="flex justify-between text-neutral-300 font-medium">
              <span>Canvas Anchor</span>
              <span className="font-mono text-purple-400">X: {positionPct.x}%  Y: {positionPct.y}%</span>
            </div>
            <p className="text-neutral-600">Burns at this exact position in the exported 1080×1920 MP4.</p>
          </div>

          {/* YouTube SEO panel */}
          {(clip.youtube_title || clip.youtube_description) && (
            <div className="rounded-xl bg-red-950/20 border border-red-900/30 p-4 space-y-2">
              <p className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                🔴 YouTube-Ready Metadata
              </p>
              {clip.youtube_title && (
                <p className="text-sm text-white font-semibold">{clip.youtube_title}</p>
              )}
              {clip.youtube_description && (
                <div>
                  <p className="text-[11px] text-neutral-400 line-clamp-3 leading-relaxed">
                    {clip.youtube_description}
                  </p>
                  <button
                    onClick={copyYtDesc}
                    className="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-emerald-400 transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied!" : "Copy description"}
                  </button>
                </div>
              )}
              {clip.youtube_tags && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {clip.youtube_tags.map((t) => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-red-950/50 border border-red-800/30 text-red-400">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2.5 pt-2 border-t border-white/5">
            <button
              onClick={handleRender}
              disabled={isRendering}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:brightness-110 active:scale-95 text-white font-bold rounded-xl flex items-center justify-center gap-2.5 transition shadow-xl shadow-purple-600/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRendering ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /><span>Burning captions with FFmpeg…</span></>
              ) : (
                <><Download className="w-4 h-4" /><span>Render &amp; Download Final MP4</span></>
              )}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <a
                href={`${apiBaseUrl}/api/download/clip/${sessionId}/${clip.clip_id}`}
                download={`clip_${clip.clip_id}.mp4`}
                className="py-2.5 border border-purple-700/40 bg-purple-950/20 hover:bg-purple-900/30 text-purple-300 font-semibold rounded-xl flex items-center justify-center gap-1.5 text-xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                Raw 9:16 MP4
              </a>

              <a
                href={`${apiBaseUrl}/api/captions/${sessionId}/clip/${clip.clip_id}`}
                download={`clip_${clip.clip_id}.srt`}
                className="py-2.5 border border-emerald-700/40 bg-emerald-950/20 hover:bg-emerald-900/30 text-emerald-400 font-semibold rounded-xl flex items-center justify-center gap-1.5 text-xs transition"
              >
                <FileText className="w-3.5 h-3.5" />
                SRT Captions
              </a>
            </div>

            {downloadUrl && (
              <div className="p-3 bg-emerald-950/30 border border-emerald-700/30 rounded-xl flex items-center justify-between text-xs text-emerald-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <Check className="w-4 h-4" /> Render complete — saved to Downloads!
                </span>
                <a href={downloadUrl} download className="underline hover:text-emerald-300 font-bold shrink-0">
                  Again
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
