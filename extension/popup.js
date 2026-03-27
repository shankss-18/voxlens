const LOCAL_API  = "http://localhost:5000/analyze";
// RENDER_API is our backup server which comes into action when local python server is not running properly
const RENDER_API = "https://voxlens-backend.onrender.com/analyze";

// Always try local first; popup now runs inside chrome-extension:// iframe
let BACKEND_URL = LOCAL_API;

console.log("Using backend:", BACKEND_URL);

const LANG_MAP = {
  'auto': 'en-IN',
  'en':   'en-IN',
  'hi':   'hi-IN',
  'te':   'te-IN'
};

let conversationHistory = [];
let savedBubbles        = [];
let originalTabId       = null;
let pendingAction       = null;

function playProcessingChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch(e) {}
}

let isListening         = false;
let isSpeaking          = false;
let isPaused            = false;
let recognition         = null;

let currentUtterance    = null;
let currentAudio        = null;  // for Murf MP3
let speakGeneration     = 0;     // prevents stale audio callbacks

// Expose state for ui.js push-to-talk
function syncGlobals() {
  window._isListening = isListening;
  window._isSpeaking  = isSpeaking;
  window._recognition = recognition;
}

// ------------------ INIT ------------------

chrome.storage.session.get(['lastActiveTabId', 'chatHistory', 'conversationHistory'], (data) => {
  if (chrome.runtime.lastError) return;
  if (data.lastActiveTabId) originalTabId = data.lastActiveTabId;
  if (data.conversationHistory) conversationHistory = data.conversationHistory;
  if (data.chatHistory) {
    savedBubbles = data.chatHistory;
    data.chatHistory.forEach(msg => addMessage(msg.role, msg.text, true));
  }
  syncGlobals();
  setUIState('ready', 'tap or hold Ctrl to speak');
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
  const selectedLang = langSelect.value;
  if (selectedLang !== 'auto') {
    rec.lang = LANG_MAP[selectedLang] || 'en-IN';
  }
  // When 'auto', don't set rec.lang — browser will use its default and auto-detect

  rec.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    isListening = false; syncGlobals();
    handleSpeechResult(transcript);
  };

  rec.onerror = (e) => {
    isListening = false; syncGlobals();
    setUIState('idle', e.error === 'not-allowed'
      ? 'allow mic in Chrome site settings'
      : 'mic error: ' + e.error);
  };

  rec.onend = () => {
    if (isListening) {
      isListening = false; syncGlobals();
      setUIState('ready', 'tap or hold Ctrl to speak');
    }
  };

  return rec;
}

// ------------------ MIC BUTTON ------------------
micBtn.addEventListener('click', async () => {
  if (isSpeaking) return;

  if (isListening) {
    if (recognition) { try { recognition.stop(); } catch(e) {} }
    isListening = false; syncGlobals();
    setUIState('thinking', 'processing...');
    return;
  }

  // Check if mic permission already granted
  try {
    const permStatus = await navigator.permissions.query({ name: 'microphone' });

    if (permStatus.state === 'denied') {
      setUIState('idle', 'mic blocked — reset in chrome://settings/content/microphone');
      return;
    }

    if (permStatus.state === 'prompt') {
      // Open the permission page in a new tab to trigger the prompt
      // (popup context can't reliably trigger getUserMedia)
      chrome.tabs.create({
        url: chrome.runtime.getURL('mic-permission.html'),
        active: true
      });
      setUIState('idle', 'allow mic in the tab that just opened, then try again');
      return;
    }

    // permStatus.state === 'granted' — proceed directly
    startRecognition();

  } catch (err) {
    // permissions.query not supported — try directly
    startRecognition();
  }
});

function startRecognition() {
  recognition = initRecognition();
  if (!recognition) return;
  try {
    recognition.start();
    isListening = true; syncGlobals();
    setUIState('listening');
  } catch(e) {
    setUIState('idle', 'mic error: ' + e.message);
  }
}
// ------------------ TEXT CHAT INPUT ------------------

const chatInput = document.getElementById('chatInput');
const sendBtn   = document.getElementById('sendBtn');

