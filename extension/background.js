// background.js — track the last active webpage tab + toggle injected panel

function isValidTab(url) {
  if (!url) return false;
  const voxUrl = chrome.runtime.getURL('popup.html');
  return !url.startsWith(voxUrl) &&
         !url.startsWith('chrome://') &&
         !url.startsWith('chrome-extension://');
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    if (isValidTab(tab.url)) {
      chrome.storage.session.set({ lastActiveTabId: tabId });
    }
  });
});

// When a tab finishes loading, re-inject panel if it was open
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.active) return;
  if (!isValidTab(tab.url)) return;

  chrome.storage.session.set({ lastActiveTabId: tabId });

  // Check if panel was open and re-inject it
  chrome.storage.session.get('voxlensPanelOpen', async (data) => {
    if (!data.voxlensPanelOpen) return;

    // Small delay to let the page settle
    await new Promise(r => setTimeout(r, 500));

    try {
      await chrome.tabs.sendMessage(tabId, { action: 'showPanel' });
    } catch {
      // Content script orphaned — re-inject it first
      try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
        await new Promise(r => setTimeout(r, 100));
        await chrome.tabs.sendMessage(tabId, { action: 'showPanel' });
      } catch (e) {
        console.warn('VoxLens: could not restore panel on', tab.url, e);
      }
    }
  });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.session.clear();
});

// When extension icon is clicked, toggle panel and persist its state
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !isValidTab(tab.url)) return;

  chrome.storage.session.set({ lastActiveTabId: tab.id });

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'toggleVoxLens' });
    // Update persisted state based on whether panel is now open
    if (response) {
      chrome.storage.session.set({ voxlensPanelOpen: response.isOpen });
    }
  } catch {
    // Content script not injected yet — inject and open
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      await new Promise(r => setTimeout(r, 100));
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'toggleVoxLens' });
      if (response) {
        chrome.storage.session.set({ voxlensPanelOpen: response.isOpen });
      }
    } catch (e) {
      console.warn('VoxLens: could not inject into this tab', e);
    }
  }
});
