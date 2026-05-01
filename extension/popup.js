// Solarisk Popup Script

// API endpoints - deployed Solarisk backend
const API_URL = "https://solarisk.vercel.app/api/ai";
const DODO_CHECKOUT_URL = "https://solarisk.vercel.app/api/dodo-checkout";

const BUTTON_LABELS = {
  dodo: "DoDo Payments",
  skip: "Skip",
  connect: "connect",
  continue: "Continue",
  execute: "Protect & Execute",
  payExecute: "Pay & Execute",
};

// DOM Elements
const pages = {
  dodo: document.getElementById("page-dodo"),
  connect: document.getElementById("page-connect"),
  dashboard: document.getElementById("page-dashboard"),
};

const buttons = {
  dodo: document.getElementById("btn-dodo"),
  skip: document.getElementById("btn-skip"),
  connect: document.getElementById("btn-connect"),
  continue: document.getElementById("btn-continue"),
  execute: document.getElementById("btn-execute"),
  payExecute: document.getElementById("btn-pay-execute"),
};

const panel = {
  scanningOverlay: document.getElementById("scanning-overlay"),
  statusBadge: document.getElementById("status-badge"),
  statusText: document.getElementById("status-text"),
  content: document.getElementById("panel-content"),
  actions: document.getElementById("panel-actions"),
  activityText: document.getElementById("activity-text"),
  analysisText: document.getElementById("analysis-text"),
  adviceText: document.getElementById("advice-text"),
  riskCard: document.getElementById("risk-card"),
  riskText: document.getElementById("risk-text"),
};

function onClick(button, handler) {
  if (!button) return;
  button.addEventListener("click", handler);
}

function setText(element, text) {
  if (element) element.textContent = text;
}

function setStorage(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, resolve);
  });
}

function getStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

// Navigation
async function showPage(pageName, options = {}) {
  const shouldScan = options.scan !== false;

  Object.values(pages).forEach((page) => {
    if (page) page.classList.remove("active");
  });

  if (!pages[pageName]) return;

  pages[pageName].classList.add("active");
  await setStorage({ currentPage: pageName });

  if (pageName === "dashboard" && shouldScan) {
    startScan();
  }
}

// Loading States
function showLoading(button, text) {
  if (!button) return;
  button.disabled = true;
  button.innerHTML = `<div class="spinner"></div><span>${text}</span>`;
}

function hideLoading(button, text) {
  if (!button) return;
  button.disabled = false;
  button.innerHTML = `<span>${text}</span>`;
}

async function showCheckoutError(message) {
  if (!pages.dashboard?.classList.contains("active")) {
    await showPage("dashboard", { scan: false });
  }

  updatePanel({
    activity: "Checkout failed",
    analysis: message || "Unable to create a Dodo checkout session.",
    riskLevel: "Warning",
    advice: "Try again, or continue without payment for this MVP demo.",
  });
}

async function createDodoCheckout(button) {
  showLoading(button, "Creating checkout...");

  try {
    const response = await fetch(DODO_CHECKOUT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.checkout_url) {
      throw new Error(data.error || "Dodo checkout did not return a checkout URL.");
    }

    chrome.tabs.create({ url: data.checkout_url });
  } catch (err) {
    console.error("Dodo checkout error:", err);
    await showCheckoutError(err.message);
  } finally {
    const label = button === buttons.payExecute ? BUTTON_LABELS.payExecute : BUTTON_LABELS.dodo;
    hideLoading(button, label);
  }
}

// Button Handlers
onClick(buttons.dodo, () => {
  createDodoCheckout(buttons.dodo);
});

onClick(buttons.skip, () => {
  showPage("dashboard");
});

onClick(buttons.connect, async () => {
  showLoading(buttons.connect, "Connecting...");

  await setStorage({
    walletConnected: true,
    walletProvider: "Simulated Solana Wallet",
    walletConnectedAt: Date.now(),
  });

  hideLoading(buttons.connect, BUTTON_LABELS.connect);
  showPage("dashboard");
});

onClick(buttons.continue, () => {
  updatePanel({
    activity: "Continuing unprotected",
    analysis: "You chose to continue without Solarisk Safe Execution Mode. No transaction has been sent by Solarisk.",
    riskLevel: "Warning",
    advice: "Only proceed if you understand the site and the wallet request.",
  });
});

onClick(buttons.execute, () => {
  updatePanel({
    activity: "Safe Execution Mode enabled",
    analysis: "Solarisk will treat the next action as protected. This MVP does not submit blockchain transactions automatically.",
    riskLevel: "Safe",
    advice: "Review the wallet prompt carefully before approving anything in your wallet.",
  });
});

onClick(buttons.payExecute, () => {
  createDodoCheckout(buttons.payExecute);
});

function isUnsupportedUrl(url) {
  if (!url) return true;

  return [
    "chrome://",
    "chrome-extension://",
    "edge://",
    "about:",
    "file://",
    "https://chrome.google.com/webstore",
    "https://chromewebstore.google.com",
  ].some((prefix) => url.startsWith(prefix));
}

