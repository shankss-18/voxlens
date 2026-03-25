# 🔊 VoxLens

> **Ask any webpage a question — and hear the answer spoken back to you.**

VoxLens is a Chrome extension that lets you talk to any website. Just open the extension, ask a question about the page you're on, and get an AI-generated answer read aloud in a natural voice.

---

## 🚀 What It Does

1. **Open VoxLens** on any webpage
2. **Click the mic** and ask a question (e.g. *"What is this article about?"*)
3. **VoxLens reads the page**, sends your question + page content to an AI
4. **You hear the answer** spoken back in a natural voice

---

## 🧩 How It Works

```
You speak → Web Speech API transcribes → Flask backend receives question + page text
         → Groq (Llama 3.3) generates answer → Murf Falcon converts to MP3
         → Audio plays back in the popup
```

| Component | Role |
|---|---|
| `manifest.json` | Wires the Chrome extension together |
| `background.js` | Service worker (keeps extension alive) |
| `content.js` | Reads the current page's text from the DOM |
| `popup.html / popup.js` | UI, mic button, voice + fetch logic |
| Web Speech API | Converts your voice to text |
| `app.py` (Flask) | Backend — receives question + page text |
| Groq API (Llama 3.3) | Generates the AI answer |
| Murf Falcon API | Converts answer text → MP3 audio |

---

## 🛠️ Setup

### Chrome Extension
1. Clone this repo
2. Go to `chrome://extensions` → Enable **Developer Mode**
3. Click **Load Unpacked** → select the `/extension` folder

### Python Backend
```bash
pip install flask groq requests
python app.py
```

Add your API keys to a `.env` file:
```
GROQ_API_KEY=your_key
MURF_API_KEY=your_key
```

---

## 💡 Use Cases

- 🧏 **Accessibility** — listen to page summaries without reading
- 📰 **Research** — quickly digest long articles
- 🔍 **Q&A** — ask specific questions about any webpage
- 🌐 Works on any site, no per-page setup needed

---

## 🏗️ Built With

- Chrome Extensions API
- Python + Flask
- [Groq](https://groq.com) — Llama 3.3 inference
- [Murf AI](https://murf.ai) — Falcon text-to-speech
- Web Speech API

---

Built with ❤️ at [Hackathon Name]
