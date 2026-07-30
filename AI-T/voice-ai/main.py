"""
voice-ai/main.py — Prosody Analysis Sidecar (Lightweight, No ML Model)

Extracts pitch, energy, speaking pace, and hesitation metrics from audio.
Does NOT load any ML model — uses only librosa + parselmouth for signal processing.
Typical RSS: ~80-120 MB.

To upgrade to emotion classification later (requires t3.medium / 4GB+):
  1. Add torch (CPU) and transformers to requirements.txt
  2. Uncomment the emotion model loading in the lifespan handler
  3. Uncomment the predict_emotion call in analyze_voice
  4. Model recommendation: superb/wav2vec2-base-superb-er (~360MB, 4 emotion classes)
"""

import os
import tempfile
import logging

import librosa
import numpy as np
import parselmouth
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voice-ai")

MIN_DURATION_SEC = 1.0  # Below this, prosody extraction is unreliable — skip

app = FastAPI(title="SalesCoach Voice AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def extract_prosody(path: str, y: np.ndarray, sr: int) -> dict:
    """Extract pitch, energy, duration, and pace from audio."""
    snd = parselmouth.Sound(path)
    pitch = snd.to_pitch()
    pitch_vals = pitch.selected_array["frequency"]
    pitch_vals = pitch_vals[pitch_vals > 0]  # Drop unvoiced frames

    rms = librosa.feature.rms(y=y)[0]
    duration = librosa.get_duration(y=y, sr=sr)

    # Detect pauses/hesitations: segments where RMS is below threshold
    silence_threshold = float(np.mean(rms) * 0.3)
    silent_frames = np.sum(rms < silence_threshold)
    total_frames = len(rms)
    pause_ratio = float(silent_frames / total_frames) if total_frames > 0 else 0.0

    return {
        "pitchMean": round(float(np.mean(pitch_vals)), 2) if len(pitch_vals) else 0.0,
        "pitchStd": round(float(np.std(pitch_vals)), 2) if len(pitch_vals) else 0.0,
        "pitchRange": round(float(np.max(pitch_vals) - np.min(pitch_vals)), 2) if len(pitch_vals) > 1 else 0.0,
        "energyMean": round(float(np.mean(rms)), 6),
        "energyStd": round(float(np.std(rms)), 6),
        "durationSec": round(float(duration), 2),
        "pauseRatio": round(pause_ratio, 3),
    }


@app.post("/analyze-voice")
async def analyze_voice(audio: UploadFile = File(...)):
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp.write(await audio.read())
            tmp_path = tmp.name

        y, sr = librosa.load(tmp_path, sr=16000)
        duration = librosa.get_duration(y=y, sr=sr)

        if duration < MIN_DURATION_SEC:
            return {
                "status": "skipped_too_short",
                "prosody": None,
                "emotion": None,
            }

        prosody = extract_prosody(tmp_path, y, sr)

        return {
            "status": "ok",
            "prosody": prosody,
            "emotion": None,  # Placeholder for future ML-based emotion classification
        }

    except Exception as e:
        logger.exception("analyze_voice failed")
        # Fail soft — the caller (Node backend) treats this as "no voice data"
        return {"status": "error", "error": str(e), "prosody": None, "emotion": None}
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.get("/health")
def health():
    return {"status": "ok", "mode": "prosody-only", "model_loaded": False}
