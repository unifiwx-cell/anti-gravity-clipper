"use client";

import React, { useState, useRef, useCallback } from "react";
import { Zap, Link2, Loader2, Sparkles } from "lucide-react";

interface UrlInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export const UrlInput: React.FC<UrlInputProps> = ({ onSubmit, isLoading }) => {
  const [url, setUrl] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = url.trim();
      if (!trimmed || isLoading) return;
      onSubmit(trimmed);
    },
    [url, isLoading, onSubmit]
  );

  const isValid = url.includes("youtube.com") || url.includes("youtu.be");

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div
        className={`relative flex items-center rounded-2xl transition-all duration-300 ${
          focused
            ? "shadow-[0_0_0_2px_rgba(139,92,246,.6),0_8px_40px_rgba(139,92,246,.2)]"
            : "shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
        }`}
        style={{ background: "rgba(15,15,22,.95)" }}
      >
        {/* YouTube icon */}
        <div className="pl-5 pr-3 shrink-0">
          <Link2
            className={`w-5 h-5 transition-colors ${
              isValid ? "text-purple-400" : "text-neutral-600"
            }`}
          />
        </div>

        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Paste a YouTube link…  e.g. https://youtu.be/dQw4w9WgXcQ"
          className="flex-1 bg-transparent py-4 pr-4 text-sm text-white placeholder:text-neutral-600 focus:outline-none"
          disabled={isLoading}
        />

        <div className="pr-2">
          <button
            type="submit"
            disabled={!url.trim() || isLoading}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
              !url.trim() || isLoading
                ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/30 hover:scale-[1.03] active:scale-95"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing…</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Generate Clips</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Helper chips */}
      <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
        {["Podcast", "Interview", "Tutorial", "Speech", "Debate"].map((tag) => (
          <span
            key={tag}
            className="text-[11px] px-2.5 py-1 rounded-full border border-neutral-800 text-neutral-500 bg-neutral-950"
          >
            {tag}
          </span>
        ))}
        <span className="text-[11px] text-neutral-700">works great with</span>
      </div>
    </form>
  );
};
