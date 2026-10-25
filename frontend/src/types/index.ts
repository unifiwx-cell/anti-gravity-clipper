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
  youtube_title?:        string;
  description:           string;
  youtube_description?:  string;
  youtube_tags?:         string[];
  hook_score:            number;
  interest_level?:       "high" | "medium" | "low";
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
  error?:           string;
}

export type CaptionStyle = "hormozi" | "glowing" | "typewriter";

export interface CaptionConfig {
  style:    CaptionStyle;
  fontSize: number;
  xPercent: number;
  yPercent: number;
}