function sendTextMessage() {
  const text = chatInput.value.trim();
  if (!text || isSpeaking) return;
  chatInput.value = '';
  handleSpeechResult(text);
}

sendBtn.addEventListener('click', sendTextMessage);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendTextMessage();
  }
});

// ------------------ HANDLE SPEECH RESULT ------------------

function handleSpeechResult(question) {
  isListening = false; syncGlobals();
  addMessageAndSave('user', question);
  setUIState('thinking', `"${question}"`);
  processQuestion(question);
}

// ------------------ PROCESS QUESTION ------------------

function processQuestion(question) {
  playProcessingChime();
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

      // Extract both page text AND interactive elements from all frames
      chrome.scripting.executeScript(
        {
          target: { tabId: originalTabId, allFrames: true },
          func: () => {
            // Page text
            const main = document.querySelector('article') || document.querySelector('main') || document.body;
            const pageText = (main.innerText || '').replace(/\n{3,}/g, '\n\n').trim().substring(0, 1500);

            // Shadow DOM traversal for interactive elements
            const elements = [];
            function walk(root) {
              const nodes = root.querySelectorAll('button, a, input, textarea, select, [role="button"], [role="link"], [tabindex]');
              for (const el of nodes) {
                if (el.offsetWidth === 0 && el.offsetHeight === 0) continue;

                const type = el.tagName.toLowerCase();
                const text = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
                if (!text) continue;

                if (type === 'input' || type === 'textarea' || type === 'select') {
                  if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button') continue;
                  const ph = el.placeholder || '';
                  const name = el.getAttribute('name') || el.id || '';
                  elements.push({ type: 'input', text: name || text || 'unlabeled', placeholder: ph });
                } else {
                  elements.push({ type: 'click', text: text.substring(0, 50) });
                }
                if (elements.length > 500) break;
              }
              root.querySelectorAll('*').forEach(el => { if (el.shadowRoot) walk(el.shadowRoot); });
            }
            walk(document);
            return { pageText, elements: elements.slice(0, 300) };
          }
        },
        async (results) => {
          if (chrome.runtime.lastError || !results || !results.length) {
            setUIState('idle', 'cannot read page — try refreshing it');
            return;
          }

          // Merge results from all frames
          let combinedContent = "";
          let combinedElems = [];
          results.forEach(r => {
            if (r.result) {
              if (r.result.pageText) combinedContent += r.result.pageText + "\n";
              if (r.result.elements) combinedElems = combinedElems.concat(r.result.elements);
            }
          });

          const payload = {
            question,
            pageContent: combinedContent.substring(0, 3000),
            interactiveElements: combinedElems.slice(0, 400),
            history: conversationHistory,
            lang: langSelect.value
          };

          let responseData;
          try {
            const res = await fetch(BACKEND_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            responseData = await res.json();
          } catch (err) {
            console.warn('Local backend failed, trying Render...', err);
            try {
              const res2 = await fetch(RENDER_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              responseData = await res2.json();
            } catch (err2) {
              console.error(err2);
              setUIState('idle', 'backend not running');
              addMessageAndSave('assistant', 'Backend not reachable.');
              return;
            }
          }

          const answerText = responseData.text;
          conversationHistory.push({ role: 'user',      content: question   });
          conversationHistory.push({ role: 'assistant', content: answerText });

          addMessageAndSave('assistant', answerText);
          
          if (responseData.action) {
            pendingAction = responseData.action;
          } else {
            pendingAction = null;
          }
          
          speakText(answerText, responseData.audio);
        }
      );
    });
  });
}

// ------------------ PAGE ACTION DISPATCH ------------------

