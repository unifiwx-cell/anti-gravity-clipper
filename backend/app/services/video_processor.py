"""
video_processor.py — Anti-Gravity Clipper
Speaker-centred 9:16 vertical crop with smooth linear camera pan.

Key design choices
──────────────────
1.  YuNet neural face detector → Haar cascade fallback → frame centre fallback.
2.  Positions are sampled every 1.5 s across the clip, then smoothed with EMA.
3.  If the speaker shifts > 40 px, FFmpeg executes a single linear lerp pan
    from the first smoothed position to the last.  The lerp expression is
    proven to work with FFmpeg 9.x:
        x='X0+(X1-X0)*min(1\,max(0\,t/D))'
    No nested if/then chains — those fail with "No option name near '0'".
4.  FFmpeg is located via PATH (injected by config.py) then winget glob fallback.
"""

import cv2
import subprocess
import numpy as np
import shutil
import urllib.request
from pathlib import Path
from typing import List, Tuple, Optional
from app.config import settings


class VideoProcessor:
    def __init__(self, clips_dir: Path = settings.CLIPS_DIR):
        self.clips_dir = clips_dir
        self.yunet_model_path = settings.STORAGE_DIR / "face_detection_yunet.onnx"
        self._init_face_detector()

    # ── Initialisation ────────────────────────────────────────────────────────

    def _init_face_detector(self):
        """Download YuNet ONNX model (230 KB) if missing, then warm-up detectors."""
        self.detector_available = False
        try:
            if not self.yunet_model_path.exists():
                url = (
                    "https://github.com/opencv/opencv_zoo/raw/main/models/"
                    "face_detection_yunet/face_detection_yunet_2023mar.onnx"
                )
                urllib.request.urlretrieve(url, str(self.yunet_model_path))
            self.detector_available = True
        except Exception as e:
            print(f"[VideoProcessor] YuNet model unavailable: {e}")

        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        self.face_cascade = cv2.CascadeClassifier(cascade_path)

    def _get_ffmpeg_path(self) -> str:
        """Return absolute path to ffmpeg binary."""
        # config.py already prepends the winget ffmpeg dir to PATH at startup
        found = shutil.which("ffmpeg")
        if found:
            return found
        # Secondary search: winget install root
        local_app = settings.BASE_DIR.drive or "C:"
        candidates = list(
            Path(local_app + "\\").glob(
                "Users/*/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg*/ffmpeg-*/bin/ffmpeg.exe"
            )
        )
        if candidates:
            return str(candidates[0])
        return "ffmpeg"  # last-resort: hope it's on PATH

    # ── Face detection helpers ────────────────────────────────────────────────

    def _detect_face_center_x(
        self,
        frame: np.ndarray,
        yunet: Optional[object],
        frame_center_x: float,
        frame_width: int,
    ) -> float:
        """Return the X centre of the most prominent face in *frame*, or frame_center_x."""
        # 1. YuNet neural detector
        if yunet is not None:
            try:
                _, faces = yunet.detect(frame)
                if faces is not None and len(faces) > 0:
                    scored = []
                    for f in faces:
                        fx, fy, fw, fh = float(f[0]), float(f[1]), float(f[2]), float(f[3])
                        cx = fx + fw / 2.0
                        area = fw * fh
                        # Prefer large faces near the previous centre (frame_center_x)
                        centre_penalty = abs(cx - frame_center_x) / frame_width
                        scored.append((area / (1.0 + centre_penalty), cx))
                    scored.sort(reverse=True)
                    return scored[0][1]
            except Exception:
                pass

        # 2. Haar cascade fallback
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, 1.15, 4, minSize=(50, 50))
        if len(faces) > 0:
            scored = []
            for (fx, fy, fw, fh) in faces:
                cx = float(fx + fw / 2.0)
                area = fw * fh
                centre_penalty = abs(cx - frame_center_x) / frame_width
                scored.append((area / (1.0 + centre_penalty), cx))
            scored.sort(reverse=True)
            return scored[0][1]

        return frame_center_x

    # ── Public API ────────────────────────────────────────────────────────────

    def extract_clip_9_16(
        self,
        source_video: Path,
        clip_id: str,
        start_time: float,
        end_time: float,
    ) -> Path:
        """
        Extract a 9:16 vertical clip from *source_video* centred on the speaker.

        If the speaker moves more than 40 px horizontally across the clip, the
        crop window smoothly pans from the detected start position to the end
        position using a single linear lerp FFmpeg expression (no nested ifs).
        """
        output_path = self.clips_dir / f"clip_{clip_id}.mp4"
        duration = max(1.0, end_time - start_time)

        # ── Read source dimensions ────────────────────────────────────────────
        cap = cv2.VideoCapture(str(source_video))
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {source_video}")

        src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        # 9:16 crop window (portrait)
        crop_h = src_h
        crop_w = int(crop_h * 9 / 16)
        if crop_w % 2:
            crop_w -= 1   # must be even for h264

        max_x = max(0, src_w - crop_w)
        frame_cx = src_w / 2.0

        # ── Initialise YuNet for this video's resolution ──────────────────────
        yunet: Optional[object] = None
        if self.detector_available and self.yunet_model_path.exists():
            try:
                yunet = cv2.FaceDetectorYN.create(
                    str(self.yunet_model_path),
                    "",
                    (src_w, src_h),
                    score_threshold=0.55,
                    nms_threshold=0.3,
                )
            except Exception as e:
                print(f"[VideoProcessor] YuNet init failed: {e}")

        # ── Sample speaker X positions every ~1.5 s ───────────────────────────
        sample_times: List[float] = list(np.arange(0.5, duration, 1.5))
        if not sample_times:
            sample_times = [duration / 2.0]

        raw_centers: List[Tuple[float, float]] = []  # (rel_t, center_x_px)
        prev_cx = frame_cx

        for rel_t in sample_times:
            abs_ms = (start_time + rel_t) * 1000
            cap.set(cv2.CAP_PROP_POS_MSEC, abs_ms)
            ret, frame = cap.read()
            if not ret:
                raw_centers.append((rel_t, prev_cx))
                continue
            cx = self._detect_face_center_x(frame, yunet, prev_cx, src_w)
            raw_centers.append((rel_t, cx))
            prev_cx = cx

        cap.release()

        if not raw_centers:
            raw_centers = [(0.0, frame_cx)]

        # ── EMA smoothing: reduce jitter while preserving real movement ────────
        alpha = 0.50          # 0 = never moves, 1 = fully responsive
        smooth_cx = raw_centers[0][1]
        smoothed: List[Tuple[float, float]] = []  # (rel_t, crop_x)

        for rel_t, raw_cx in raw_centers:
            smooth_cx = alpha * raw_cx + (1.0 - alpha) * smooth_cx
            # Convert face centre → top-left crop X, clamped to valid range
            crop_x = int(smooth_cx - crop_w / 2.0)
            crop_x = max(0, min(crop_x, max_x))
            smoothed.append((rel_t, crop_x))

        # ── Decide: static crop or smooth pan ────────────────────────────────
        xs = [p[1] for p in smoothed]
        x_range = max(xs) - min(xs)
        ffmpeg = self._get_ffmpeg_path()

        if x_range > 40 and len(smoothed) > 1:
            # Single linear lerp from first detected position → last detected position.
            # This pan spans the full clip duration and is 100% compatible with FFmpeg 9.x.
            x0 = smoothed[0][1]
            x1 = smoothed[-1][1]
            # Clamp both endpoints
            x0 = max(0, min(x0, max_x))
            x1 = max(0, min(x1, max_x))
            D  = round(duration, 3)

            # Proven FFmpeg 9 expression — no nested if/else, just min/max clamping:
            #   lerp(x0, x1, t/D)  clamped to [0, max_x]
            lerp_expr = f"{x0}+({x1}-{x0})*min(1\\,max(0\\,t/{D}))"
            x_expr    = f"min({max_x}\\,max(0\\,{lerp_expr}))"
            vf        = f"crop={crop_w}:{crop_h}:x='{x_expr}':y=0"

            print(f"[VideoProcessor] clip={clip_id} | pan {x0}→{x1} px over {D}s")
        else:
            # Speaker stationary — use median position for rock-solid framing
            stable_x = int(np.median(xs))
            stable_x = max(0, min(stable_x, max_x))
            vf = f"crop={crop_w}:{crop_h}:{stable_x}:0"
            print(f"[VideoProcessor] clip={clip_id} | static crop x={stable_x}")

        # ── FFmpeg crop ───────────────────────────────────────────────────────
        cmd = [
            ffmpeg, "-y",
            "-ss", str(start_time),
            "-i",  str(source_video),
            "-t",  str(duration),
            "-vf", vf,
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "22",
            "-c:a", "aac",
            "-b:a", "128k",
            str(output_path),
        ]

        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

        if result.returncode != 0:
            print(f"[VideoProcessor] FFmpeg error ({result.stderr[-300:]}), falling back to centre crop")
            centre_x = max(0, min(int((src_w - crop_w) / 2), max_x))
            cmd_fb = [
                ffmpeg, "-y",
                "-ss", str(start_time),
                "-i",  str(source_video),
                "-t",  str(duration),
                "-vf", f"crop={crop_w}:{crop_h}:{centre_x}:0",
                "-c:v", "libx264", "-preset", "fast", "-crf", "22",
                "-c:a", "aac", "-b:a", "128k",
                str(output_path),
            ]
            subprocess.run(cmd_fb, check=True)

        return output_path
