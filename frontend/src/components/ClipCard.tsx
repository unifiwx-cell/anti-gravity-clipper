"use client";

import React, { useState } from "react";
import {
  Play, Flame, Clock, TrendingUp, TrendingDown, Minus,
  FileText, Download, Share2, Copy, Check, Sparkles, ChevronDown
} from "lucide-react";
import { Clip } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ClipCardProps {
  clip:       Clip;
  sessionId:  string;
  onSelect:   (clip: Clip) => void;
  isSelected?: boolean;
  index:       number;
}

const INTEREST_CONFIG = {
  high:   { icon: TrendingUp,   label: "High Virality", cls: "badge-green"  },
  medium: { icon: Minus,        label: "Moderate",      cls: "badge-blue"   },
  low:    { icon: TrendingDown, label: "Low",           cls: "badge-red"    },
};

export const ClipCard: React.FC<ClipCardProps> = ({
  clip, sessionId, onSelect, isSelected, index,
}) => {
  const [selectedTitle, setSelectedTitle] = useState(clip.viral_title);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showTitles, setShowTitles] = useState(false);

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

  const level   = clip.interest_level || "high";
  const intCfg  = INTEREST_CONFIG[level] ?? INTEREST_CONFIG.high;
  const IntIcon = intCfg.icon;

  const score = clip.hook_score ?? 88;
  const scoreColor =
    score >= 90 ? "text-emerald-400" :
    score >= 75 ? "text-amber-400"   : "text-neutral-400";

  const handleSrt = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement("a");
    link.href = `${API_BASE}/api/captions/${sessionId}/clip/${clip.clip_id}`;
    link.download = `clip_${clip.clip_id}.srt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadMp4 = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement("a");
    link.href = `${API_BASE}/api/download/clip/${sessionId}/${clip.clip_id}`;
    link.download = `clip_${clip.clip_id}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyText = (e: React.MouseEvent, key: string, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div
      onClick={() => onSelect(clip)}
      style={{ animationDelay: `${index * 60}ms` }}
      className={`
        fade-up glow-hover glass cursor-pointer flex flex-col justify-between overflow-hidden
        transition-all duration-300
        ${isSelected
          ? "border-purple-500/80 shadow-[0_0_0_1px_rgba(139,92,246,.6),0_12px_45px_rgba(139,92,246,.25)] scale-[1.02]"
          : "hover:border-purple-500/40"}
      `}
    >
      {/* Top Gradient Virality Bar */}
      <div
        className="h-1 w-full"
        style={{
          background: `linear-gradient(90deg, #ec4899 0%, #8b5cf6 ${score}%, rgba(255,255,255,.05) ${score}%)`,
        }}
      />

      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Badges row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="badge badge-amber font-mono">
              <Flame className="w-3 h-3 text-amber-400" />
              <span className={`font-bold ${scoreColor}`}>{score}% Virality</span>
            </div>
            {clip.category && (
              <span className="badge badge-purple text-[10px] uppercase">
                {clip.category}
              </span>
            )}
          </div>

          <div className={`badge ${intCfg.cls}`}>
            <IntIcon className="w-3 h-3" />
            <span>{intCfg.label}</span>
          </div>
        </div>

        {/* On-screen hook banner preview */}
        {clip.on_screen_hook && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] font-black uppercase text-amber-300 tracking-wide w-fit">
            <span>HOOK:</span>
            <span>{clip.on_screen_hook}</span>
          </div>
        )}

        {/* Primary Selected Title */}
        <h4 className="text-[15px] font-bold text-white leading-snug line-clamp-2 group-hover:text-purple-300 transition">
          {selectedTitle}
        </h4>

        {/* Ready-made title options dropdown toggle */}
        {clip.hook_options && clip.hook_options.length > 1 && (
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowTitles(!showTitles)}
              className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 transition"
            >
              <span>{clip.hook_options.length} Ready Titles</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showTitles ? "rotate-180" : ""}`} />
            </button>

            {showTitles && (
              <div className="mt-2 space-y-1 p-2 rounded-xl bg-black/90 border border-white/15 text-xs z-30 shadow-2xl">
                {clip.hook_options.map((opt, i) => (
                  <div
                    key={i}
                    onClick={() => { setSelectedTitle(opt); setShowTitles(false); }}
                    className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition ${
                      selectedTitle === opt ? "bg-purple-600/30 text-white font-bold" : "text-neutral-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="line-clamp-1">{opt}</span>
                    {selectedTitle === opt && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0 ml-2" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Description / Summary */}
        <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
          {clip.description}
        </p>

        {/* Quick Copy Social Titles Bar */}
        <div className="flex items-center gap-2 pt-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {clip.youtube_title && (
            <button
              onClick={(e) => copyText(e, "yt", clip.youtube_title || "")}
              title="Copy YouTube Shorts Title"
              className="px-2 py-1 rounded-md bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-[10px] text-red-300 font-semibold flex items-center gap-1 transition"
            >
              {copiedKey === "yt" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>YT Title</span>
            </button>
          )}

          {clip.tiktok_title && (
            <button
              onClick={(e) => copyText(e, "tt", clip.tiktok_title || "")}
              title="Copy TikTok Hook"
              className="px-2 py-1 rounded-md bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/40 text-[10px] text-cyan-300 font-semibold flex items-center gap-1 transition"
            >
              {copiedKey === "tt" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>TikTok</span>
            </button>
          )}

          {clip.reels_title && (
            <button
              onClick={(e) => copyText(e, "reels", clip.reels_title || "")}
              title="Copy Instagram Reels Caption"
              className="px-2 py-1 rounded-md bg-pink-950/40 hover:bg-pink-900/60 border border-pink-800/40 text-[10px] text-pink-300 font-semibold flex items-center gap-1 transition"
            >
              {copiedKey === "reels" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>Reels</span>
            </button>
          )}
        </div>

        {/* AI Insight */}
        {clip.reasoning && (
          <p className="text-[11px] text-neutral-500 italic line-clamp-1 pt-1 border-t border-white/5">
            ⚡ {clip.reasoning}
          </p>
        )}
      </div>

      {/* Card Footer Actions */}
      <div className="px-5 py-3.5 bg-black/40 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-neutral-400 text-xs font-mono">
          <Clock className="w-3 h-3 text-neutral-500" />
          <span>{fmt(clip.start_time)} – {fmt(clip.end_time)}</span>
          <span className="text-neutral-600">·</span>
          <span>{Math.round(clip.duration)}s</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Direct 9:16 MP4 Download */}
          <button
            type="button"
            onClick={handleDownloadMp4}
            title="Download Vertical MP4 (1080p)"
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-purple-600/30 text-neutral-300 hover:text-white transition flex items-center gap-1 text-xs font-semibold border border-white/10"
          >
            <Download className="w-3 h-3 text-purple-400" />
            <span>MP4</span>
          </button>

          {/* Direct SRT Subtitles Download */}
          <button
            type="button"
            onClick={handleSrt}
            title="Download SRT Subtitles"
            className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-emerald-600/30 text-neutral-300 hover:text-emerald-300 transition flex items-center gap-1 text-xs font-semibold border border-white/10"
          >
            <FileText className="w-3 h-3 text-emerald-400" />
            <span>SRT</span>
          </button>

          {/* Open Cliphi Studio Editor */}
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition flex items-center gap-1.5 text-xs font-bold shadow-lg shadow-purple-600/25"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Edit</span>
          </button>
        </div>
      </div>
    </div>
  );
};