function executePageAction(action) {
  if (!originalTabId || !action) return;

  setUIState('ready', `${action.type}ing...`);

  chrome.scripting.executeScript({
    target: { tabId: originalTabId, allFrames: true },
    func: (act) => {
      const { type, target, value } = act;

      function findEl(tgt) {
        if (!tgt) return null;
        const lc = tgt.toLowerCase();
        const all = document.querySelectorAll('button, a, input, [role="button"], [tabindex], *');
        
        let bestMatch = null;
        for (const el of all) {
          const t = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().toLowerCase();
          if (t === lc) return el;
          if (t.includes(lc) || lc.includes(t)) bestMatch = el;
        }
        return bestMatch;
      }

      function findInput(tgt) {
        if (!tgt) return null;
        const lc = tgt.toLowerCase();
        const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
        for (const el of inputs) {
          const ph = (el.placeholder || '').toLowerCase();
          const nm = (el.name || el.id || '').toLowerCase();
          const lbl = (el.getAttribute('aria-label') || '').toLowerCase();
          if (ph.includes(lc) || nm.includes(lc) || lbl.includes(lc) || lc.includes(ph)) return el;
        }
        return null;
      }

      try {
        switch (type) {
          case 'click': {
            const el = findEl(target);
            if (!el) return { success: false, message: `could not find "${target}"` };
            el.click();
            return { success: true, message: `clicked "${target}" ✓` };
          }
          case 'scroll': {
            if (value === 'top') { window.scrollTo({ top: 0, behavior: 'smooth' }); return { success: true, message: 'scrolled top ✓' }; }
            if (value === 'bottom') { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); return { success: true, message: 'scrolled bottom ✓' }; }
            if (value === 'up') { window.scrollBy({ top: -400, behavior: 'smooth' }); return { success: true, message: 'scrolled up ✓' }; }
            if (value === 'down' || (!target && !value)) { window.scrollBy({ top: 400, behavior: 'smooth' }); return { success: true, message: 'scrolled down ✓' }; }
            if (target) {
              const el = findEl(target);
              if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); return { success: true, message: `scrolled to "${target}" ✓` }; }
            }
            window.scrollBy({ top: 400, behavior: 'smooth' });
            return { success: true, message: 'scrolled down ✓' };
          }
          case 'fill': {
            const el = findInput(target);
            if (!el) return { success: false, message: `could not find input "${target}"` };
            el.focus();
            el.value = value || '';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true, message: `typed "${value}" ✓` };
          }
          case 'navigate': {
            let url = (value || '').trim();
            if (!url) return { success: false, message: `no URL provided` };
            if (!url.startsWith('http')) url = 'https://' + url;
            window.location.href = url;
            return { success: true, message: `navigating...` };
          }
          case 'submit': {
            const form = document.activeElement?.closest('form') || document.querySelector('form');
            if (form) { form.submit(); return { success: true, message: 'submitted ✓' }; }
            return { success: false, message: 'no form found' };
          }
        }
      } catch (err) {
        return { success: false, message: err.message };
      }
      return null;
    },
    args: [action]
  }, (results) => {
    if (chrome.runtime.lastError) {
      setUIState('ready', 'action failed — try refreshing');
      setTimeout(() => setUIState('ready', 'tap to speak'), 2500);
      return;
    }

    // Capture the first frame that successfully handled the action
    const valid = results.find(r => r.result && r.result.success);
    const result = valid ? valid.result : results[0]?.result;
    
    if (result?.success) {
      setUIState('ready', result.message || 'done ✓');
    } else {
      setUIState('ready', result?.message || 'element not found');
    }
    setTimeout(() => setUIState('ready', 'tap to speak'), 2500);
  });
}

// ------------------ AUDIO ------------------

function speakText(text, audioBase64) {
  // Always cancel any ongoing speech first
  stopAllAudio();

  // Increment generation so stale callbacks from old audio are ignored
  speakGeneration++;
  const gen = speakGeneration;

  isSpeaking = true; syncGlobals();
  isPaused   = false;
  setUIState('speaking');

  if (audioBase64) {
    currentAudio = new Audio('data:audio/mp3;base64,' + audioBase64);
    currentAudio.onended = () => {
      if (gen !== speakGeneration) return; // stale — ignore
      onSpeakingDone();
    };
    currentAudio.onerror = () => {
      if (gen !== speakGeneration) return; // stale — ignore
      currentAudio = null;
      fallbackTTS(text, gen);
    };
    currentAudio.play().catch(() => {
      if (gen !== speakGeneration) return;
      fallbackTTS(text, gen);
    });
  } else {
    fallbackTTS(text, gen);
  }
}

