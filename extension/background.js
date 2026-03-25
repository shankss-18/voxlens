chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveHistory') {
    chrome.storage.session.set({ 
      chatHistory: request.chatHistory,
      conversationHistory: request.conversationHistory 
    });
  }
  if (request.action === 'loadHistory') {
    chrome.storage.session.get(['chatHistory', 'conversationHistory'], (data) => {
      sendResponse(data);
    });
    return true;
  }
  if (request.action === 'clearHistory') {
    chrome.storage.session.remove(['chatHistory', 'conversationHistory']);
  }
});