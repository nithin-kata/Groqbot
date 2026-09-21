# ⚡ Groq AI Chatbot with Flask

An ultra-fast, intelligent AI chatbot web application built with **Flask** and powered by **Groq Cloud API** (LPU™ Inference Engine). Features real-time typewriter streaming (SSE), rich Markdown rendering, syntax-highlighted code blocks with one-click copy, customizable system prompts, and multiple LLM model support.

---

## ✨ Features

- **Blazing Fast Inference**: Ultra-low latency responses using Groq's LPU hardware.
- **Real-Time Streaming**: Live typewriter output using Server-Sent Events (SSE).
- **Secure Configuration**: API keys and environment parameters managed safely via `.env`.
- **Modern Glassmorphic UI**: Premium dark mode theme with Google Fonts (*Outfit* and *Inter*), glowing accents, and mobile-responsive layout.
- **Full Markdown & Code Highlighting**: Formats tables, lists, quotes, and syntax-highlighted code with a 1-click **Copy** button.
- **Model Switching**: Easily switch between top Groq models:
  - `llama-3.3-70b-versatile` *(Recommended)*
  - `llama-3.1-8b-instant` *(Fastest)*
  - `mixtral-8x7b-32768` *(Long context window)*
  - `gemma2-9b-it` *(Accurate open weights)*
- **Customizable System Instructions**: Fine-tune bot personality and temperature (creativity slider) via the built-in Settings dialog.
- **Conversation Management**: Clear chat history or restart at any time with starter prompt suggestions.

---

## 📁 Project Structure

```text
├── app.py                 # Flask server & Groq API integration (streaming SSE)
├── .env                   # Environment variables (GROQ_API_KEY, GROQ_MODEL, PORT)
├── .env.example           # Example template for environment configuration
├── requirements.txt       # Python dependencies (flask, python-dotenv, groq)
├── run.bat                # 1-click launcher script for Windows
├── templates/
│   └── index.html         # Main chatbot web interface
└── static/
    ├── css/
    │   └── style.css      # Modern dark-theme glassmorphism styling
    └── js/
        └── chat.js        # SSE streaming handler, Markdown parser & UI state
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
Ensure you have **Python 3.9+** installed on your system.

### 2. Configure Your Groq API Key
1. Get your free API key from [Groq Console](https://console.groq.com/keys).
2. Open the [`.env`](.env) file in the project folder.
3. Replace `your_groq_api_key_here` with your actual Groq key:
   ```env
   GROQ_API_KEY=gsk_your_actual_key_here
   ```

### 3. Install Dependencies
Open your terminal in this directory and run:
```bash
pip install -r requirements.txt
```

### 4. Run the Application
Start the Flask development server:
```bash
python app.py
```
*(Or on Windows, simply double-click [`run.bat`](run.bat))*

### 5. Open in Your Browser
Visit [**http://localhost:5000**](http://localhost:5000) or [http://127.0.0.1:5000](http://127.0.0.1:5000).

---

## ⚙️ Configuration Options (`.env`)

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `GROQ_API_KEY` | *(Required)* | Your Groq Cloud API authentication key (`gsk_...`). |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Default model used for chat completions. |
| `FLASK_DEBUG` | `True` | Enables hot-reload during local development. |
| `PORT` | `5000` | Port on which the web server listens. |

---

## 🛠️ API Endpoints

- `GET /`: Serves the chatbot interface.
- `GET /api/status`: Checks if `GROQ_API_KEY` is present and configured.
- `GET /api/models`: Returns list of available Groq models.
- `POST /api/chat`: Accepts messages array and streams back Groq completions via Server-Sent Events (SSE).
