# Solarisk

Solarisk is a Chrome extension security copilot for Solana and Web3 pages that scans the current tab, explains the risk in plain English, and gives the user a clear execution policy before they approve anything.

## What it does

- Reads the active page context from the extension content script
- Detects wallet state and common phishing or transaction-risk language
- Sends the page context to the backend AI route for an agentic decision
- Shows a minimal report with risk, advice, and next action
- Supports a mock Dodo checkout path for the hackathon demo

## Why it matters

Most wallets still show raw prompts and expect the user to interpret them. Solarisk flips that model: it acts like a security agent that reads the page first, classifies intent, and tells the user what should happen next.

## Submission pitch

Solarisk is an AI-powered Web3 security copilot for Solana that converts confusing wallet prompts into a simple execution policy: allow, warn, protect, or block.

## Architecture

```text
Chrome Extension Popup
  ├─ reads active tab
  ├─ asks content.js for page context
  ├─ sends page text to /api/ai
  └─ shows the agent report and execution policy

content.js
  ├─ detects wallet providers
  ├─ captures DOM context
  └─ emits transaction signals for the UI

api/ai.js
  ├─ classifies page text with Groq
  ├─ applies agent rules for Solana wallet actions
  └─ returns risk, intent, confidence, and policy

api/dodo-checkout.js
  ├─ creates a mock or test checkout session
  └─ returns a checkout URL for the demo
```

## Current MVP flow

1. Open the extension popup.
2. Click `Connect`.
3. Solarisk scans the active page.
4. The report shows page, wallet state, risk level, and advice.
5. `Execute` appears after the report is ready.

## Setup

### 1. Load the extension

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Enable Developer mode.
4. Click `Load unpacked`.
5. Select the `extension/` folder in this repo.

### 2. Deploy the backend

Deploy the `api/` folder to Vercel and add the environment variables listed below.

## Environment variables

### Required for AI

- `GROQ_API_KEY`

### Required for Dodo checkout

- `DODO_PAYMENTS_API_KEY`
- `DODO_PRODUCT_ID`

## Demo flow

1. Open `/demo/safe/` and show Solarisk classifying the page as Safe.
2. Open `/demo/warning/` and show the signature or approval warning.
3. Open `/demo/danger/` and show the page getting blocked.
4. Show the agent recommendation and the execution policy on each page.

### Deterministic demo routes

- `/demo/`
- `/demo/safe/`
- `/demo/warning/`
- `/demo/danger/`

## Known limitations

This submission is intentionally framed as a Detection MVP.

- `content.js` detects wallet and transaction signals, but it does not yet implement a true asynchronous blocking gate that holds the wallet promise until the user approves in the popup.
- The current AI analysis uses page DOM context and wallet state, not decoded Solana transaction instruction bytecode.
- V2 should add transaction simulation or instruction decoding through RPC or a simulation API so the agent can reason about raw transaction intent.

## V2 roadmap

- Active transaction blocking with popup approval
- Solana instruction decoding and simulation
- Better page classification for embedded or hidden malicious flows
- More explicit agent state syncing between content script and popup

## Notes for judges

Solarisk is designed to be judged on the agentic UX, not on a full wallet product. The core value is the execution policy: the extension reads the page, classifies intent, and translates risk into plain English before the user acts.
