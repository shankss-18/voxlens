let recognition;

function startRecognition(lang = 'en-IN') {
  const SpeechRecognition = self.SpeechRecognition || self.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    chrome.runtime.sendMessage({
      action: 'speechError',
      error: 'SpeechRecognition not supported'
    });
    return;
  }

  // Stop any existing recognition first
  if (recognition) {
    try { recognition.stop(); } catch(e) {}
    recognition = null;
  }

  recognition = new SpeechRecognition();
  recognition.lang = lang;
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    chrome.runtime.sendMessage({
      action: 'speechResult',
      text: transcript
    });
  };

  recognition.onerror = (e) => {
    chrome.runtime.sendMessage({
      action: 'speechError',
      error: e.error
    });
  };

  recognition.onend = () => {
    chrome.runtime.sendMessage({ action: 'speechEnd' });
  };

  recognition.start();
}

// Listen for commands from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'startListening') {
    startRecognition(msg.lang || 'en-IN');
  }

  if (msg.action === 'stopListening' && recognition) {
    try { recognition.stop(); } catch(e) {}
  }
});