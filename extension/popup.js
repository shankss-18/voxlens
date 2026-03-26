const BACKEND_URL = "http://localhost:5000/analyze";

const LANG_MAP = {
  'auto': 'en-IN',
  'en':   'en-IN',
  'hi':   'hi-IN',
  'te':   'te-IN'
};

let conversationHistory = [];
let savedBubbles        = [];
let originalTabId       = null;

let isListening         = false;
let isSpeaking          = false;
let isPaused            = false;
let recognition         = null;

// Single SpeechSynthesisUtterance reference so pause/stop work reliably
let currentUtterance    = null;
let currentAudio        = null;  // for Murf MP3

// ------------------ INIT ------------------

chrome.storage.session.get(['lastActiveTabId', 'chatHistory', 'conversationHistory'], (data) => {
  if (chrome.runtime.lastError) return;
  if (data.lastActiveTabId) originalTabId = data.lastActiveTabId;
  if (data.conversationHistory) conversationHistory = data.conversationHistory;
  if (data.chatHistory) {
    savedBubbles = data.chatHistory;
    data.chatHistory.forEach(msg => addMessage(msg.role, msg.text));
  }
  setUIState('ready', 'tap to speak');
});

// ------------------ SPEECH RECOGNITION ------------------

function initRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    setUIState('idle', 'speech recognition not supported');
    return null;
  }

  const rec = new SR();
  rec.interimResults = false;
  rec.continuous     = false;
  rec.maxAlternatives = 1;
  rec.lang = LANG_MAP[langSelect.value] || 'en-IN';

  rec.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    isListening = false;
    handleSpeechResult(transcript);
  };

  rec.onerror = (e) => {
    isListening = false;
    setUIState('idle', e.error === 'not-allowed'
      ? 'allow mic in Chrome site settings'
      : 'mic error: ' + e.error);
  };

  rec.onend = () => {
    if (isListening) {
      isListening = false;
      setUIState('ready', 'tap to speak');
    }
  };

  return rec;
}

// ------------------ MIC BUTTON ------------------

micBtn.addEventListener('click', () => {
  if (isSpeaking) return;

  if (isListening) {
    if (recognition) { try { recognition.stop(); } catch(e) {} }
    isListening = false;
    setUIState('thinking', 'processing...');
  } else {
    recognition = initRecognition();
    if (!recognition) return;
    try {
      recognition.start();
      isListening = true;
      setUIState('listening');
    } catch(e) {
      setUIState('idle', 'mic error: ' + e.message);
    }
  }
});

// ------------------ HANDLE SPEECH RESULT ------------------

function handleSpeechResult(question) {
  isListening = false;
  addMessageAndSave('user', question);
  setUIState('thinking', `"${question}"`);
  processQuestion(question);
}

// ------------------ PROCESS QUESTION ------------------

function processQuestion(question) {
  // Re-fetch latest tab ID in case user switched tabs
  chrome.storage.session.get('lastActiveTabId', (data) => {
    if (data.lastActiveTabId) originalTabId = data.lastActiveTabId;

    if (!originalTabId) {
      setUIState('idle', 'switch to a webpage first');
      return;
    }

    chrome.tabs.get(originalTabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        setUIState('idle', 'target tab closed — switch to a webpage');
        return;
      }

      // Use scripting.executeScript — no content script dependency
      chrome.scripting.executeScript(
        {
          target: { tabId: originalTabId },
          func: () => {
            const main = document.querySelector('article') ||
                         document.querySelector('main') ||
                         document.body;
            let text = (main.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
            return text.substring(0, 3000);
          }
        },
        async (results) => {
          if (chrome.runtime.lastError || !results || !results[0]) {
            setUIState('idle', 'cannot read page — try refreshing it');
            return;
          }

          const pageContent = results[0].result;
          if (!pageContent) {
            setUIState('idle', 'page appears empty');
            return;
          }

          try {
            const res = await fetch(BACKEND_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                question,
                pageContent,
                history: conversationHistory,
                lang: langSelect.value
              })
            });

            const responseData = await res.json();
            const answerText   = responseData.text;

            conversationHistory.push({ role: 'user',      content: question   });
            conversationHistory.push({ role: 'assistant', content: answerText });

            addMessageAndSave('assistant', answerText);
            speakText(answerText, responseData.audio);

          } catch (err) {
            console.error(err);
            setUIState('idle', 'backend not running');
            addMessageAndSave('assistant', 'Backend not reachable.');
          }
        }
      );
    });
  });
}

