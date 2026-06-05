# VORTEX AI

An AI chatbot with a pure Python CLI and a FastAPI text API. It uses free OpenRouter model IDs from `models.csv`.

<p align="center">
  <img src="web/assets/vortex-logo.jpeg" alt="VORTEX AI">
</p>

## Features

- Chat with selectable free OpenRouter models
- Pure Python terminal chat
- FastAPI backend with interactive API docs
- Local `.env` support for private API keys
- Open-source friendly setup with `.env.example`

## Setup

### 1. Clone the Repository

```bash
git clone https://github.com/srinj-ai/VORTEX-AI-ASSISTENT
cd VORTEX-AI-ASSISTENT
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Add Your API Key

Copy `.env.example` to `.env`.

Add your real OpenRouter API key to `.env`:

```env
OPENROUTER_API_KEY=your_real_key_here
```

Never commit `.env`. It is ignored by Git so your private key stays local.

### 4. Run Locally

Pure Python CLI:

```bash
python cli.py
```

FastAPI text API:

```bash
uvicorn api:app --reload
```

Then open:

```text
http://127.0.0.1:8000/docs
```

## API Endpoints

```text
GET /
GET /models
POST /chat
```

Example `/chat` body:

```json
{
  "model": "openai/gpt-oss-20b:free",
  "messages": [
    {
      "role": "user",
      "content": "Hello"
    }
  ]
}
```

## File Structure

```text
api.py              # FastAPI text API
cli.py              # Pure Python terminal chat
models.csv          # Free model list
requirements.txt    # Python dependencies
utils/ai_models.py  # Model loading and OpenRouter response logic
.env.example        # Public API key template
.gitignore          # Keeps local secrets out of Git
README.md
```

## Customization

- To add or change models, edit `models.csv`.
- To change API behavior, edit `api.py`.
- To change terminal behavior, edit `cli.py`.

## License

MIT License

## Credits

- API built with [FastAPI](https://fastapi.tiangolo.com/)
- APIs supplied by [OpenRouter](https://openrouter.ai)
- AI model integration by [Srinjoy Das](https://github.com/srinj-ai)