function fallbackTTS(text, gen) {
  // Cancel any leftover synthesis
  window.speechSynthesis.cancel();

  // If this generation is already stale, don't start new TTS
  if (gen !== speakGeneration) return;

  // Detect language from text script when on 'auto'
  let lang = langSelect.value;
  if (lang === 'auto') {
    const hasDevanagari = /[\u0900-\u097F]/.test(text);
    const hasTelugu     = /[\u0C00-\u0C7F]/.test(text);
    if (hasTelugu)     lang = 'te';
    else if (hasDevanagari) lang = 'hi';
    else               lang = 'en';
  }

  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.lang  = lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : 'en-IN';
  currentUtterance.rate  = 0.95;
  currentUtterance.pitch = 1;

  currentUtterance.onstart = () => {
    if (gen !== speakGeneration) return;
    setUIState('speaking', 'speaking...');
  };

  currentUtterance.onend = () => {
    if (gen !== speakGeneration) return; // stale — ignore
    currentUtterance = null;
    onSpeakingDone();
  };

  currentUtterance.onerror = (e) => {
    if (gen !== speakGeneration) return; // stale — ignore
    // 'interrupted'/'canceled' fires when we deliberately cancel — ignore
    currentUtterance = null;
    if (e.error === 'interrupted' || e.error === 'canceled') return;
    console.warn('TTS error:', e.error);
    onSpeakingDone();
  };

  window.speechSynthesis.speak(currentUtterance);
}

function stopAllAudio() {
  // Stop Murf MP3 — remove handlers BEFORE pausing to prevent ghost events
  if (currentAudio) {
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
  // Stop system TTS — nullify utterance ref BEFORE cancel
  if (currentUtterance) {
    currentUtterance.onstart = null;
    currentUtterance.onend   = null;
    currentUtterance.onerror = null;
  }
  currentUtterance = null;
  window.speechSynthesis.cancel();
}

function onSpeakingDone() {
  if (!isSpeaking) return;
  isSpeaking = false; syncGlobals();
  isPaused   = false;
  setUIState('ready', 'tap or hold Ctrl to speak');

  if (pendingAction) {
    const act = pendingAction;
    pendingAction = null;
    executePageAction(act);
  }
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
  isSpeaking       = false; syncGlobals();
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

  setUIState('ready', 'tap or hold Ctrl to speak');
});

// ------------------ CLEAR ------------------

document.getElementById('clearBtn').addEventListener('click', () => {
  stopAllAudio();
  isSpeaking = false; syncGlobals();
  isPaused   = false;

  document.getElementById('chatHistory').innerHTML = '';
  conversationHistory = [];
  savedBubbles        = [];

  chrome.storage.session.remove(['chatHistory', 'conversationHistory']);
  setUIState('ready', 'tap or hold Ctrl to speak');
});

// ------------------ EXPORT CHAT ------------------

document.getElementById('exportBtn').addEventListener('click', () => {
  if (!savedBubbles.length) {
    setUIState('ready', 'no messages to export');
    return;
  }

  const now = new Date();
  const dateStr = now.toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  let content = `VoxLens Chat Export\n`;
  content += `Date: ${dateStr}\n`;
  content += `${'─'.repeat(40)}\n\n`;

  savedBubbles.forEach(msg => {
    const label = msg.role === 'user' ? 'YOU' : 'VOXLENS';
    content += `[${label}]\n${msg.text}\n\n`;
  });

  content += `${'─'.repeat(40)}\nExported by VoxLens\n`;

  // Create blob and trigger download
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `voxlens-chat-${now.toISOString().slice(0,10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);

  setUIState('ready', 'chat exported ✓');
});

// ------------------ CLEANUP ------------------

window.addEventListener('unload', () => {
  if (recognition) { try { recognition.stop(); } catch(e) {} }
  stopAllAudio();
});
