import os
import requests
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MURF_API_KEY = os.getenv("MURF_API_KEY")

MURF_VOICES = {
    'en':   'en-IN-rohan',
    'hi':   'hi-IN-shashank',
    'te':   'te-IN-mohan',
    'auto': 'en-IN-rohan'
}

SYSTEM_PROMPT = """
You are a helpful multilingual voice assistant answering questions about a webpage.

RESPONSE LENGTH — strict rules, no exceptions:
- DEFAULT: 1–2 sentences. Use this unless the user explicitly asks for more.
- Step-by-step ONLY if user says: "step by step", "walk me through", "how do I", "guide me".
- Detailed ONLY if user says: "explain in detail", "tell me more", "elaborate", "give overview".
- Feature list ONLY if user says: "what features", "compare", "list".
- When in doubt → 1–2 sentences. Never over-explain.

CONTENT RULES:
- Use ONLY information present in the page content. Never guess or add outside knowledge.
- If the answer is not in the page, say only: "The page doesn't mention that."
- Never contradict yourself — if you say the page doesn't have it, don't then provide it.
- Reply in the SAME language the user used. Detect from their message.
- No markdown: no **, no ##, no ---, no bullet symbols. Plain text only.
- No filler: no "Sure!", "Great question!", "Of course!", "Certainly!" — go straight to the answer.
"""

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    question = data.get("question")
    page_content = data.get("pageContent")
    history = data.get("history", [])
    lang = data.get("lang", "auto")

    if not question or not page_content:
        return jsonify({ "error": "Missing question or page content" }), 400

    messages = [
        { "role": "system", "content": SYSTEM_PROMPT },
        { "role": "user", "content": f"Page content:\n{page_content}" },
        { "role": "assistant", "content": "I have read the page. Ask me anything." }
    ]

    for msg in history:
        messages.append({ "role": msg["role"], "content": msg["content"] })

    messages.append({ "role": "user", "content": question })

    groq_response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages
    )

    answer_text = groq_response.choices[0].message.content
    voice_id = MURF_VOICES.get(lang, 'en-IN-rohan')

    try:
        murf_response = requests.post(
            "https://api.murf.ai/v1/speech/generate",
            headers={
                "api-key": MURF_API_KEY,
                "Content-Type": "application/json"
            },
            json={
                "text": answer_text,
                "voiceId": voice_id,
                "modelVersion": "GEN2",
                "format": "MP3"
            }
        )

        murf_data = murf_response.json()
        audio_url = murf_data.get("audioFile")

        if audio_url:
            audio_bytes = requests.get(audio_url).content
            audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
        else:
            audio_base64 = None

    except Exception:
        audio_base64 = None

    return jsonify({
        "text": answer_text,
        "audio": audio_base64
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)