function setScanningState() {
  panel.scanningOverlay?.classList.add("active");
  panel.content?.classList.add("scanning");
  panel.actions?.classList.add("disabled");

  if (panel.statusBadge) {
    panel.statusBadge.className = "status-badge status-scanning";
  }

  setText(panel.statusText, "Scanning");
}

// Scanning & Analysis (matches your original GitHub repo pattern)
async function startScan() {
  setScanningState();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id || isUnsupportedUrl(tab.url)) {
      updatePanel({
        activity: "Unsupported page",
        analysis: "Chrome internal pages, extension pages, local files, and Web Store pages cannot be scanned by content scripts.",
        riskLevel: "Warning",
        advice: "Open a normal website or dApp, then run Solarisk again.",
      });
      return;
    }

    // Use your original GET_CONTEXT pattern from content.js
    chrome.tabs.sendMessage(tab.id, { type: "GET_CONTEXT" }, async (response) => {
      const runtimeError = chrome.runtime.lastError;

      if (runtimeError) {
        updatePanel({
          activity: "Page scan unavailable",
          analysis: runtimeError.message || "Solarisk could not reach the content script on this page.",
          riskLevel: "Warning",
          advice: "Refresh the page and try again. Some browser pages cannot be scanned.",
        });
        return;
      }

      try {
        // Check if content script responded (your original pattern)
        if (!response?.context) {
          updatePanel({
            activity: "No page data found",
            analysis: "Content script returned no readable page context.",
            riskLevel: "Warning",
            advice: "Refresh the page and try again.",
          });
          return;
        }

        // Call your deployed API at solarisk.vercel.app/api/ai
        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: response.context }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.result || data.error || "AI analysis request failed.");
        }

        const aiResult = data.result || "No response from AI";

        // Parse the AI response to extract risk level
        const riskLevel = parseRiskLevel(aiResult);

        updatePanel({
          activity: "Page analyzed",
          analysis: aiResult,
          riskLevel: riskLevel,
          advice: getAdviceForRisk(riskLevel),
        });
      } catch (err) {
        console.error("API error:", err);
        updatePanel({
          activity: "AI analysis failed",
          analysis: err.message || "Error fetching AI response. Check your API connection.",
          riskLevel: "Warning",
          advice: "Proceed with caution.",
        });
      }
    });
  } catch (err) {
    console.error("Tab error:", err);
    updatePanel({
      activity: "Error",
      analysis: err.message || "Error accessing the active tab.",
      riskLevel: "Warning",
      advice: "Try again.",
    });
  }
}

// Parse risk level from AI response text
function parseRiskLevel(text) {
  const lowerText = text.toLowerCase();
  if (lowerText.includes("dangerous") || lowerText.includes("danger") || lowerText.includes("high risk")) {
    return "Dangerous";
  } else if (lowerText.includes("safe") || lowerText.includes("low risk") || lowerText.includes("no risk")) {
    return "Safe";
  }
  return "Warning";
}

// Get advice based on risk level
function getAdviceForRisk(riskLevel) {
  switch (riskLevel.toLowerCase()) {
    case "safe":
      return "This appears to be safe to proceed.";
    case "dangerous":
      return "Do NOT proceed. High risk detected.";
    default:
      return "Review carefully before proceeding.";
  }
}

function getRiskIcon(statusText) {
  if (statusText === "Safe") {
    return `<svg id="risk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>`;
  }

  if (statusText === "Danger") {
    return `<svg id="risk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>`;
  }

  return `<svg id="risk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>`;
}

function updatePanel(result) {
  // Hide scanning overlay
  panel.scanningOverlay?.classList.remove("active");
  panel.content?.classList.remove("scanning");
  panel.actions?.classList.remove("disabled");

  // Update content
  setText(panel.activityText, result.activity || "Activity detected");
  setText(panel.analysisText, result.analysis || "Analysis unavailable");
  setText(panel.adviceText, result.advice || "Review before proceeding");

  // Determine risk level
  const riskLevel = (result.riskLevel || "warning").toLowerCase();
  let statusClass, riskClass, statusText;

  if (riskLevel === "safe") {
    statusClass = "status-safe";
    riskClass = "risk-safe";
    statusText = "Safe";
  } else if (riskLevel === "dangerous" || riskLevel === "danger") {
    statusClass = "status-danger";
    riskClass = "risk-danger";
    statusText = "Danger";
  } else {
    statusClass = "status-warning";
    riskClass = "risk-warning";
    statusText = "Warning";
  }

  // Update status badge
  if (panel.statusBadge) {
    panel.statusBadge.className = `status-badge ${statusClass}`;
  }
  setText(panel.statusText, statusText);

  // Update risk card
  if (panel.riskCard) {
    panel.riskCard.className = `risk-card ${riskClass}`;
    const currentIcon = panel.riskCard.querySelector("svg");
    if (currentIcon) currentIcon.outerHTML = getRiskIcon(statusText);
  }
  setText(panel.riskText, statusText);
}

// Check for saved page on load
getStorage(["currentPage"]).then((result) => {
  if (result.currentPage && pages[result.currentPage]) {
    showPage(result.currentPage);
  }
});
