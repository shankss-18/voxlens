
# 🎙️ VoxLens

### Talk to any webpage using your voice — in English, Hindi, or Telugu

*A multilingual voice assistant Chrome extension powered by Groq LLaMA 3.3 + Murf AI*

---

## 💡 What is VoxLens?

VoxLens is a Chrome extension that lets you **ask questions about any webpage using your voice** and get spoken answers back — instantly, in your language.

Open the extension, tap the mic, ask *"What is this page about?"* or *"Summarise the key points"* — VoxLens reads the page, sends your question to an LLM, and speaks the answer back using a natural AI voice.

### How it works

```
You speak  →  Chrome SpeechRecognition  →  Flask backend
                                                  ↓
                                         Groq (LLaMA 3.3 70B)
                                         reads the page content
                                                  ↓
                                         Murf AI generates voice
                                                  ↓
                                    Answer spoken back to you 🔊
```

### Key Features

- 🎤 **Voice input** — speak naturally, no typing needed
- 🌐 **Multilingual** — English, Hindi (हिन्दी), Telugu (తెలుగు)
- 🧠 **Context-aware** — remembers conversation history within a session
- 🔊 **AI voice output** — Murf AI TTS with system voice fallback
- ⚡ **Fast** — Groq's LLaMA 3.3 70B for near-instant responses
- 🛑 **Pause / Stop** — full playback controls

---

## 🚀 Setup

### Prerequisites

- Python 3.9+
- Google Chrome
- A [Groq API key](https://console.groq.com) *(free)*
- A [Murf AI API key](https://murf.ai) *(free tier available)*

---

### 1. Clone the repo

```bash
git clone https://github.com/yourname/voxlens.git
cd voxlens
```

---

### 2. Set up the backend

```bash
cd backend
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file inside the `backend/` folder:

```env
GROQ_API_KEY=your_groq_api_key_here
MURF_API_KEY=your_murf_api_key_here
```

Start the backend server:

```bash
python app.py
```

You should see:
```
* Running on http://127.0.0.1:5000
```

> Keep this terminal running while using the extension.

---

### 3. Load the extension in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder from this repo
5. The VoxLens icon will appear in your toolbar

---

### 4. Allow microphone access

When you first click the mic, Chrome will ask for microphone permission — click **Allow**.

If you see *"allow mic in Chrome site settings"*, go to:
`Chrome Settings → Privacy → Site Settings → Microphone` and allow the extension.

---

## 🎮 Usage

1. Navigate to **any webpage** you want to ask about
2. Click the **VoxLens icon** in the Chrome toolbar
3. Select your language (auto / EN / हि / తె)
4. Click the **mic button** and ask your question
5. VoxLens reads the page and speaks the answer back
6. Ask follow-up questions — it remembers the conversation

---

## 🗂️ Project Structure

```
voxlens/
├── backend/
│   ├── app.py              # Flask server — handles LLM + TTS
│   ├── requirements.txt    # Python dependencies
│   └── .env                # API keys (create this yourself)
└── extension/
    ├── manifest.json       # Chrome extension config
    ├── popup.html          # Extension UI
    ├── popup.js            # Core logic — mic, speech, fetch
    ├── ui.js               # UI state management
    ├── background.js       # Tab tracking service worker
    ├── content.js          # Page content extractor
    ├── pills.js            # Language selector
    └── icons/
        └── logo.png
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Voice Input | Web Speech API (Chrome built-in) |
| LLM | Groq — LLaMA 3.3 70B Versatile |
| Text-to-Speech | Murf AI (GEN2) + system TTS fallback |
| Backend | Python / Flask |
| Extension | Chrome MV3 |

---

## ⚙️ requirements.txt

```
flask
flask-cors
groq
python-dotenv
requests
```

---
