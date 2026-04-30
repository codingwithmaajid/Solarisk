// Solarisk Background Service Worker

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Solarisk extension installed");
  
  // Clear any saved state on fresh install
  chrome.storage.local.set({ currentPage: "dodo" });
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
    chrome.storage.local.set({
      pendingTransaction: request.data,
      detectedAt: Date.now()
    });
  }
  
  return true;
});

// Clear badge when popup is opened
chrome.action.onClicked.addListener(() => {
  chrome.action.setBadgeText({ text: "" });
});
