import os
import io
import json
import re
import requests
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
from groq import Groq
from dotenv import load_dotenv
from gtts import gTTS

load_dotenv()

app = Flask(__name__)
CORS(app)

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MURF_API_KEY = os.getenv("MURF_API_KEY")

MURF_VOICES = {
    'en':   'en-IN-rohan',   # confirmed working
    'hi':   None,            # use gTTS — Murf Hindi ID unverified
    'te':   None,            # use gTTS — te-IN-mohan rejected by API
    'auto': 'en-IN-rohan'
}

# ── Single unified system prompt ───────────────────────────────────────────────
UNIFIED_SYSTEM_PROMPT = """
You are VoxLens, a friendly multilingual AI assistant embedded in a web browser.
You can both ANSWER questions AND PERFORM ACTIONS on the current webpage.

You always reply with valid JSON only — no extra text, no markdown, just the JSON object.

OUTPUT FORMAT (always):
{
  "text": "Your spoken reply — EXTREMELY SHORT (under 15 words). Provide direct answers.",
  "action": null
}

OR if the user wants to DO something on the page:
{
  "text": "Short confirmation (e.g. 'Scrolling down', 'Typing...'). Very brief.",
  "action": {
    "type": "click | scroll | fill | navigate | submit",
    "target": "exact element text from the provided list (or null for scroll/navigate)",
    "value": "text to type | URL | 'up'/'down'/'top'/'bottom' | null"
  }
}

DECISION RULES — when to use action vs answer:
- User wants to DO something on the page → use action (click, scroll, fill, navigate, submit)
  Examples: "log in", "sign up", "click subscribe", "scroll down", "go to pricing", "type hello in search",
            "open the menu", "press the button", "find the contact form", "submit", "sign me in"
- User wants to KNOW something → set action to null, just answer in "text"
  Examples: "what is this page about?", "summarize this", "how much does it cost?"

ACTION RULES:
- click: target = closest matching button/link text from the elements list
- scroll: target = null. value = "up" | "down" | "top" | "bottom". If scrolling to element: target = element text, value = null
- fill: target = input placeholder or label. value = what to type
- navigate: target = null. value = full URL (add https:// if missing)
- submit: target = null. value = null

CONVERSATIONAL & GENERAL BEHAVIOR:
- If the user says "hello", greets you, or makes small talk, just respond naturally and conversationally. Do NOT perform any actions.
- If the user asks a general factual question, answer it directly.
- Only construct an "action" if the user EXPLICITLY asks to navigate, scroll, click, type, or interact with the page. Otherwise, just converse and set action to null.

LANGUAGE: Always reply in the same language the user used.
FORMAT: "text" must be plain speech — no **, no ##, no bullets. Speakable sentences only.
"""


def generate_audio(text: str, detected_lang: str):
    """Try Murf (if voice known), fall back to gTTS. Returns base64 MP3 or None."""
    voice_id = MURF_VOICES.get(detected_lang, 'en-IN-rohan')
    audio_base64 = None

    if voice_id:
        try:
            murf_response = requests.post(
                "https://api.murf.ai/v1/speech/generate",
                headers={"api-key": MURF_API_KEY, "Content-Type": "application/json"},
                json={"text": text, "voiceId": voice_id, "modelVersion": "GEN2", "format": "MP3"}
            )
            murf_data = murf_response.json()
            print(f"[Murf] voice={voice_id} status={murf_response.status_code}")
            audio_url = murf_data.get("audioFile")
            if audio_url:
                audio_bytes = requests.get(audio_url).content
                audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
            else:
                print(f"[Murf] No audioFile: {murf_data}")
        except Exception as e:
            print(f"[Murf] Error: {e}")
    else:
        print(f"[Murf] Skipping for lang='{detected_lang}', using gTTS")

    if not audio_base64:
        try:
            GTTS_LANGS = {'en': 'en', 'hi': 'hi', 'te': 'te'}
            gtts_lang = GTTS_LANGS.get(detected_lang, 'en')
            print(f"[gTTS] Generating audio in '{gtts_lang}'...")
            tts = gTTS(text=text, lang=gtts_lang)
            buf = io.BytesIO()
            tts.write_to_fp(buf)
            buf.seek(0)
            audio_base64 = base64.b64encode(buf.read()).decode("utf-8")
        except Exception as e:
            print(f"[gTTS] Error: {e}")

    return audio_base64


def detect_lang(text: str, hint: str) -> str:
    if hint != 'auto':
        return hint
    if any('\u0900' <= c <= '\u097F' for c in text):
        return 'hi'
    if any('\u0C00' <= c <= '\u0C7F' for c in text):
        return 'te'
    return 'en'


@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    question          = data.get("question")
    page_content      = data.get("pageContent", "")
    interactive_elems = data.get("interactiveElements", [])
    history           = data.get("history", [])
    lang              = data.get("lang", "auto")

    if not question:
        return jsonify({"error": "Missing question"}), 400

    # Build the elements summary for the LLM
    elem_list = ""
    if interactive_elems:
        lines = []
        for e in interactive_elems[:60]:
            line = f"[{e['type']}] {e['text']}"
            if e.get('placeholder'):
                line += f" (placeholder: {e['placeholder']})"
            lines.append(line)
        elem_list = "\n".join(lines)

    # Page context block
    page_block = (f"PAGE CONTENT (first 3000 chars):\n{page_content}\n\n" if page_content else "")
    elem_block = (f"INTERACTIVE ELEMENTS:\n{elem_list}\n\n" if elem_list else "")

    messages = [{"role": "system", "content": UNIFIED_SYSTEM_PROMPT}]

    # Inject page context into the conversation once
    if page_block or elem_block:
        messages.append({"role": "user",      "content": page_block + elem_block + "[Page context injected. Ready for user commands.]"})
        messages.append({"role": "assistant", "content": "{\"text\": \"Got it, I can see the page and its elements.\", \"action\": null}"})

    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": question})

    groq_resp = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.1,
        max_tokens=150
    )

    raw = groq_resp.choices[0].message.content
    try:
        parsed = json.loads(raw)
    except Exception:
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        parsed = json.loads(match.group(0)) if match else {"text": raw, "action": None}

    answer_text = parsed.get("text", "Done.")
    action      = parsed.get("action")

    print(f"[Route] intent={'action:'+action['type'] if action else 'qa'} | q={question[:60]}")

    detected = detect_lang(question, lang)
    audio    = generate_audio(answer_text, detected)

    return jsonify({"text": answer_text, "audio": audio, "action": action})


if __name__ == "__main__":
    app.run(debug=True, port=5000)

