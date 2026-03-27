# 🎙️ VoxLens

### Talk to any webpage using your voice — in English, Hindi, or Telugu

*A multilingual voice assistant Chrome extension powered by Groq LLaMA 3.3 + Murf AI*

---

## 💡 What is VoxLens?

VoxLens is a Chrome extension that lets you **ask questions about any webpage using your voice** and get spoken answers back — instantly, in your language.

Open the extension, tap the mic, ask *“What is this page about?”* or *“Summarise the key points”* — VoxLens reads the page, sends your question to an LLM, and speaks the answer back using a natural AI voice.

---

## 🧠 System Architecture & Workflow

VoxLens operates on a streamlined, low-latency architecture designed for instant voice interactions:

1. **User Input:** The user speaks a question into the extension (handled by Chrome's native SpeechRecognition API).
2. **Context Extraction:** The extension extracts the textual content of the currently active webpage.
3. **Query Processing:** The transcription and page context are securely sent to the **VoxLens Backend**.
4. **LLM Inference:** The backend calls the **Groq API (LLaMA 3.3 70B)** to generate a contextual, accurate answer based *only* on the webpage's content.
5. **Voice Generation:** The text response is routed to the **Murf AI API**, which synthesizes a high-fidelity, natural-sounding audio response.
6. **Playback:** The audio is returned to the browser and played back to the user smoothly.

---

## ✨ Key Features (Hackathon Highlights)

* 🎤 **Voice-First Navigation** — Seamlessly query webpage content using natural voice commands without typing.
* 🌐 **Multilingual Support** — Fully supports interactions in English, Hindi (हिन्दी), and Telugu (తెలుగు), breaking language barriers.
* 🧠 **LLM-Powered Context Awareness** — Groq's LLaMA 3.3 70B model dynamically reads the active webpage and maintains conversational context throughout the session.
* 🔊 **Hyper-Realistic AI Voice** — Utilizes Murf AI's premium Text-to-Speech engine for natural, human-like responses (with intelligent built-in system fallback).
* ⚡ **Ultra-Low Latency** — Blazing-fast inference and streaming architecture ensure near-instantaneous responses.
* ⏸️ **Advanced Playback Controls** — Full user agency with play, pause, resume, and stop functionality for spoken answers.

---

# 🚀 Quick Start (For Judges)

### ⭐ No backend setup required

We have already deployed the backend on the internet.
You can test the extension immediately.

👉 Just follow **2 steps** below.

---

## 1️⃣ Load the Chrome Extension

1. Download or clone this repository

```bash
git clone https://github.com/yourname/voxlens.git
```

2. Open Chrome → go to:

```
chrome://extensions
```

3. Enable **Developer Mode**
4. Click **Load unpacked**
5. Select the **extension/** folder

You will now see the **VoxLens icon** in the toolbar.

---

## 2️⃣ Allow Microphone Access

When you click the mic for the first time, Chrome will ask for permission.

Click **Allow microphone** ✅

If permission popup doesn’t appear:

Go to
Chrome Settings → Privacy & Security → Site Settings → Microphone
Allow Chrome Extensions.

---

## 🎮 How to Use VoxLens

1. Open **any webpage** (news, blog, Wikipedia, docs, etc.)
2. Click the **VoxLens icon**
3. Choose language (Auto / EN / हिन्दी / తెలుగు)
4. Click the **mic button**
5. Ask a question about the page
6. Hear the spoken AI answer 🔊

💬 Ask follow-up questions — VoxLens remembers context.

---

# 🧪 Example Questions to Try

* “What is this page about?”
* “Summarise the key points”
* “Explain this in simple words”
* “Give me 5 bullet points”
* “Translate this to Hindi”
* “Explain this for beginners”

---

# 🛠️ Optional — Run Backend Locally (Developers)

If you want to run your own backend:

### Prerequisites

* Python 3.9+
* Groq API key
* Murf AI API key

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

Create `.env` inside **backend/**

```env
GROQ_API_KEY=your_key
MURF_API_KEY=your_key
```

Run server:

```bash
python app.py
```

Backend will run on:

```
http://127.0.0.1:5000
```

The extension automatically detects local backend during development.

---

# 🗂️ Project Structure

```
voxlens/
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   └── .env (local only)
└── extension/
    ├── manifest.json
    ├── popup.html
    ├── popup.js
    ├── ui.js
    ├── background.js
    ├── content.js
    ├── pills.js
    └── icons/
```

---

# 🧰 Tech Stack

| Layer          | Technology           |
| -------------- | -------------------- |
| Voice Input    | Web Speech API       |
| LLM            | Groq — LLaMA 3.3 70B |
| Text-to-Speech | Murf AI              |
| Backend        | Python Flask         |
| Extension      | Chrome Manifest V3   |

---

# 🌟 Why VoxLens?

Most people **read the web**.
VoxLens lets you **talk to the web**.

Perfect for:

* Accessibility
* Multitasking
* Faster learning
* Language inclusion

---


This project demonstrates:

* Voice UX
* LLM integration
* Real-time TTS
* Chrome Extension architecture
* Full-stack AI deployment

