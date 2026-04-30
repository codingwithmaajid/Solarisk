// Solarisk Popup Script

// API endpoint - your deployed Solarisk API
const API_URL = "https://solarisk.vercel.app/api/ai";

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
  riskIcon: document.getElementById("risk-icon"),
  riskText: document.getElementById("risk-text"),
};

// Navigation
function showPage(pageName) {
  Object.values(pages).forEach((page) => page.classList.remove("active"));
  pages[pageName].classList.add("active");
  
  // Save current page
  chrome.storage.local.set({ currentPage: pageName });
  
  // Start scanning when dashboard is shown
  if (pageName === "dashboard") {
    startScan();
  }
}

// Button Handlers
buttons.dodo.addEventListener("click", () => {
  showLoading(buttons.dodo, "Connecting...");
  setTimeout(() => {
    hideLoading(buttons.dodo, "DoDo Payments");
    showPage("connect");
  }, 1500);
});

buttons.skip.addEventListener("click", () => {
  showPage("connect");
});

buttons.connect.addEventListener("click", () => {
  showLoading(buttons.connect, "Connecting...");
  setTimeout(() => {
    hideLoading(buttons.connect, "connect");
    showPage("dashboard");
  }, 2000);
});

// Loading States
function showLoading(button, text) {
  button.disabled = true;
  button.innerHTML = `<div class="spinner"></div><span>${text}</span>`;
}

function hideLoading(button, text) {
  button.disabled = false;
  button.innerHTML = `<span>${text}</span>`;
}

// Scanning & Analysis (matches your original GitHub repo pattern)
async function startScan() {
  // Show scanning state
  panel.scanningOverlay.classList.add("active");
  panel.content.classList.add("scanning");
  panel.actions.classList.add("disabled");
  panel.statusBadge.className = "status-badge status-scanning";
  panel.statusText.textContent = "Scanning";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Use your original GET_CONTEXT pattern from content.js
    chrome.tabs.sendMessage(tab.id, { type: "GET_CONTEXT" }, async (response) => {
      try {
        // Check if content script responded (your original pattern)
        if (!response || !response.context) {
          updatePanel({
            activity: "No page data found",
            analysis: "Content script may not be loaded. Try refreshing the page.",
            riskLevel: "Warning",
            advice: "Refresh the page and try again",
          });
          return;
        }

        // Call your deployed API at solarisk.vercel.app/api/ai
        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: response.context }),
        });

        const data = await res.json();
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
          activity: "Error",
          analysis: "Error fetching AI response. Check your API connection.",
          riskLevel: "Warning",
          advice: "Proceed with caution",
        });
      }
    });

  } catch (err) {
    console.error("Tab error:", err);
    updatePanel({
      activity: "Error",
      analysis: "Error accessing tab",
      riskLevel: "Warning",
      advice: "Try again",
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

function updatePanel(result) {
  // Hide scanning overlay
  panel.scanningOverlay.classList.remove("active");
  panel.content.classList.remove("scanning");
  panel.actions.classList.remove("disabled");

  // Update content
  panel.activityText.textContent = result.activity || "Activity detected";
  panel.analysisText.textContent = result.analysis || "Analysis unavailable";
  panel.adviceText.textContent = result.advice || "Review before proceeding";

  // Determine risk level
  const riskLevel = (result.riskLevel || "warning").toLowerCase();
  let statusClass, riskClass, statusText, iconSvg;

  if (riskLevel === "safe") {
    statusClass = "status-safe";
    riskClass = "risk-safe";
    statusText = "Safe";
    iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>`;
  } else if (riskLevel === "dangerous" || riskLevel === "danger") {
    statusClass = "status-danger";
    riskClass = "risk-danger";
    statusText = "Danger";
    iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>`;
  } else {
    statusClass = "status-warning";
    riskClass = "risk-warning";
    statusText = "Warning";
    iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>`;
  }

  // Update status badge
  panel.statusBadge.className = `status-badge ${statusClass}`;
  panel.statusText.textContent = statusText;

  // Update risk card
  panel.riskCard.className = `risk-card ${riskClass}`;
  panel.riskIcon.outerHTML = iconSvg;
  panel.riskText.textContent = statusText;
}

// Check for saved page on load
chrome.storage.local.get(["currentPage"], (result) => {
  if (result.currentPage && pages[result.currentPage]) {
    showPage(result.currentPage);
  }
});
