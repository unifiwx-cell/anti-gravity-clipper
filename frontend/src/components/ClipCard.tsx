"use client";

import React from "react";
import { Play, Flame, Clock, TrendingUp, TrendingDown, Minus, FileText } from "lucide-react";
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
  high:   { icon: TrendingUp,   label: "High Interest",   cls: "badge-green"  },
  medium: { icon: Minus,        label: "Medium Interest", cls: "badge-blue"   },
  low:    { icon: TrendingDown, label: "Low Interest",    cls: "badge-red"    },
};

export const ClipCard: React.FC<ClipCardProps> = ({
  clip, sessionId, onSelect, isSelected, index,
}) => {
  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

  const level     = clip.interest_level || "high";
  const intCfg    = INTEREST_CONFIG[level] ?? INTEREST_CONFIG.high;
  const IntIcon   = intCfg.icon;

  const score = clip.hook_score ?? 0;
  const scoreColor =
    score >= 90 ? "text-emerald-400" :
    score >= 75 ? "text-amber-400"   : "text-neutral-400";

  const handleSrt = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`${API_BASE}/api/captions/${sessionId}/clip/${clip.clip_id}`, "_blank");
  };

  return (
    <div
      onClick={() => onSelect(clip)}
      style={{ animationDelay: `${index * 60}ms` }}
      className={`
        fade-up glow-hover glass cursor-pointer flex flex-col overflow-hidden
        transition-all duration-300
        ${isSelected
          ? "border-purple-500/60 shadow-[0_0_0_1px_rgba(139,92,246,.5),0_8px_40px_rgba(139,92,246,.15)] scale-[1.02]"
          : ""}
      `}
    >
      {/* Score bar at top */}
      <div
        className="h-0.5 w-full"
        style={{
          background: `linear-gradient(90deg, #8b5cf6 ${score}%, rgba(255,255,255,.05) ${score}%)`,
        }}
      />

      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Badges row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className={`badge badge-amber`}>
            <Flame className="w-3 h-3" />
            <span className={`font-mono ${scoreColor}`}>{score}% viral</span>
          </div>
          <div className={`badge ${intCfg.cls}`}>
            <IntIcon className="w-3 h-3" />
            <span>{intCfg.label}</span>
          </div>
        </div>

        {/* Title */}
        <h4 className="text-[15px] font-bold text-white leading-snug line-clamp-2 group-hover:text-purple-300">
          {clip.viral_title}
        </h4>

        {/* YouTube title preview */}
        {clip.youtube_title && (
          <p className="text-[11px] text-indigo-400/80 font-medium line-clamp-1 italic">
            🔴 {clip.youtube_title}
          </p>
        )}

        {/* Description */}
        <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed flex-1">
          {clip.description}
        </p>

        {/* Tags */}
        {clip.youtube_tags && clip.youtube_tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {clip.youtube_tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950/50 border border-purple-800/30 text-purple-400"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Reasoning */}
        {clip.reasoning && (
          <p className="text-[11px] text-neutral-500 italic line-clamp-1">
            💡 {clip.reasoning}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-black/30 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-neutral-500 text-xs font-mono">
          <Clock className="w-3 h-3" />
          <span>{fmt(clip.start_time)} – {fmt(clip.end_time)}</span>
          <span className="text-neutral-700">·</span>
          <span>{Math.round(clip.duration)}s</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSrt}
            title="Download SRT captions"
            className="text-neutral-600 hover:text-emerald-400 transition flex items-center gap-1 text-xs"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>SRT</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 transition text-xs font-semibold"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Edit &amp; Render</span>
          </button>
        </div>
      </div>
    </div>
  );
};
