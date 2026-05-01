// Solarisk Background Service Worker

function setState(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, resolve);
  });
}

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Solarisk extension installed");

  // Clear any saved state on fresh install
  setState({
    currentPage: "dodo",
    latestScanState: null,
    latestPageContext: null,
    latestTransactionSignal: null,
    pendingTransaction: null,
  });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "WALLET_DETECTED") {
    // Store wallet detection info
    chrome.storage.local.set({ 
      walletDetected: request.wallet,
      detectedAt: Date.now()
    });
    
    // Show badge to indicate wallet was detected
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#EAB308" });
  }

  if (request.type === "TRANSACTION_DETECTED") {
    // Alert user about transaction
    chrome.action.setBadgeText({ text: "TX" });
    chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });
    
    // Store transaction data for analysis
    setState({
      pendingTransaction: request.data,
      latestTransactionSignal: request.data,
      detectedAt: Date.now()
    });
  }

  if (request.type === "PAGE_CONTEXT_CAPTURED") {
    setState({
      latestPageContext: request.data,
      latestContextAt: Date.now(),
    });
  }

  if (request.type === "SCAN_RESULT_READY") {
    setState({
      latestScanState: request.data,
      lastScanAt: Date.now(),
    });

    chrome.action.setBadgeText({ text: "" });
  }
  
  return true;
});

// Clear badge when popup is opened
chrome.action.onClicked.addListener(() => {
  chrome.action.setBadgeText({ text: "" });
});
