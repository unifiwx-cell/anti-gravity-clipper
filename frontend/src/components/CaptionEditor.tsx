"use client";

import React, { useState, useRef, useEffect } from "react";
import { Rnd } from "react-rnd";
import {
  Play, Pause, Download, Sliders, Type, Sparkles,
  Check, RefreshCw, FileText, X, Copy, Palette,
  Zap, Youtube, Share2, AlignCenter, Flame, ChevronRight
} from "lucide-react";
import { Clip, CaptionStyle, WordTimestamp } from "../types";
import axios from "axios";

interface CaptionEditorProps {
  clip:        Clip;
  sessionId:   string;
  apiBaseUrl?: string;
  onClose?:    () => void;
}

interface StylePreset {
  id:          CaptionStyle;
  name:        string;
  creator:     string;
  font:        string;
  desc:        string;
  badgeCls:    string;
  baseCls:     string;
  activeCls:   string;
  defaultHex:  string;
}

const CLIPERG_STYLES: StylePreset[] = [
  {
    id: "multicolor",
    name: "Combined Multi-Color",
    creator: "Viral Creator Pop",
    font: "Impact, sans-serif",
    desc: "Dynamic rainbow pop: Yellow, Lime Green, Cyan, and Coral Pink combine word by word",
    badgeCls: "bg-gradient-to-r from-yellow-400 via-emerald-400 to-cyan-400 text-black font-black",
    baseCls: "font-black tracking-wider uppercase text-white [text-shadow:_0_3px_0_#000,_0_-3px_0_#000,_3px_0_0_#000,_-3px_0_0_#000]",
    activeCls: "font-black tracking-wider uppercase scale-110 [text-shadow:_0_4px_0_#000,_0_-4px_0_#000,_4px_0_0_#000,_-4px_0_0_#000]",
    defaultHex: "#FFE500"
  },
  {
    id: "hormozi",
    name: "Hormozi Classic",
    creator: "Alex Hormozi",
    font: "Impact, sans-serif",
    desc: "All-caps, pure black stroke, high-contrast amber/yellow highlight",
    badgeCls: "bg-amber-400 text-black",
    baseCls: "font-black tracking-wider uppercase text-white [text-shadow:_0_3px_0_#000,_0_-3px_0_#000,_3px_0_0_#000,_-3px_0_0_#000]",
    activeCls: "font-black tracking-wider uppercase text-yellow-300 scale-110 [text-shadow:_0_4px_0_#000,_0_-4px_0_#000,_4px_0_0_#000,_-4px_0_0_#000]",
    defaultHex: "#FFE500"
  },
  {
    id: "beast",
    name: "MrBeast Pop",
    creator: "MrBeast Style",
    font: "Impact, Arial Black",
    desc: "Electric lime pop, bouncy word animations, ultra-legible black outline",
    badgeCls: "bg-emerald-400 text-black",
    baseCls: "font-black tracking-wide uppercase text-white [text-shadow:_0_3px_0_#000,_0_-3px_0_#000,_3px_0_0_#000,_-3px_0_0_#000]",
    activeCls: "font-black tracking-wide uppercase text-emerald-400 scale-110 [text-shadow:_0_4px_0_#000,_0_-4px_0_#000,_4px_0_0_#000,_-4px_0_0_#000]",
    defaultHex: "#00FF66"
  },
  {
    id: "glowing",
    name: "Cyber Neon Glow",
    creator: "Neon Cyberpunk",
    font: "Arial Black, sans-serif",
    desc: "Electric cyan words with vivid magenta radiant blur glow",
    badgeCls: "bg-cyan-400 text-black",
    baseCls: "font-extrabold tracking-wide text-neutral-200 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]",
    activeCls: "font-extrabold tracking-wide text-cyan-300 drop-shadow-[0_0_16px_rgba(34,211,238,1)] scale-105",
    defaultHex: "#00F0FF"
  },
  {
    id: "redalert",
    name: "Red Alert",
    creator: "Ali Abdaal",
    font: "Impact, sans-serif",
    desc: "Clean white base with high-alert scarlet red keyword focus",
    badgeCls: "bg-red-500 text-white",
    baseCls: "font-black tracking-wider uppercase text-white [text-shadow:_0_3px_0_#000,_0_-3px_0_#000,_3px_0_0_#000,_-3px_0_0_#000]",
    activeCls: "font-black tracking-wider uppercase text-red-500 scale-110 [text-shadow:_0_4px_0_#000,_0_-4px_0_#000,_4px_0_0_#000,_-4px_0_0_#000]",
    defaultHex: "#FF2E2E"
  },
  {
    id: "typewriter",
    name: "Typewriter Terminal",
    creator: "Monospace Geek",
    font: "Courier New, monospace",
    desc: "Clean dark boxed container with vibrant matrix spring green cursor",
    badgeCls: "bg-green-500/20 text-green-300 border border-green-500/40",
    baseCls: "font-mono font-bold text-neutral-300 bg-black/75 px-1.5 py-0.5 rounded",
    activeCls: "font-mono font-bold text-emerald-300 bg-emerald-950/90 border border-emerald-500/50 px-2 py-0.5 rounded scale-105",
    defaultHex: "#00FF7F"
  },
  {
    id: "minimal",
    name: "Minimalist Clean",
    creator: "Modern Clean",
    font: "Inter, sans-serif",
    desc: "Understated modern elegance with champagne gold speech sweeps",
    badgeCls: "bg-neutral-200 text-black",
    baseCls: "font-bold tracking-tight text-white/90",
    activeCls: "font-bold tracking-tight text-amber-200 drop-shadow-[0_2px_10px_rgba(251,191,36,0.5)] scale-105",
    defaultHex: "#FDE68A"
  }
];

