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

function detectDemoScenario(text = "") {
  const match = text.toLowerCase().match(/solarisk demo scenario:\s*(safe|warning|danger)/);
  return match?.[1] || "";
}

function buildDemoAgent(scenario) {
  if (scenario === "safe") {
    return {
      risk: "Safe",
      intent: "demo_safe",
      agent_action: "ALLOW",
      confidence: 98,
      reason: "This demo page is intentionally safe and contains only wallet-connect style language.",
      execution_policy: [
        "Allow browsing and normal wallet viewing",
        "No transfer or signature request is present",
        "Keep execution mode idle",
      ],
    };
  }

  if (scenario === "danger") {
    return {
      risk: "Dangerous",
      intent: "demo_danger",
      agent_action: "BLOCK",
      confidence: 99,
      reason: "This demo page intentionally includes seed phrase and private key request language.",
      execution_policy: [
        "Block private key and recovery phrase requests",
        "Reject suspicious signature prompts",
        "Do not continue from this page",
      ],
    };
  }

  if (scenario === "warning") {
    return {
      risk: "Warning",
      intent: "demo_warning",
      agent_action: "PROTECT_AND_EXECUTE",
      confidence: 97,
      reason: "This demo page intentionally requests signature and token approval style actions.",
      execution_policy: [
        "Warn before any signature or approval",
        "Require protected execution mode",
        "Review the requested transfer carefully",
      ],
    };
  }

  return null;
}

function classifyText(text = "") {
  const lowerText = text.toLowerCase();
  const demoScenario = detectDemoScenario(lowerText);

  if (demoScenario) {
    return buildDemoAgent(demoScenario);
  }

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

function fallbackAgent(result) {
  const classified = classifyText(result);
  if (classified) return classified;

  const lowerResult = result.toLowerCase();
  let risk = "Warning";
  let agent_action = "PROTECT_AND_EXECUTE";
  let execution_policy = [
    "Require confirmation before signing wallet messages",
    "Warn before token transfers, approvals, or stablecoin movement",
    "Block private key and seed phrase requests",
  ];

  if (lowerResult.includes("dangerous") || lowerResult.includes("danger") || lowerResult.includes("high risk")) {
    risk = "Dangerous";
    agent_action = "BLOCK";
    execution_policy = [
      "Block this page before wallet approval",
      "Reject private key, seed phrase, or suspicious signature prompts",
      "Use a fresh tab and verify the domain manually",
    ];
  } else if (lowerResult.includes("safe") || lowerResult.includes("low risk") || lowerResult.includes("no risk")) {
    risk = "Safe";
    agent_action = "ALLOW";
    execution_policy = [
      "No wallet or payment action detected",
      "Allow normal browsing",
      "Keep transaction prompts blocked unless a wallet request appears",
    ];
  }

  return {
    risk,
    intent: "wallet_or_payment_context",
    agent_action,
    confidence: risk === "Warning" ? 72 : 84,
    reason: summarizeResult(result),
    execution_policy,
  };
}

function parseAgentResponse(content) {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackAgent(content);
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      risk: parsed.risk || "Warning",
      intent: parsed.intent || "wallet_or_payment_context",
      agent_action: parsed.agent_action || "PROTECT_AND_EXECUTE",
      confidence: Number(parsed.confidence) || 70,
      reason: summarizeResult(parsed.reason || content),
      execution_policy: Array.isArray(parsed.execution_policy)
        ? parsed.execution_policy.slice(0, 4)
        : fallbackAgent(content).execution_policy,
    };
  } catch (err) {
    return fallbackAgent(content);
  }
}

export default async function handler(req, res) {
  try {
    // Allow only POST
    if (req.method !== "POST") {
      return res.status(405).end();
    }

    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ result: "No input text provided" });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `
You are Solarisk, an agentic Web3 security copilot for Solana stablecoin and wallet actions.

Rules:
- A Solana public address is NOT sensitive.
- Never call a public address a private key.
- If the page includes a Solarisk demo scenario marker, treat it as authoritative:
  - safe => return Safe / ALLOW
  - warning => return Warning / PROTECT_AND_EXECUTE
  - danger => return Dangerous / BLOCK
- Understand real wallet actions:
  - "connect wallet" = normal dApp authorization. This is Safe unless paired with signing, transfer, approval, seed phrase, or private key requests.
  - "disconnect wallet" = ending an existing session. This is Safe.
  - A page having a "Connect" button alone is NOT Dangerous.
  - A page having a "Disconnect" button alone is NOT automatically meaningful risk reduction; it usually means the wallet is already connected.
- Only warn if there is real risk like:
  - requesting private keys
  - suspicious transaction signing
  - phishing patterns
  - token transfers, approvals, or stablecoin movement
- Act like a decision agent: classify intent, choose the safest next action, and prepare an execution policy.
- Do not claim that you submitted a blockchain transaction.
- If no wallet/payment/signing action is detected, use risk "Safe", agent_action "ALLOW", and a calm browsing policy.

Return ONLY valid JSON with this exact shape:
{
  "risk": "Safe" | "Warning" | "Dangerous",
  "intent": "wallet_connect" | "stablecoin_payment" | "token_transfer" | "message_signing" | "phishing_or_seed_phrase" | "unknown",
  "agent_action": "ALLOW" | "WARN" | "BLOCK" | "PROTECT_AND_EXECUTE" | "PAY_AND_EXECUTE",
  "confidence": 0-100,
  "reason": "one concise sentence explaining the decision",
  "execution_policy": [
    "specific policy step 1",
    "specific policy step 2",
    "specific policy step 3"
  ]
}

Be accurate, human-friendly, and avoid false alarms.
            `.trim(),
          },
          {
            role: "user",
            content: text.slice(0, 2000),
          },
        ],
      }),
    });

    const data = await response.json();

    console.log("GROQ RESPONSE:", JSON.stringify(data, null, 2));

    const result =
      data?.choices?.[0]?.message?.content ||
      data?.error?.message ||
      "No response from AI";

    const agent = parseAgentResponse(result);

    return res.status(200).json({
      result: agent.reason,
      agent,
    });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ result: "Server error" });
  }
}
