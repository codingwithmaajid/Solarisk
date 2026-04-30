// Solarisk Content Script
// Matches your existing GitHub repo logic

// Listen for GET_CONTEXT message from popup (your original pattern)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_CONTEXT") {
    let context = "";

    // Detect wallets (matching your original logic)
    if (window.solana || window.phantom) {
      context += "Phantom wallet detected. ";
    }
    if (window.ethereum) {
      context += "MetaMask/Ethereum wallet detected. ";
    }
    if (window.solflare) {
      context += "Solflare wallet detected. ";
    }
    if (window.backpack) {
      context += "Backpack wallet detected. ";
    }

    // Grab page text (matching your original logic)
    const text = document.body.innerText.slice(0, 1000);
    context += "Page content: " + text;

    sendResponse({ context });
  }

  return true; // Keep message channel open for async response
});

// Also notify background when wallets are detected on page load
window.addEventListener("load", () => {
  setTimeout(() => {
    const wallets = [];
    
    if (window.solana || window.phantom) wallets.push("Phantom");
    if (window.ethereum) wallets.push("MetaMask/Ethereum");
    if (window.solflare) wallets.push("Solflare");
    if (window.backpack) wallets.push("Backpack");
    
    if (wallets.length > 0) {
      chrome.runtime.sendMessage({
        type: "WALLET_DETECTED",
        wallet: wallets.join(", "),
        url: window.location.href
      });
    }
  }, 1000);
});

// Monitor for Solana transaction requests
if (window.solana) {
  const originalSignTransaction = window.solana.signTransaction;
  const originalSignAllTransactions = window.solana.signAllTransactions;
  const originalSignAndSendTransaction = window.solana.signAndSendTransaction;

  if (originalSignTransaction) {
    window.solana.signTransaction = async function(transaction) {
      chrome.runtime.sendMessage({
        type: "TRANSACTION_DETECTED",
        data: { method: "signTransaction", url: window.location.href, timestamp: Date.now() }
      });
      return originalSignTransaction.call(this, transaction);
    };
  }

  if (originalSignAllTransactions) {
    window.solana.signAllTransactions = async function(transactions) {
      chrome.runtime.sendMessage({
        type: "TRANSACTION_DETECTED",
        data: { method: "signAllTransactions", count: transactions.length, url: window.location.href, timestamp: Date.now() }
      });
      return originalSignAllTransactions.call(this, transactions);
    };
  }

  if (originalSignAndSendTransaction) {
    window.solana.signAndSendTransaction = async function(transaction, options) {
      chrome.runtime.sendMessage({
        type: "TRANSACTION_DETECTED",
        data: { method: "signAndSendTransaction", url: window.location.href, timestamp: Date.now() }
      });
      return originalSignAndSendTransaction.call(this, transaction, options);
    };
  }
}

// Monitor for Ethereum transaction requests
if (window.ethereum) {
  const originalRequest = window.ethereum.request;
  
  if (originalRequest) {
    window.ethereum.request = async function(args) {
      if (["eth_sendTransaction", "eth_signTransaction", "personal_sign", "eth_signTypedData_v4"].includes(args.method)) {
        chrome.runtime.sendMessage({
          type: "TRANSACTION_DETECTED",
          data: { method: args.method, url: window.location.href, timestamp: Date.now() }
        });
      }
      return originalRequest.call(this, args);
    };
  }
}

console.log("Solarisk content script loaded");
