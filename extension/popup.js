// Solarisk Popup Script

// API endpoints - deployed Solarisk backend
const API_URL = "https://solarisk.vercel.app/api/ai";
const DODO_CHECKOUT_URL = "https://solarisk.vercel.app/api/dodo-checkout";

const BUTTON_LABELS = {
  dodo: "Start Agent Scan",
  skip: "Open Mock Checkout",
  connect: "Connect Wallet",
  continue: "Continue Anyway",
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
  scanningText: document.querySelector("#scanning-overlay .scanning-text span"),
  telemetryPage: document.getElementById("telemetry-page"),
  telemetryWallet: document.getElementById("telemetry-wallet"),
  telemetryPayment: document.getElementById("telemetry-payment"),
  agentCard: document.getElementById("agent-card"),
  agentAction: document.getElementById("agent-action"),
  agentConfidence: document.getElementById("agent-confidence"),
  agentIntent: document.getElementById("agent-intent"),
  agentTimeline: document.getElementById("agent-timeline"),
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

function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || "Current tab";
  } catch (err) {
    return "Current tab";
  }
}

function detectWalletSignal(context = "") {
  const lowerContext = context.toLowerCase();
  if (lowerContext.includes("phantom")) return "Phantom";
  if (lowerContext.includes("solflare")) return "Solflare";
  if (lowerContext.includes("backpack")) return "Backpack";
  if (lowerContext.includes("metamask") || lowerContext.includes("ethereum")) return "EVM";
  return "None found";
}

function setTelemetry({ page, wallet, payment } = {}) {
  if (page) setText(panel.telemetryPage, page);
  if (wallet) setText(panel.telemetryWallet, wallet);
  if (payment) setText(panel.telemetryPayment, payment);
}

function formatAgentAction(action = "PROTECT_AND_EXECUTE") {
  return action.replaceAll("_", " ");
}

function summarizeResult(text = "") {
  const clean = text
    .replace(/\*\*/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return "Solarisk prepared an agent decision for this page.";

  const whatMatch = clean.match(/what the page is doing:?\s*(.*?)(risk level:|practical advice:|$)/i);
  if (whatMatch?.[1]) {
    return whatMatch[1].replace(/^[-:\s]+/, "").slice(0, 220).trim();
  }

  const firstSentence = clean.match(/^(.{40,220}?[.!?])\s/);
  return (firstSentence?.[1] || clean.slice(0, 220)).trim();
}

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function classifyContext(text = "") {
  const lowerText = text.toLowerCase();
  const hasDanger = hasAny(lowerText, [
    "seed phrase",
    "secret recovery phrase",
    "private key",
    "paste your key",
    "enter your recovery",
    "unlimited approval",
    "approve unlimited",
    "drain",
    "suspicious transaction",
  ]);
  const hasTransfer = hasAny(lowerText, [
    "send transaction",
    "sign transaction",
    "sign message",
    "approve spending",
    "token transfer",
    "transfer usdc",
    "send usdc",
    "payment request",
  ]);
  const hasWalletSession = hasAny(lowerText, [
    "connect wallet",
    "disconnect wallet",
    "connected wallet",
    "wallet connected",
    "phantom wallet detected",
    "solflare wallet detected",
    "backpack wallet detected",
  ]);

  if (hasDanger) {
    return {
      risk: "Dangerous",
      intent: "phishing_or_seed_phrase",
      agent_action: "BLOCK",
      confidence: 94,
      reason: "This page contains seed phrase, private key, drainer, or unlimited approval language.",
      execution_policy: [
        "Block this page before wallet approval",
        "Reject private key, seed phrase, or suspicious signature prompts",
        "Use a fresh tab and verify the domain manually",
      ],
    };
  }

  if (hasTransfer) {
    return {
      risk: "Warning",
      intent: "message_signing",
      agent_action: "PROTECT_AND_EXECUTE",
      confidence: 82,
      reason: "This page appears to involve signing, approval, or token movement, so protected execution is recommended.",
      execution_policy: [
        "Require confirmation before signing wallet messages",
        "Warn before token transfers, approvals, or stablecoin movement",
        "Block private key and seed phrase requests",
      ],
    };
  }

  if (hasWalletSession) {
    return {
      risk: "Safe",
      intent: "wallet_connect",
      agent_action: "ALLOW",
      confidence: 88,
      reason: "This looks like a normal wallet connection or disconnection state with no transaction request detected.",
      execution_policy: [
        "Allow wallet connect and disconnect actions",
        "Do not treat public wallet address access as sensitive",
        "Keep transaction prompts blocked unless signing or transfer appears",
      ],
    };
  }

  return null;
}

function fallbackAgent(result = "", riskLevel = "Warning") {
  const classified = classifyContext(result);
  if (classified) return classified;

  const normalizedRisk = riskLevel || "Warning";
  let action = "PROTECT_AND_EXECUTE";
  let policy = [
    "Require confirmation before signing wallet messages",
    "Warn before token transfers, approvals, or stablecoin movement",
    "Block private key and seed phrase requests",
  ];

  if (normalizedRisk.toLowerCase() === "dangerous") {
    action = "BLOCK";
    policy = [
      "Block this page before wallet approval",
      "Reject private key, seed phrase, or suspicious signature prompts",
      "Use a fresh tab and verify the domain manually",
    ];
  } else if (normalizedRisk.toLowerCase() === "safe") {
    action = "ALLOW";
    policy = [
      "No wallet or payment action detected",
      "Allow normal browsing",
      "Keep transaction prompts blocked unless a wallet request appears",
    ];
  }

  return {
    risk: normalizedRisk,
    intent: "unknown",
    agent_action: action,
    confidence: normalizedRisk === "Warning" ? 72 : 84,
    reason: summarizeResult(result),
    execution_policy: policy,
  };
}

function normalizeAgent(agent, result, riskLevel) {
  if (!agent || typeof agent !== "object") {
    return fallbackAgent(result, riskLevel);
  }

  const fallback = fallbackAgent(result, riskLevel);

  return {
    risk: agent.risk || fallback.risk,
    intent: agent.intent || fallback.intent,
    agent_action: agent.agent_action || fallback.agent_action,
    confidence: Number(agent.confidence) || fallback.confidence,
    reason: summarizeResult(agent.reason || fallback.reason),
    execution_policy: Array.isArray(agent.execution_policy)
      ? agent.execution_policy.slice(0, 4)
      : fallback.execution_policy,
  };
}

function updateAgent(agent) {
  if (!agent) return;

  setText(panel.agentAction, formatAgentAction(agent.agent_action));
  setText(panel.agentConfidence, `${Math.min(99, Math.max(0, Math.round(agent.confidence || 0)))}%`);
  setText(panel.agentIntent, `Intent: ${formatAgentAction(agent.intent || "unknown").toLowerCase()}`);

  if (panel.agentCard) {
    const risk = (agent.risk || "").toLowerCase();
    const variant = risk === "dangerous" || risk === "danger" ? "danger" : risk === "safe" ? "safe" : "warning";
    panel.agentCard.className = `agent-card agent-card-${variant} animate-in`;
  }

  if (panel.agentTimeline) {
    panel.agentTimeline.textContent = "";
    const policyItems = agent.execution_policy?.length ? agent.execution_policy : ["Execution policy pending"];

    policyItems.forEach((item) => {
      const listItem = document.createElement("li");
      listItem.textContent = item;
      panel.agentTimeline.appendChild(listItem);
    });
  }
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

    setTelemetry({ payment: data.mock ? "Mock live" : "Checkout" });
    chrome.tabs.create({ url: data.checkout_url });
  } catch (err) {
    console.error("Dodo checkout error:", err);
    await showCheckoutError(err.message);
  } finally {
    let label = BUTTON_LABELS.dodo;
    if (button === buttons.payExecute) label = BUTTON_LABELS.payExecute;
    if (button === buttons.skip) label = BUTTON_LABELS.skip;
    hideLoading(button, label);
  }
}