export const CaptionEditor: React.FC<CaptionEditorProps> = ({
  clip,
  sessionId,
  apiBaseUrl = "http://localhost:8000",
  onClose,
}) => {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Studio tabs: "styles" | "titles" | "tuning"
  const [activeTab, setActiveTab] = useState<"styles" | "titles" | "tuning">("styles");

  const [playing,       setPlaying]       = useState(false);
  const [currentTime,   setCurrentTime]   = useState(0);
  const [duration,      setDuration]      = useState(clip.duration || 30);
  const [style,         setStyle]         = useState<CaptionStyle>("multicolor");
  const [fontSize,      setFontSize]      = useState(26);
  const [chunkSize,     setChunkSize]     = useState(4);
  const [enableHook,    setEnableHook]    = useState(true);
  const [hookTitle,     setHookTitle]     = useState(clip.on_screen_hook || "WAIT FOR THE END 🤯");
  const [selectedTitle, setSelectedTitle] = useState(clip.viral_title);

  // Position coordinates in percentage
  const [positionPct,   setPositionPct]   = useState({ x: 50, y: 80 });
  const [rndPos,        setRndPos]        = useState({ x: 20, y: 390 });
  const [rndSize,       setRndSize]       = useState({ width: 270, height: 75 });

  const [isRendering,   setIsRendering]   = useState(false);
  const [downloadUrl,   setDownloadUrl]   = useState<string | null>(null);
  const [copiedKey,     setCopiedKey]     = useState<string | null>(null);

  // Synchronize RND box coordinates when container or position changes
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

  // 60FPS Video time synchronization for millisecond-accurate word popup
  useEffect(() => {
    let animId: number;
    const tick = () => {
      if (videoRef.current && !videoRef.current.paused) {
        setCurrentTime(videoRef.current.currentTime);
      }
      animId = requestAnimationFrame(tick);
    };
    if (playing) {
      animId = requestAnimationFrame(tick);
    }
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [playing]);

  // Precision word calculations for preview matching CapCut/Cliperg audio sync
  const words: WordTimestamp[] = clip.words || [];

  const getDisplayWords = () => {
    if (words.length === 0) {
      return [
        { word: "CLIPERG", isSpoken: true, isActive: true, color: "#FFE500" },
        { word: "CAPTIONS", isSpoken: false, isActive: false, color: "#FFFFFF" }
      ];
    }

    // Continuous word tracking: find active word index without losing highlight between words
    let currentIdx = 0;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const nextStart = i + 1 < words.length ? words[i + 1].start : (duration || 9999);
      if (currentTime >= w.start && currentTime < nextStart) {
        currentIdx = i;
        break;
      } else if (currentTime < w.start && i === 0) {
        currentIdx = 0;
        break;
      } else if (i === words.length - 1 && currentTime >= w.start) {
        currentIdx = i;
        break;
      }
    }

    // Dynamic creator color palettes
    let palette = ["#FFE500"];
    if (style === "multicolor") {
      // Dynamic rainbow pop combining vibrant creator colors word by word
      palette = ["#FFE500", "#00FF66", "#00F0FF", "#FF3366", "#FF9900"];
    } else if (style === "beast") {
      palette = ["#00FF66"];
    } else if (style === "glowing") {
      palette = ["#00F0FF", "#E879F9"];
    } else if (style === "redalert") {
      palette = ["#FF2E2E"];
    } else if (style === "typewriter") {
      palette = ["#00FF7F"];
    } else if (style === "minimal") {
      palette = ["#FDE68A"];
    }

    // Stable chunk based on chunkSize
    const chunkStart = Math.floor(currentIdx / chunkSize) * chunkSize;
    const chunkEnd   = Math.min(words.length, chunkStart + chunkSize);
    const chunk      = words.slice(chunkStart, chunkEnd);

    return chunk.map((w, idx) => {
      const globalIdx = chunkStart + idx;
      const isSpoken  = globalIdx <= currentIdx;
      const isActive  = globalIdx === currentIdx;
      const color     = palette[idx % palette.length];

      return {
        word:     w.word,
        isSpoken,
        isActive,
        color,
      };
    });
  };

  const currentPreset = CLIPERG_STYLES.find((s) => s.id === style) || CLIPERG_STYLES[0];

  const handleDragStop = (_: any, d: { x: number; y: number }) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setRndPos({ x: d.x, y: d.y });
    setPositionPct({
      x: Math.round(((d.x + rndSize.width  / 2) / rect.width)  * 100),
      y: Math.round(((d.y + rndSize.height / 2) / rect.height) * 100),
    });
  };

  const setPresetY = (pct: number) => {
    setPositionPct((prev) => ({ ...prev, y: pct }));
  };

  const handleRender = async () => {
    setIsRendering(true);
    try {
      const res = await axios.post(`${apiBaseUrl}/api/render`, {
        session_id:  sessionId,
        clip_id:     clip.clip_id,
        style:       style,
        font_size:   fontSize * 2.5,   // scaled for 1080p canvas
        pos_x_pct:   positionPct.x,
        pos_y_pct:   positionPct.y,
        hook_title:  enableHook ? hookTitle : null,
        chunk_size:  chunkSize,
      });

      const url = `${apiBaseUrl}${res.data.download_url}`;
      setDownloadUrl(url);

      // Auto trigger download
      const a = document.createElement("a");
      a.href = url;
      a.download = `cliperg_${clip.clip_id}_rendered.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Render failed:", err);
      alert("Render failed. Please check FastAPI backend logs.");
    } finally {
      setIsRendering(false);
    }
  };

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="glass fade-up shadow-2xl max-w-6xl w-full mx-auto overflow-hidden border-purple-500/25">
      {/* ── Cliperg Studio Header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-600/30">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">Cliperg Studio</h3>
              <span className="badge badge-purple text-[10px]">1080p 9:16</span>
              <span className="badge badge-amber text-[10px]">{clip.hook_score}% Viral</span>
            </div>
            <p className="text-[11px] text-neutral-400 line-clamp-1">{selectedTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white text-xs font-semibold transition"
            >
              Done
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
        {/* ── 9:16 Interactive Canvas Preview ────────────────────────────── */}
        <div className="lg:col-span-5 flex flex-col items-center p-6 gap-4 bg-black/25">
          <div
            ref={containerRef}
            className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl select-none"
            style={{ width: 300, height: 533, background: "#050508" }}
          >
            {/* 9:16 Video Player */}
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

            {/* Optional On-Screen Top Hook Banner */}
            {enableHook && hookTitle && (
              <div className="absolute top-7 inset-x-3 z-20 flex justify-center pointer-events-none">
                <div className="px-3.5 py-1.5 rounded-lg bg-black/85 border border-white/15 text-white text-center shadow-xl backdrop-blur-md">
                  <span className="text-xs font-black tracking-wide uppercase font-sans text-amber-300">
                    {hookTitle}
                  </span>
                </div>
              </div>
            )}

            {/* Draggable & Resizable Caption Box */}
            <Rnd
              bounds="parent"
              position={rndPos}
              size={rndSize}
              onDragStop={handleDragStop}
              onResizeStop={(_e, _dir, ref, _delta, pos) => {
                setRndSize({ width: parseInt(ref.style.width), height: parseInt(ref.style.height) });
                setRndPos(pos);
              }}
              className="z-20 flex items-center justify-center p-2 rounded-lg border border-dashed border-purple-400/50 bg-black/20 backdrop-blur-[2px] cursor-move hover:border-purple-400 transition"
            >
              <div
                className="flex flex-wrap items-center justify-center gap-x-2 text-center transition-all"
                style={{ fontSize: `${fontSize}px`, lineHeight: 1.15 }}
              >
                {getDisplayWords().map((item, i) => (
                  <span
                    key={i}
                    style={{
                      color: item.isSpoken ? item.color : "rgba(255, 255, 255, 0.9)",
                      textShadow: item.isSpoken
                        ? "0 3px 0 #000, 0 -3px 0 #000, 3px 0 0 #000, -3px 0 0 #000, 0 4px 14px rgba(0,0,0,0.85)"
                        : "0 3px 0 #000, 0 -3px 0 #000, 3px 0 0 #000, -3px 0 0 #000",
                    }}
                    className={`inline-block transition-transform duration-100 uppercase tracking-wider font-black ${
                      item.isActive ? "scale-115 drop-shadow-[0_0_14px_rgba(255,255,255,0.45)]" : "scale-100"
                    }`}
                  >
                    {item.word}
                  </span>
                ))}
              </div>
            </Rnd>

            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/30 transition group z-10"
            >
              <div className="w-12 h-12 rounded-full bg-black/70 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl group-hover:scale-110 transition">
                {playing ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
              </div>
            </button>
          </div>

          {/* Timeline slider */}
          <div className="w-[300px] flex items-center gap-3 text-xs text-neutral-400 font-mono">
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

          <p className="text-[11px] text-neutral-500 text-center w-[300px]">
            💡 Drag &amp; resize the caption box anywhere on video. Burns at exact coordinates.
          </p>
        </div>

        {/* ── Cliperg Quick Edit Rail (Right Side) ─────────────────────────── */}
        <div className="lg:col-span-7 p-6 flex flex-col justify-between space-y-6">
          <div>
            {/* Rail Tabs */}
            <div className="flex items-center gap-2 pb-4 border-b border-white/10 mb-6">
              {[
                { id: "styles", label: "Text Styles", icon: Type },
                { id: "titles", label: "Ready Titles & Hooks", icon: Flame },
                { id: "tuning", label: "Fine-Tune", icon: Sliders },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                      isActive
                        ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25"
                        : "bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* ── TAB 1: CLIPERG TEXT STYLES ───────────────────────────────── */}
            {activeTab === "styles" && (
              <div className="space-y-4 fade-up">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                    Select Caption Aesthetic ({CLIPERG_STYLES.length} Viral Presets)
                  </p>
                  <span className="text-[11px] text-purple-400 font-semibold">Karaoke Word-Sync</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CLIPERG_STYLES.map((preset) => {
                    const isSelected = style === preset.id;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => setStyle(preset.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "border-purple-500 bg-purple-950/25 shadow-[0_0_20px_rgba(139,92,246,0.2)] scale-[1.02]"
                            : "border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm text-white">{preset.name}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${preset.badgeCls}`}>
                            {preset.creator}
                          </span>
                        </div>

                        {/* Live mini preview */}
                        <div className="p-2.5 rounded-lg bg-black/60 border border-white/5 mb-2 text-center overflow-hidden">
                          <span className={`text-xs ${preset.baseCls}`}>SAMPLE </span>
                          <span className={`text-xs ${preset.activeCls}`}>CAPTION</span>
                        </div>

                        <p className="text-[11px] text-neutral-400 leading-snug line-clamp-2">
                          {preset.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── TAB 2: READY-MADE TITLES & SOCIAL HOOKS ──────────────────── */}
            {activeTab === "titles" && (
              <div className="space-y-5 fade-up">
                {/* On-screen hook banner toggle */}
                <div className="glass p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>On-Screen Top Hook Badge</span>
                    </label>
                    <input
                      type="checkbox"
                      checked={enableHook}
                      onChange={(e) => setEnableHook(e.target.checked)}
                      className="w-4 h-4 accent-purple-500 cursor-pointer"
                    />
                  </div>
                  {enableHook && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={hookTitle}
                        onChange={(e) => setHookTitle(e.target.value)}
                        placeholder="e.g. WAIT FOR THE END 🤯"
                        className="flex-1 bg-black/60 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                      <button
                        onClick={() => setHookTitle("WAIT FOR IT 🤯")}
                        className="text-[10px] px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-neutral-400"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>

                {/* Viral title options (Ready-made angles) */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                    Pick Ready-Made Title (AI Generated Angles)
                  </p>
                  <div className="space-y-2">
                    {(clip.hook_options || [clip.viral_title]).map((t, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedTitle(t)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition ${
                          selectedTitle === t
                            ? "border-purple-500 bg-purple-950/20 text-white font-bold"
                            : "border-white/10 bg-white/5 text-neutral-300 hover:border-white/20"
                        }`}
                      >
                        <span className="line-clamp-1">{t}</span>
                        {selectedTitle === t && <Check className="w-4 h-4 text-purple-400 shrink-0 ml-2" />}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ready-made Platform Copy */}
                <div className="space-y-2.5 pt-2">
                  <p className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-purple-400" />
                    <span>One-Click Social Media Distribution</span>
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* YouTube Shorts */}
                    {clip.youtube_title && (
                      <div className="p-3 rounded-xl bg-red-950/20 border border-red-900/30 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold text-red-400 flex items-center gap-1">
                            <Youtube className="w-3 h-3" /> YouTube Shorts
                          </span>
                          <button
                            onClick={() => copyText("yt", `${clip.youtube_title}\n\n${clip.youtube_description || ""}`)}
                            className="text-[10px] text-neutral-400 hover:text-white flex items-center gap-1"
                          >
                            {copiedKey === "yt" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === "yt" ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                        <p className="text-xs text-white line-clamp-1 font-semibold">{clip.youtube_title}</p>
                      </div>
                    )}

                    {/* TikTok */}
                    {clip.tiktok_title && (
                      <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-900/30 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold text-cyan-400">🎵 TikTok Hook</span>
                          <button
                            onClick={() => copyText("tt", clip.tiktok_title || "")}
                            className="text-[10px] text-neutral-400 hover:text-white flex items-center gap-1"
                          >
                            {copiedKey === "tt" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === "tt" ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                        <p className="text-xs text-white line-clamp-1">{clip.tiktok_title}</p>
                      </div>
                    )}

                    {/* Instagram Reels */}
                    {clip.reels_title && (
                      <div className="p-3 rounded-xl bg-pink-950/20 border border-pink-900/30 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold text-pink-400">📸 Instagram Reels</span>
                          <button
                            onClick={() => copyText("reels", clip.reels_title || "")}
                            className="text-[10px] text-neutral-400 hover:text-white flex items-center gap-1"
                          >
                            {copiedKey === "reels" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === "reels" ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                        <p className="text-xs text-white line-clamp-1">{clip.reels_title}</p>
                      </div>
                    )}

                    {/* Twitter / X */}
                    {clip.tweet_text && (
                      <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-900/30 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold text-blue-400">🐦 X / Twitter Thread</span>
                          <button
                            onClick={() => copyText("tweet", clip.tweet_text || "")}
                            className="text-[10px] text-neutral-400 hover:text-white flex items-center gap-1"
                          >
                            {copiedKey === "tweet" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === "tweet" ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                        <p className="text-xs text-white line-clamp-1">{clip.tweet_text}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 3: FINE-TUNE STYLING ─────────────────────────────────── */}
            {activeTab === "tuning" && (
              <div className="space-y-5 fade-up">
                {/* Font Size */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Font Size</span>
                    <span className="font-mono text-purple-400 text-xs">{fontSize}px</span>
                  </div>
                  <input
                    type="range" min={18} max={48} value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                {/* Words Per Line / Chunking */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Words Per Line</span>
                    <span className="font-mono text-purple-400 text-xs">{chunkSize} words</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { num: 1, label: "1 Word", desc: "Rapid-fire pop" },
                      { num: 3, label: "3 Words", desc: "Punchy short phrase" },
                      { num: 5, label: "5 Words", desc: "Full sentence line" },
                    ].map((c) => (
                      <button
                        key={c.num}
                        onClick={() => setChunkSize(c.num)}
                        className={`p-2.5 rounded-xl border text-center transition ${
                          chunkSize === c.num
                            ? "border-purple-500 bg-purple-950/30 text-white font-bold"
                            : "border-white/10 bg-white/5 text-neutral-400 hover:text-white"
                        }`}
                      >
                        <div className="text-xs font-bold">{c.label}</div>
                        <div className="text-[10px] opacity-60">{c.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Position Presets */}
                <div>
                  <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider block mb-2">
                    Vertical Position
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { y: 30, label: "Top (30%)" },
                      { y: 50, label: "Middle (50%)" },
                      { y: 80, label: "Lower (80%)" },
                    ].map((pos) => (
                      <button
                        key={pos.y}
                        onClick={() => setPresetY(pos.y)}
                        className={`py-2 rounded-xl border text-xs font-medium transition ${
                          positionPct.y === pos.y
                            ? "border-purple-500 bg-purple-950/30 text-white"
                            : "border-white/10 bg-white/5 text-neutral-400 hover:text-white"
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Action Footers ────────────────────────────────────────────── */}
          <div className="space-y-3 pt-4 border-t border-white/10">
            {/* Primary Render Button */}
            <button
              onClick={handleRender}
              disabled={isRendering}
              className="w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:brightness-110 active:scale-98 text-white font-bold rounded-xl flex items-center justify-center gap-2.5 transition shadow-2xl shadow-purple-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRendering ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Hardcoding 1080p Captions with FFmpeg…</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>Render &amp; Download Final 1080p MP4</span>
                </>
              )}
            </button>

            {/* Direct download secondary buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <a
                href={`${apiBaseUrl}/api/download/clip/${sessionId}/${clip.clip_id}`}
                download={`clip_${clip.clip_id}.mp4`}
                className="py-2.5 border border-purple-700/40 bg-purple-950/20 hover:bg-purple-900/30 text-purple-300 font-semibold rounded-xl flex items-center justify-center gap-1.5 text-xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                Raw 9:16 Video
              </a>

              <a
                href={`${apiBaseUrl}/api/captions/${sessionId}/clip/${clip.clip_id}`}
                download={`clip_${clip.clip_id}.srt`}
                className="py-2.5 border border-emerald-700/40 bg-emerald-950/20 hover:bg-emerald-900/30 text-emerald-400 font-semibold rounded-xl flex items-center justify-center gap-1.5 text-xs transition"
              >
                <FileText className="w-3.5 h-3.5" />
                SRT Subtitles
              </a>
            </div>

            {downloadUrl && (
              <div className="p-3 bg-emerald-950/30 border border-emerald-700/30 rounded-xl flex items-center justify-between text-xs text-emerald-400 fade-up">
                <span className="flex items-center gap-1.5 font-medium">
                  <Check className="w-4 h-4" /> 1080p Export Finished &amp; Downloaded!
                </span>
                <a href={downloadUrl} download className="underline hover:text-emerald-300 font-bold shrink-0">
                  Download again
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
