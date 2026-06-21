"""
AI model helpers — env loading, OpenRouter client, and response generation.

Models are read from models.csv at import time so both the API and CLI share
the same list.
"""

import csv
import os
from pathlib import Path
from typing import Dict, List


# Project root (one level above this utils/ folder)
BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_PATH = BASE_DIR / "models.csv"
ENV_PATH = BASE_DIR / ".env"


def load_env_file() -> None:
    """
    Load key=value pairs from .env into os.environ.

    Existing environment variables are left unchanged (setdefault).
    """
    if not ENV_PATH.exists():
        return

    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


# Run once on import so API keys are available before any request
load_env_file()


def get_api_key() -> str:
    """Prefer OpenRouter; fall back to a plain OpenAI key if set."""
    return os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY") or ""


def get_client():
    """
    Build an OpenAI-compatible client pointed at OpenRouter.

    Raises ValueError when no API key is configured.
    """
    api_key = get_api_key()
    if not api_key:
        raise ValueError(
            "API key not found. Add OPENROUTER_API_KEY to your .env file, "
            "or set OPENAI_API_KEY as a fallback."
        )

    from openai import OpenAI

    return OpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
    )


def load_models() -> Dict[str, str]:
    """
    Read models.csv into a dict of {display name: model id}.

    Returns an empty dict on missing file or parse errors (with a console message).
    """
    try:
        with MODELS_PATH.open(newline="", encoding="utf-8") as file:
            reader = csv.DictReader(file)
            return {
                row["Model Name"].strip(): row["Model ID"].strip()
                for row in reader
                if row.get("Model Name") and row.get("Model ID")
            }
    except Exception as error:
        print(f"Error loading models: {error}")
        return {}


# Shared model catalog for api.py and cli.py
AVAILABLE_MODELS = load_models()


def generate_response(
    model_id: str,
    messages: List[Dict],
    temperature: float = 0.7,
    max_tokens: int = 1000,
) -> str:
    """
    Send messages to the selected model and return the assistant reply.

    On failure, returns a string starting with "Error generating response:"
    so callers (API vs CLI) can decide how to present the error.
    """
    try:
        client = get_client()
        response = client.chat.completions.create(
            extra_headers={
                # OpenRouter attribution headers
                "HTTP-Referer": "https://github.com/UTGyan7/VORTEX-AI",
                "X-Title": "VORTEX AI",
            },
            model=model_id,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content
    except Exception as error:
        print(f"Detailed error: {str(error)}")  # Helpful when debugging locally
        return f"Error generating response: {str(error)}"