// ------------------ AUDIO ------------------

function speakText(text, audioBase64) {
  // Always cancel any ongoing speech first
  stopAllAudio();

  isSpeaking = true;
  isPaused   = false;
  setUIState('speaking');

  if (audioBase64) {
    currentAudio = new Audio('data:audio/mp3;base64,' + audioBase64);
    currentAudio.onended = onSpeakingDone;
    currentAudio.onerror = () => {
      currentAudio = null;
      fallbackTTS(text);
    };
    currentAudio.play().catch(() => fallbackTTS(text));
  } else {
    fallbackTTS(text);
  }
}

function fallbackTTS(text) {
  // Cancel any leftover synthesis
  window.speechSynthesis.cancel();

  const lang = langSelect.value;
  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.lang  = lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : 'en-IN';
  currentUtterance.rate  = 0.95;
  currentUtterance.pitch = 1;

  currentUtterance.onstart = () => {
    setUIState('speaking', 'speaking...');
  };

  currentUtterance.onend = () => {
    currentUtterance = null;
    onSpeakingDone();
  };

  currentUtterance.onerror = (e) => {
    // 'interrupted'/'canceled' fires when we deliberately cancel — ignore
    currentUtterance = null;
    if (e.error === 'interrupted' || e.error === 'canceled') return;
    console.warn('TTS error:', e.error);
    onSpeakingDone();
  };

  window.speechSynthesis.speak(currentUtterance);
}

function stopAllAudio() {
  // Stop Murf MP3
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
  // Stop system TTS — setting currentUtterance to null BEFORE cancel
  // prevents the onerror handler from calling onSpeakingDone unexpectedly
  currentUtterance = null;
  window.speechSynthesis.cancel();
}

function onSpeakingDone() {
  if (!isSpeaking) return;
  isSpeaking = false;
  isPaused   = false;
  setUIState('ready', 'tap to speak');
}

// ------------------ HISTORY ------------------

function addMessageAndSave(role, text) {
  addMessage(role, text);
  savedBubbles.push({ role, text });
  chrome.storage.session.set({ chatHistory: savedBubbles, conversationHistory });
}

// ------------------ PAUSE / STOP CONTROLS ------------------

pauseBtn.addEventListener('click', () => {
  if (!isSpeaking) return;

  if (currentAudio) {
    // Murf MP3 pause/resume
    if (isPaused) {
      currentAudio.play();
    } else {
      currentAudio.pause();
    }
  } else {
    // System TTS pause/resume
    if (isPaused) {
      window.speechSynthesis.resume();
    } else {
      window.speechSynthesis.pause();
    }
  }

  isPaused = !isPaused;
  pauseBtn.textContent   = isPaused ? '▶ resume' : '⏸ pause';
  statusText.textContent = isPaused ? 'paused'   : 'speaking...';
});

stopBtn.addEventListener('click', () => {
  if (!isSpeaking) return;

  // Set flags FIRST so onend/onerror handlers become no-ops when cancel fires
  isSpeaking       = false;
  isPaused         = false;
  currentUtterance = null;

  // Stop Murf MP3
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }

  // Chrome re-queues speech after a single cancel — cancel repeatedly
  window.speechSynthesis.cancel();
  setTimeout(() => window.speechSynthesis.cancel(), 50);
  setTimeout(() => window.speechSynthesis.cancel(), 150);

  setUIState('ready', 'tap to speak');
});

// ------------------ CLEAR ------------------

document.getElementById('clearBtn').addEventListener('click', () => {
  stopAllAudio();
  isSpeaking = false;
  isPaused   = false;

  document.getElementById('chatHistory').innerHTML = '';
  conversationHistory = [];
  savedBubbles        = [];

  chrome.storage.session.remove(['chatHistory', 'conversationHistory']);
  setUIState('ready', 'tap to speak');
});

// ------------------ CLEANUP ------------------

window.addEventListener('unload', () => {
  if (recognition) { try { recognition.stop(); } catch(e) {} }
  stopAllAudio();
});
