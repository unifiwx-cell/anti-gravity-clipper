# Anti-Gravity Clipper 🎬⚡

**Anti-Gravity Clipper** is a high-performance, full-stack AI web platform that converts long YouTube videos into 8 to 9 viral vertical shorts (9:16) with smart speaker-centering and customizable CapCut-style animated captions.

---

## 🏗️ Architecture Overview

- **Frontend**: Next.js 14 (App Router), Tailwind CSS (Dark Mode), Framer Motion, `react-rnd` (interactive caption positioning & scaling), Lucide Icons.
- **Backend API**: FastAPI (Python 3.10+), asynchronous task queue.
- **Audio & Transcription**: `yt-dlp` audio extraction + OpenAI Whisper (Word-level timestamps).
- **AI Hook Detection**: LLM (GPT-4o / Claude 3.5 Sonnet) context evaluation extracting 8-9 high-retention 30-60s segments.
- **Computer Vision**: OpenCV face detection with moving-average smoothing for speaker centering.
- **Video & Subtitle Engine**: FFmpeg + ASS (Advanced SubStation Alpha) word-by-word highlight subtitle burning.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+ & npm/pnpm**
- **FFmpeg** installed and accessible in your system PATH (`ffmpeg -version`).

### 2. Backend Setup (FastAPI)
```bash
cd backend
python -m venv venv

# On Windows:
venv\Scripts\activate
# On macOS/Linux:
# source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env and supply your OPENAI_API_KEY or ANTHROPIC_API_KEY

uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup (Next.js)
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
