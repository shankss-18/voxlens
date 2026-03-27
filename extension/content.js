// content.js — inject VoxLens panel + execute DOM actions

let voxlensContainer = null;
let voxlensIframe    = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // Toggle the floating VoxLens panel
  if (request.action === "toggleVoxLens") {
    if (voxlensContainer) {
      destroyPanel();
      sendResponse({ ok: true, isOpen: false });
    } else {
      createPanel();
      sendResponse({ ok: true, isOpen: true });
    }
    return;
  }

  // Show panel (used by background.js when navigating — always opens, never closes)
  if (request.action === "showPanel") {
    if (!voxlensContainer) createPanel();
    sendResponse({ ok: true, isOpen: true });
    return;
  }

  // Execute a DOM action sent from popup.js
  if (request.action === "executeAction") {
    const result = runAction(request.payload);
    sendResponse(result);
    return;
  }
});

// ── DOM Action Executor ────────────────────────────────────────────────────────

function findElementByText(tag, text) {
  if (!text) return null;
  const lc = text.toLowerCase();

  function search(root) {
    const all = root.querySelectorAll(tag);
    // Exact match
    for (const el of all) {
      const t = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().toLowerCase();
      if (t === lc) return el;
    }
    // Partial match
    for (const el of all) {
      const t = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().toLowerCase();
      if (t.includes(lc) || lc.includes(t)) return el;
    }
    // Deep search in Shadow DOM
    const children = root.querySelectorAll('*');
    for (const child of children) {
      if (child.shadowRoot) {
        const found = search(child.shadowRoot);
        if (found) return found;
      }
    }
    return null;
  }
  return search(document);
}

function findInput(target) {
  if (!target) return null;
  const lc = target.toLowerCase();

  function search(root) {
    const inputs = root.querySelectorAll('input, textarea, select');
    for (const el of inputs) {
      const ph   = (el.placeholder || '').toLowerCase();
      const lbl  = (el.getAttribute('aria-label') || '').toLowerCase();
      const name = (el.getAttribute('name')       || '').toLowerCase();
      const id   = (el.id                         || '').toLowerCase();
      if (ph.includes(lc) || lbl.includes(lc) || name.includes(lc) || id.includes(lc) ||
          lc.includes(ph) || lc.includes(lbl)) {
        return el;
      }
    }
    // Deep search in Shadow DOM
    const children = root.querySelectorAll('*');
    for (const child of children) {
      if (child.shadowRoot) {
        const found = search(child.shadowRoot);
        if (found) return found;
      }
    }
    return null;
  }
  return search(document);
}

function runAction(action) {
  const { type, target, value } = action;

  try {
    switch (type) {

      case 'click': {
        // Try button first, then link, then any element
        const el = findElementByText('button, [role="button"], input[type="submit"]', target)
                || findElementByText('a', target)
                || findElementByText('*', target);
        if (!el) return { success: false, message: `couldn't find "${target}"` };
        el.click();
        return { success: true, message: `clicked "${el.innerText?.trim() || target}" ✓` };
      }

      case 'scroll': {
        if (value === 'top') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return { success: true, message: 'scrolled to top ✓' };
        }
        if (value === 'bottom') {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          return { success: true, message: 'scrolled to bottom ✓' };
        }
        if (value === 'up') {
          window.scrollBy({ top: -400, behavior: 'smooth' });
          return { success: true, message: 'scrolled up ✓' };
        }
        if (value === 'down' || (!target && !value)) {
          window.scrollBy({ top: 400, behavior: 'smooth' });
          return { success: true, message: 'scrolled down ✓' };
        }
        // Scroll to a specific element by text
        if (target) {
          const el = findElementByText('*', target);
          if (!el) return { success: false, message: `couldn't find "${target}" to scroll to` };
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return { success: true, message: `scrolled to "${target}" ✓` };
        }
        window.scrollBy({ top: 400, behavior: 'smooth' });
        return { success: true, message: 'scrolled down ✓' };
      }

      case 'fill': {
        const el = findInput(target);
        if (!el) return { success: false, message: `couldn't find input "${target}"` };
        el.focus();
        el.value = value || '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true, message: `typed "${value}" ✓` };
      }

      case 'navigate': {
        const url = value?.startsWith('http') ? value : `https://${value}`;
        window.location.href = url;
        return { success: true, message: `navigating to ${url}` };
      }

      case 'submit': {
        // Try clicking the submit button first
        const submitBtn = document.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn) {
          submitBtn.click();
          return { success: true, message: 'submitted ✓' };
        }
        // Try submitting the active form
        const activeEl = document.activeElement;
        const form = activeEl?.closest('form') || document.querySelector('form');
        if (form) {
          form.submit();
          return { success: true, message: 'form submitted ✓' };
        }
        // Press Enter on active element
        if (activeEl) {
          activeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          return { success: true, message: 'pressed Enter ✓' };
        }
        return { success: false, message: 'no form or submit button found' };
      }

      default:
        return { success: false, message: `unknown action type: ${type}` };
    }
  } catch (err) {
    console.error('[VoxLens action]', err);
    return { success: false, message: err.message };
  }
}

