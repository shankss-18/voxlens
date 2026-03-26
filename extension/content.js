chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageContent") {
    const main = document.querySelector("article") ||
                 document.querySelector("main") ||
                 document.body;

    let text = main.innerText;
    text = text.replace(/\n{3,}/g, "\n\n").trim();
    text = text.substring(0, 3000);

    sendResponse({ content: text });
  }
});
