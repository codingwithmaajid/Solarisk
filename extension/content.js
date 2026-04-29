chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_CONTEXT") {
    let context = "";

    // basic detection
    if (window.solana) {
      context += "Phantom wallet detected. ";
    }

    // grab page text
    const text = document.body.innerText.slice(0, 1000);

    context += "Page content: " + text;

    sendResponse({ context });
  }

  return true; // 🔥 THIS FIXES YOUR ISSUE
});