// ── Floating Panel ─────────────────────────────────────────────────────────────

function createPanel() {
  voxlensContainer = document.createElement('div');
  voxlensContainer.id = 'voxlens-host';

  const shadow = voxlensContainer.attachShadow({ mode: 'open' });

  const wrapper = document.createElement('div');
  wrapper.id = 'voxlens-wrapper';

  const dragHandle = document.createElement('div');
  dragHandle.id = 'voxlens-drag-handle';

  voxlensIframe = document.createElement('iframe');
  voxlensIframe.id = 'voxlens-iframe';
  voxlensIframe.src = chrome.runtime.getURL('popup.html');
  voxlensIframe.allow = 'microphone; autoplay';

  const style = document.createElement('style');
  style.textContent = `
    #voxlens-wrapper {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 360px;
      height: 530px;
      z-index: 2147483647;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06);
      background: #080808;
      transition: box-shadow 0.2s;
    }
    #voxlens-wrapper:hover {
      box-shadow: 0 12px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(232,255,107,0.12);
    }
    #voxlens-drag-handle {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 40px;
      cursor: grab;
      z-index: 10;
      user-select: none;
    }
    #voxlens-drag-handle:active { cursor: grabbing; }
    #voxlens-iframe {
      width: 100%; height: 100%;
      border: none; border-radius: 14px; display: block;
    }
  `;

  wrapper.appendChild(style);
  wrapper.appendChild(dragHandle);
  wrapper.appendChild(voxlensIframe);
  shadow.appendChild(wrapper);
  document.body.appendChild(voxlensContainer);

  // Drag
  let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;

  dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragOffsetX = e.clientX - wrapper.getBoundingClientRect().left;
    dragOffsetY = e.clientY - wrapper.getBoundingClientRect().top;
    wrapper.style.transition = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const maxX = window.innerWidth  - wrapper.offsetWidth;
    const maxY = window.innerHeight - wrapper.offsetHeight;
    wrapper.style.left  = Math.max(0, Math.min(e.clientX - dragOffsetX, maxX)) + 'px';
    wrapper.style.top   = Math.max(0, Math.min(e.clientY - dragOffsetY, maxY)) + 'px';
    wrapper.style.right = 'auto';
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) { isDragging = false; wrapper.style.transition = ''; }
  });
}

function destroyPanel() {
  if (voxlensContainer) {
    voxlensContainer.remove();
    voxlensContainer = null;
    voxlensIframe    = null;
  }
}
// ── Spacebar Push-to-Talk ──────────────────────────────────────────────────────

let spaceHeld = false;

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Control') return;
  if (!voxlensIframe) return;

  // Don't intercept if user is typing in an input/textarea/editable
  const active = document.activeElement;
  const isInput = active && (
    active.tagName === 'INPUT' || 
    active.tagName === 'TEXTAREA' || 
    active.isContentEditable ||
    active.getAttribute('role') === 'textbox'
  );
  if (isInput) return;

  if (e.repeat) return;
  if (spaceHeld) return;
  
  e.preventDefault();
  spaceHeld = true;

  voxlensIframe.contentWindow.postMessage({ action: 'ptt_start' }, '*');
}, true);

document.addEventListener('keyup', (e) => {
  if (e.key !== 'Control') return;
  if (!spaceHeld) return;

  e.preventDefault();
  spaceHeld = false;

  if (voxlensIframe) {
    voxlensIframe.contentWindow.postMessage({ action: 'ptt_stop' }, '*');
  }
}, true);


