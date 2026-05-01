function fallbackAgent(result) {
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
    reason: result.slice(0, 240),
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
      reason: parsed.reason || content.slice(0, 240),
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
- Understand real wallet actions:
  - "connect wallet" = user authorizing a dApp
  - "disconnect" = ending session (safe)
- Only warn if there is real risk like:
  - requesting private keys
  - suspicious transaction signing
  - phishing patterns
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
