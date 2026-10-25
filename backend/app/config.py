import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Anti-Gravity Clipper API"
    ENVIRONMENT: str = "development"
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    STORAGE_DIR: Path = BASE_DIR / "storage"
    DOWNLOADS_DIR: Path = STORAGE_DIR / "downloads"
    CLIPS_DIR: Path = STORAGE_DIR / "clips"
    RENDERS_DIR: Path = STORAGE_DIR / "renders"

    class Config:
        env_file = ".env"

settings = Settings()

# Automatically discover and add FFmpeg to PATH if installed via winget
ffmpeg_candidates = list(Path(os.environ.get("LOCALAPPDATA", "")).glob("Microsoft/WinGet/Packages/Gyan.FFmpeg*/**/ffmpeg.exe"))
if ffmpeg_candidates:
    ffmpeg_dir = str(ffmpeg_candidates[0].parent)
    if ffmpeg_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")

# Ensure directories exist
for path in [settings.STORAGE_DIR, settings.DOWNLOADS_DIR, settings.CLIPS_DIR, settings.RENDERS_DIR]:
    path.mkdir(parents=True, exist_ok=True)