// Button Handlers
onClick(buttons.dodo, () => {
  showPage("dashboard");
});

onClick(buttons.skip, () => {
  createDodoCheckout(buttons.skip);
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
  setTelemetry({ payment: "Bypassed" });
  updateAgent({
    intent: "manual_override",
    agent_action: "WARN",
    confidence: 61,
    execution_policy: [
      "User selected unprotected continuation",
      "No blockchain transaction submitted by Solarisk",
      "Reject transfer, approval, or signature prompts unless expected",
    ],
  });
  updatePanel({
    activity: "Continuing unprotected",
    analysis: "You chose to continue without Solarisk Safe Execution Mode. No transaction has been sent by Solarisk.",
    riskLevel: "Warning",
    advice: "Only proceed if you understand the site and the wallet request.",
  });
});

onClick(buttons.execute, () => {
  setTelemetry({ payment: "Ready" });
  updateAgent({
    intent: "protected_execution",
    agent_action: "PROTECT_AND_EXECUTE",
    confidence: 91,
    execution_policy: [
      "Safe Execution Mode armed",
      "Block seed phrase and private key requests",
      "Warn on token transfer, approval, or message signing",
      "Allow wallet-view requests after user confirmation",
    ],
  });
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
  setText(panel.scanningText, "Mapping page signals...");
  setTelemetry({ page: "Detecting", wallet: "Watching", payment: "Mock" });
  updateAgent({
    intent: "detecting",
    agent_action: "INVESTIGATING",
    confidence: 0,
    execution_policy: [
      "Page scan queued",
      "Wallet context pending",
      "Execution policy pending",
    ],
  });
}

// Scanning & Analysis (matches your original GitHub repo pattern)
async function startScan() {
  setScanningState();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    setTelemetry({ page: getHostname(tab?.url), wallet: "Watching" });

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
    setText(panel.scanningText, "Reading wallet context...");
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
        setTelemetry({ wallet: detectWalletSignal(response.context) });
        setText(panel.scanningText, "Running AI risk model...");
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
        const localAgent = classifyContext(response.context);

        // Parse the AI response to extract risk level
        const riskLevel = localAgent?.risk || data.agent?.risk || parseRiskLevel(aiResult);
        const agent = localAgent || normalizeAgent(data.agent, aiResult, riskLevel);

        updatePanel({
          activity: "Page analyzed",
          analysis: agent.reason || aiResult,
          riskLevel: riskLevel,
          advice: getAdviceForRisk(riskLevel, agent.agent_action),
        });
        updateAgent(agent);
        setTelemetry({ page: getHostname(tab.url), wallet: detectWalletSignal(response.context), payment: "Mock ready" });
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
function getAdviceForRisk(riskLevel, agentAction = "") {
  if (agentAction === "BLOCK") {
    return "Agent recommends blocking this action. Do not approve wallet prompts from this page.";
  }

  if (agentAction === "PAY_AND_EXECUTE") {
    return "Agent recommends unlocking protected execution through the mock checkout before continuing.";
  }

  if (agentAction === "PROTECT_AND_EXECUTE") {
    return "Agent recommends Safe Execution Mode before approving any wallet prompt.";
  }

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
    panel.riskCard.className = `risk-pill ${riskClass}`;
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
