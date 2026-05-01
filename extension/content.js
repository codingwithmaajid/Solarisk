// Solarisk Content Script
// Matches your existing GitHub repo logic

function detectDemoScenario() {
  const metaScenario = document.querySelector('meta[name="solarisk-scenario"]')?.content?.toLowerCase?.() || "";
  const dataScenario = document.body?.dataset?.solariskScenario?.toLowerCase?.() || "";
  const path = window.location.pathname.toLowerCase();
  const href = window.location.href.toLowerCase();
  const direct = metaScenario || dataScenario;

  if (["safe", "warning", "danger"].includes(direct)) {
    return direct;
  }

  if (path.includes("/demo/safe") || href.includes("solarisk-demo=safe")) return "safe";
  if (path.includes("/demo/warning") || href.includes("solarisk-demo=warning")) return "warning";
  if (path.includes("/demo/danger") || href.includes("solarisk-demo=danger")) return "danger";

  return "";
}

function detectWallets() {
  const wallets = [];

  if (window.solana || window.phantom) wallets.push("Phantom");
  if (window.ethereum) wallets.push("MetaMask/Ethereum");
  if (window.solflare) wallets.push("Solflare");
  if (window.backpack) wallets.push("Backpack");

  return wallets;
}

function buildContext() {
  const wallets = detectWallets();
  const scenario = detectDemoScenario();
  const title = document.title ? `Page title: ${document.title}. ` : "";
  const text = document.body?.innerText?.slice(0, 1200) || "";
  const scenarioPrefix = scenario ? `Solarisk demo scenario: ${scenario}. ` : "";
  const walletPrefix = wallets.length ? `Wallets detected: ${wallets.join(", ")}. ` : "";

  return {
    context: `${scenarioPrefix}${walletPrefix}${title}Page content: ${text}`,
    scenario,
    wallets,
  };
}

// Listen for GET_CONTEXT message from popup (your original pattern)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_CONTEXT") {
    const payload = buildContext();

    chrome.runtime.sendMessage({
      type: "PAGE_CONTEXT_CAPTURED",
      data: {
        url: window.location.href,
        title: document.title,
        scenario: payload.scenario,
        wallets: payload.wallets,
        context: payload.context,
        capturedAt: Date.now(),
      },
    });

    sendResponse(payload);
  }

  return true; // Keep message channel open for async response
});

// Also notify background when wallets are detected on page load
window.addEventListener("load", () => {
  setTimeout(() => {
    const wallets = detectWallets();

    if (wallets.length > 0) {
      chrome.runtime.sendMessage({
        type: "WALLET_DETECTED",
        wallet: wallets.join(", "),
        url: window.location.href
      });
    }

    const scenario = detectDemoScenario();
    if (scenario) {
      chrome.runtime.sendMessage({
        type: "PAGE_CONTEXT_CAPTURED",
        data: {
          url: window.location.href,
          title: document.title,
          scenario,
          wallets,
          context: buildContext().context,
          capturedAt: Date.now(),
        },
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
