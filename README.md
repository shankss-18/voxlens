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

Follow these steps in order to get VoxLens running on your machine.

---

### Step 1 — Download the project

**Option A: Using Git (recommended)**
```bash
git clone https://github.com/your-username/voxlens.git
cd voxlens
```

**Option B: Download as ZIP**
1. Go to the GitHub repo page
2. Click the green **Code** button → **Download ZIP**
3. Unzip the folder somewhere on your computer

---

### Step 2 — Add your API keys

1. Inside the project backend folder, find the file called `.env`
2. Replace the placeholder values with your actual keys:

```
GROQ_API_KEY=paste_your_groq_key_here
MURF_API_KEY=paste_your_murf_key_here
```

> 🔑 Get your **Groq API key** at [console.groq.com](https://console.groq.com)
> 🔑 Get your **Murf API key** at [murf.ai](https://murf.ai)

Save the file when done.

---

### Step 3 — Start the Python backend

Make sure you have Python 3 installed, then run:

```bash
pip install flask groq requests python-dotenv
python app.py
```

You should see something like:
```
* Running on http://127.0.0.1:5000
```
Keep this terminal window open while using the extension.

---

### Step 4 — Load the extension into Chrome

1. Open Chrome and go to `chrome://extensions` in the address bar
2. Toggle on **Developer mode** (top-right corner)
3. Click **Load unpacked**
4. Select the `/extension` folder inside the project directory
5. VoxLens will appear in your extensions list — pin it to your toolbar for easy access

---

### Step 5 — Try it out!

1. Navigate to any webpage
2. Click the VoxLens icon in your Chrome toolbar
3. Hit the 🎤 mic button and ask a question about the page
4. Listen to the answer!

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
