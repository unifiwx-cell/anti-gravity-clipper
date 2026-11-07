export interface WordTimestamp {
  word:  string;
  start: number;
  end:   number;
}

export interface Clip {
  clip_id:               number;
  start_time:            number;
  end_time:              number;
  duration:              number;
  viral_title:           string;
  on_screen_hook?:       string;
  hook_options?:         string[];
  youtube_title?:        string;
  tiktok_title?:         string;
  reels_title?:          string;
  tweet_text?:           string;
  description:           string;
  youtube_description?:  string;
  youtube_tags?:         string[];
  hook_score:            number;
  interest_level?:       "high" | "medium" | "low";
  category?:             string;
  reasoning:             string;
  video_url?:            string;
  words?:                WordTimestamp[];
}

export interface VideoAnalysis {
  overall_quality?:                string;
  best_moments?:                   string;
  weak_moments?:                   string;
  recommended_youtube_title?:      string;
  recommended_youtube_description?: string;
}

export interface VideoInfo {
  id?:          string;
  title?:       string;
  duration?:    number;
  thumbnail?:   string;
  uploader?:    string;
  view_count?:  number;
  description?: string;
}

export interface SessionStatus {
  id:               string;
  url:              string;
  status:           "queued" | "processing" | "completed" | "failed";
  stage:            string;
  progress:         number;
  clips:            Clip[];
  video_info:       VideoInfo;
  video_analysis?:  VideoAnalysis;
  created_at?:      string;
  error?:           string;
}

export interface ProjectSummary {
  id:          string;
  url:         string;
  title:       string;
  thumbnail:   string;
  duration:    number;
  status:      "queued" | "processing" | "completed" | "failed";
  progress:    number;
  clips_count: number;
  created_at:  string;
}

export type CaptionStyle = "multicolor" | "hormozi" | "beast" | "glowing" | "redalert" | "typewriter" | "minimal";

export interface CaptionConfig {
  style:         CaptionStyle;
  fontSize:      number;
  xPercent:      number;
  yPercent:      number;
  hookTitle?:    string;
  chunkSize?:    number;
  highlightColor?: string;
}
