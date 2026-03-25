
const BACKEND_URL = "http://localhost:5000/analyze";

const LANG_MAP = {
  'auto': 'en-IN',
  'en':   'en-IN',
  'hi':   'hi-IN',
  'te':   'te-IN'
};

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.interimResults = false;
recognition.continuous     = false;

let conversationHistory = [];
let savedBubbles        = [];
let originalTabId       = null;
let isListening         = false;
let isSpeaking          = false;
let isPaused            = false;
let currentAudio        = null;
let recognitionTimeout  = null;

function killAllAudio() {
  if (currentAudio) {
    currentAudio.onended  = null;
    currentAudio.onerror  = null;
    currentAudio.pause();
    currentAudio.src      = '';
    currentAudio          = null;
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.cancel();
  setTimeout(() => window.speechSynthesis.cancel(), 50);
  setTimeout(() => window.speechSynthesis.cancel(), 150);
  setTimeout(() => window.speechSynthesis.cancel(), 300);

  isSpeaking = false;
  isPaused   = false;
}
chrome.runtime.sendMessage({ action: 'loadHistory' }, (data) => {
  if (data && data.conversationHistory) conversationHistory = data.conversationHistory;
  if (data && data.chatHistory) {
    savedBubbles = data.chatHistory;
    data.chatHistory.forEach(msg => addMessage(msg.role, msg.text));
  }
});

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs && tabs.length > 0) {
    originalTabId = tabs[0].id;
    setUIState('ready', 'tap to speak');
  } else {
    setUIState('idle', 'could not detect tab');
  }
});

function saveHistory() {
  chrome.runtime.sendMessage({
    action: 'saveHistory',
    chatHistory: savedBubbles,
    conversationHistory
  });
}

function addMessageAndSave(role, text) {
  addMessage(role, text);
  savedBubbles.push({ role, text });
  saveHistory();
}

langSelect.addEventListener('change', () => {
  recognition.lang = LANG_MAP[langSelect.value] || 'en-IN';
});
recognition.lang = LANG_MAP['auto'];

micBtn.addEventListener('click', () => {
  if (isSpeaking) return;
  isListening ? stopListening() : startListening();
});

function startListening() {
  try {
    recognition.start();
    isListening = true;
    setUIState('listening');

    recognitionTimeout = setTimeout(() => {
      if (isListening) {
        recognition.abort();
        isListening = false;
        setUIState('ready', 'tap to speak');
      }
    }, 10000);

  } catch (e) {
    recognition.abort();
    setTimeout(() => {
      recognition.start();
      isListening = true;
      setUIState('listening');
    }, 300);
  }
}

function stopListening() {
  clearTimeout(recognitionTimeout);
  recognition.stop();
  isListening = false;
  setUIState('thinking', 'processing...');
}

pauseBtn.addEventListener('click', () => {
  if (!isSpeaking) return;

  if (currentAudio) {
    isPaused ? currentAudio.play() : currentAudio.pause();
  } else {
    isPaused ? window.speechSynthesis.resume() : window.speechSynthesis.pause();
  }

  isPaused               = !isPaused;
  pauseBtn.textContent   = isPaused ? '▶ resume' : '⏸ pause';
  statusText.textContent = isPaused ? 'paused — click ▶ to resume' : 'speaking...';
});

stopBtn.addEventListener('click', () => {
  if (!isSpeaking) return;
  killAllAudio();
  setUIState('ready', 'tap to speak');
});

document.getElementById('clearBtn').addEventListener('click', () => {
  killAllAudio();

  document.getElementById('chatHistory').innerHTML = '';
  conversationHistory.length = 0;
  savedBubbles               = [];
  chrome.runtime.sendMessage({ action: 'clearHistory' });
  setUIState('ready', 'tap to speak');
});

recognition.onresult = async (event) => {
  clearTimeout(recognitionTimeout);
  isListening        = false;
  const question     = event.results[0][0].transcript;

  setUIState('thinking', `"${question}"`);
  addMessageAndSave('user', question);

  if (!originalTabId) { setUIState('idle', 'no tab found'); return; }

  chrome.tabs.sendMessage(originalTabId, { action: 'getPageContent' }, async (response) => {
    if (chrome.runtime.lastError) { setUIState('idle', 'refresh the page and retry'); return; }
    if (!response || !response.content) { setUIState('idle', 'could not read page'); return; }

    try {
      const res = await fetch(BACKEND_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          question,
          pageContent: response.content,
          history:     conversationHistory,
          lang:        langSelect.value
        })
      });

      const data       = await res.json();
      const answerText = data.text;

      conversationHistory.push({ role: 'user',      content: question });
      conversationHistory.push({ role: 'assistant', content: answerText });

      addMessageAndSave('assistant', answerText);
      isSpeaking = true;
      isPaused   = false;
      setUIState('speaking');

      if (data.audio) {
        currentAudio         = new Audio('data:audio/mp3;base64,' + data.audio);
        currentAudio.onended = onSpeakingDone;
        currentAudio.onerror = () => {
          currentAudio = null;
          fallbackTTS(answerText);
        };
        currentAudio.play();
      } else {
        currentAudio = null;
        fallbackTTS(answerText);
      }

    } catch (err) {
      setUIState('idle', 'flask not running — check backend');
      addMessageAndSave('assistant', 'Backend not reachable. Check if Flask is running.');
    }
  });
};

recognition.onerror = (event) => {
  clearTimeout(recognitionTimeout);
  isListening = false;

  if (event.error === 'aborted') {
    setUIState('ready', 'tap to speak');
    return;
  }
  if (event.error === 'language-not-supported') {
    recognition.lang = 'en-IN';
    setUIState('ready', 'lang unsupported, switched to EN');
    return;
  }
  if (event.error === 'no-speech') {
    setUIState('ready', 'no speech detected');
    return;
  }

  setUIState('idle', 'mic error: ' + event.error);
};

recognition.onend = () => {
  clearTimeout(recognitionTimeout);
  if (isListening) {
    isListening = false;
    setUIState('ready', 'tap to speak');
  }
};

function fallbackTTS(text) {
  window.speechSynthesis.cancel();

  const utter    = new SpeechSynthesisUtterance(text);
  const langCode = langSelect.value;
  utter.lang     = langCode === 'hi' ? 'hi-IN' : langCode === 'te' ? 'te-IN' : 'en-IN';
  utter.rate     = 0.95;
  utter.pitch    = 1;
  utter.onend    = onSpeakingDone;
  utter.onerror  = onSpeakingDone;

  window.speechSynthesis.speak(utter);
  setUIState('speaking', 'speaking (system voice)...');
}

function onSpeakingDone() {
  if (!isSpeaking) return;
  isSpeaking   = false;
  isPaused     = false;
  currentAudio = null;
  setUIState('ready', 'tap to speak');
}

window.addEventListener('unload', () => {
  killAllAudio();
});