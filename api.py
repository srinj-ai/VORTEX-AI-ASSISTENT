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


class ChatResponse(BaseModel):
    reply: str


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
    reply = generate_response(request.model, messages)

    if reply.startswith("Error generating response:"):
        raise HTTPException(status_code=502, detail=reply)

    return ChatResponse(reply=reply)
