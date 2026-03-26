// background.js — track the last active webpage tab for popup to query

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    const voxUrl = chrome.runtime.getURL('popup.html');
    if (tab.url &&
        !tab.url.startsWith(voxUrl) &&
        !tab.url.startsWith('chrome://') &&
        !tab.url.startsWith('chrome-extension://')) {
      chrome.storage.session.set({ lastActiveTabId: tabId });
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    const voxUrl = chrome.runtime.getURL('popup.html');
    if (tab.url &&
        !tab.url.startsWith(voxUrl) &&
        !tab.url.startsWith('chrome://') &&
        !tab.url.startsWith('chrome-extension://')) {
      chrome.storage.session.set({ lastActiveTabId: tabId });
    }
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.session.clear();
});
