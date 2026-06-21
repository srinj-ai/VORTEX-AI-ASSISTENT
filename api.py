"""
FastAPI backend.

Serves the web UI, exposes model list and chat endpoints, and handles a few
local shortcuts (like opening allowed websites) before calling the AI provider.
"""

import os
import re
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from utils.ai_models import AVAILABLE_MODELS, generate_response


app = FastAPI(
    title="VORTEX AI API",
    description="Text chat API for VORTEX AI.",
    version="0.1.0",
)

# Static assets (HTML, CSS, JS) live under /static
app.mount("/static", StaticFiles(directory="web"), name="static")


# --- Request / response shapes ---


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    model: str
    messages: list[ChatMessage] = Field(min_length=1)
    temperature: float = Field(default=0.7, ge=0, le=2)
    max_tokens: int = Field(default=1000, ge=100, le=4000)


class ChatResponse(BaseModel):
    reply: str


# Sites the user can open with a plain-text command (e.g. "open youtube")
ALLOWED_WEBSITES = {
    "youtube": "https://www.youtube.com",
    "google": "https://www.google.com",
    "github": "https://github.com/srinj-ai/VORTEX-AI-ASSISTENT",
    "gmail": "https://mail.gmail.com",
    "chatgpt": "https://chatgpt.com",
}


def get_latest_user_message(messages: list[ChatMessage]) -> str:
    """Return the most recent user message, or an empty string if none exist."""
    for message in reversed(messages):
        if message.role == "user":
            return message.content.strip()
    return ""


def open_website_command(prompt: str) -> str | None:
    """
    If the prompt is an "open <site>" command, launch the site and return a reply.

    Returns None when the prompt is not an open command, so the caller can fall
    through to the AI model instead.
    """
    match = re.fullmatch(r"open\s+([a-z0-9 ._-]+)", prompt.lower())
    if not match:
        return None

    # Normalize "google mail" style names to a single lookup key
    site_name = match.group(1).strip().replace(" ", "")
    url = ALLOWED_WEBSITES.get(site_name)
    if not url:
        allowed = ", ".join(sorted(ALLOWED_WEBSITES))
        return f"I can open these websites right now: {allowed}."

    # Windows-only: opens the default browser
    os.startfile(url)
    return f"Opened {site_name.title()}."


def friendly_error(raw_error: str) -> tuple[int, str]:
    """
    Map raw provider errors to an HTTP status code and a user-facing message.
    """
    error_text = raw_error.lower()

    if "429" in error_text or "rate-limited" in error_text or "rate limit" in error_text:
        return (
            429,
            "This free model is busy or rate-limited right now. Try another model or retry shortly.",
        )

    if "api key" in error_text:
        return (
            401,
            "API key not found or not accepted. Check your local .env file.",
        )

    if "connection error" in error_text:
        return (
            503,
            "Could not reach the AI provider. Check your internet connection and try again.",
        )

    return (
        502,
        "The selected model could not answer right now. Try another model or retry shortly.",
    )


# --- Routes ---


@app.get("/")
def home() -> FileResponse:
    """Serve the main chat page."""
    return FileResponse("web/index.html")


@app.get("/health")
def health_check() -> dict[str, str]:
    """Simple liveness check for deployments and dev tools."""
    return {"status": "ok"}


@app.get("/models")
def get_models() -> dict[str, list[dict[str, str]]]:
    """Return every model loaded from models.csv."""
    return {
        "models": [
            {"name": name, "id": model_id}
            for name, model_id in AVAILABLE_MODELS.items()
        ]
    }


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    """
    Handle a chat turn: local shortcuts first, then the selected AI model.
    """
    if request.model not in AVAILABLE_MODELS.values():
        raise HTTPException(status_code=400, detail="Unknown model ID.")

    # Handle "open youtube" style commands without calling the API
    latest_prompt = get_latest_user_message(request.messages)
    local_reply = open_website_command(latest_prompt)
    if local_reply:
        return ChatResponse(reply=local_reply)

    messages = [message.model_dump() for message in request.messages]
    reply = generate_response(
        request.model, messages, request.temperature, request.max_tokens
    )

    if reply.startswith("Error generating response:"):
        status_code, detail = friendly_error(reply)
        raise HTTPException(status_code=status_code, detail=detail)

    return ChatResponse(reply=reply)
