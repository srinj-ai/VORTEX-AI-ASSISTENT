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

app.mount("/static", StaticFiles(directory="web"), name="static")


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


def friendly_error(raw_error: str) -> tuple[int, str]:
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


@app.get("/")
def home() -> FileResponse:
    return FileResponse("web/index.html")


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/models")
def get_models() -> dict[str, list[dict[str, str]]]:
    return {
        "models": [
            {"name": name, "id": model_id}
            for name, model_id in AVAILABLE_MODELS.items()
        ]
    }


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    if request.model not in AVAILABLE_MODELS.values():
        raise HTTPException(status_code=400, detail="Unknown model ID.")

    messages = [message.model_dump() for message in request.messages]
    reply = generate_response(request.model, messages, request.temperature, request.max_tokens)

    if reply.startswith("Error generating response:"):
        status_code, detail = friendly_error(reply)
        raise HTTPException(status_code=status_code, detail=detail)

    return ChatResponse(reply=reply)
