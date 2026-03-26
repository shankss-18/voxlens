const dot           = document.getElementById('dot');
const indicatorText = document.getElementById('indicatorText');
const micBtn        = document.getElementById('micBtn');
const micWrap       = document.getElementById('micWrap');
const statusText    = document.getElementById('statusText');
const wave          = document.getElementById('wave');
const chatHistory   = document.getElementById('chatHistory');
const langSelect    = document.getElementById('langSelect');
const voiceControls = document.getElementById('voiceControls');
const pauseBtn      = document.getElementById('pauseBtn');
const stopBtn       = document.getElementById('stopBtn');

const bars = Array.from({ length: 10 }, (_, i) => document.getElementById('wb' + (i + 1)));
let waveInterval = null;

function setUIState(state, text) {
  // Reset UI
  micBtn.className     = 'mic-btn';
  micBtn.style.opacity = '1';
  micWrap.className    = 'mic-wrap';
  dot.className        = 'dot';
  statusText.className = 'status-text';
  wave.classList.remove('visible');
  clearInterval(waveInterval);
  bars.forEach(b => b.style.height = '4px');
  voiceControls.style.display = 'none';
  pauseBtn.textContent = '⏸ pause';

  indicatorText.textContent = state;

  if (state === 'listening') {
    micBtn.classList.add('listening');
    micWrap.classList.add('listening');
    dot.classList.add('rec');

    statusText.classList.add('active');
    statusText.textContent = text || 'listening... click to stop';

    wave.classList.add('visible');
    waveInterval = setInterval(() => {
      bars.forEach(b => b.style.height = (Math.random() * 14 + 3) + 'px');
    }, 90);

  } else if (state === 'thinking') {
    dot.classList.add('on');

    statusText.classList.add('active');
    statusText.textContent = text || 'thinking...';

  } else if (state === 'speaking') {
    micBtn.classList.add('speaking');
    micWrap.classList.add('speaking');
    dot.classList.add('on');

    statusText.classList.add('accent');
    statusText.textContent = text || 'speaking...';

    wave.classList.add('visible');
    voiceControls.style.display = 'flex';

    waveInterval = setInterval(() => {
      bars.forEach(b => b.style.height = (Math.random() * 16 + 3) + 'px');
    }, 80);

  } else if (state === 'ready') {
    dot.classList.add('on');
    statusText.textContent = text || 'tap to speak';

  } else {
    statusText.textContent = text || 'tap to speak';
  }
}

// Add chat message to UI
function addMessage(role, text) {
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + role;

  const label = document.createElement('div');
  label.className = 'msg-label';
  label.textContent = role === 'user' ? 'YOU' : 'VOXLENS';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;

  wrap.appendChild(label);
  wrap.appendChild(bubble);
  chatHistory.appendChild(wrap);

  chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Spacebar shortcut for mic
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target === document.body) {
    e.preventDefault();
    micBtn.click();
  }
});
