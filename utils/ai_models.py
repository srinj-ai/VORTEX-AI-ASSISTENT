import csv
import os
from pathlib import Path
from typing import List, Dict


BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_PATH = BASE_DIR / "models.csv"
ENV_PATH = BASE_DIR / ".env"


def load_env_file() -> None:
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


load_env_file()


def get_api_key() -> str:
    return os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY") or ""


def get_client():
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

# Load models from CSV
def load_models():
    try:
        with MODELS_PATH.open(newline="", encoding="utf-8") as file:
            reader = csv.DictReader(file)
            return {
                row["Model Name"].strip(): row["Model ID"].strip()
                for row in reader
                if row.get("Model Name") and row.get("Model ID")
            }
    except Exception as e:
        print(f"Error loading models: {e}")
        return {}

# Get available models
AVAILABLE_MODELS = load_models()

def generate_response(
    model_id: str,
    messages: List[Dict],
    temperature: float = 0.7,
    max_tokens: int = 1000,
) -> str:
    """
    Generate a response from the selected AI model.
    
    Args:
        model_id (str): The model ID to use
        messages (List[Dict]): List of message dictionaries with 'role' and 'content'
    
    Returns:
        str: The generated response
    """
    try:
        client = get_client()
        response = client.chat.completions.create(
            extra_headers={
                "HTTP-Referer": "https://github.com/UTGyan7/VORTEX-AI",
                "X-Title": "VORTEX AI",
            },
            model=model_id,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Detailed error: {str(e)}")  # Debug print
        return f"Error generating response: {str(e)}" 
