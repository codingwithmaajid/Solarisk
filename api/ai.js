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
You are a Web3 security assistant.

Rules:
- A Solana public address (base58 string) is NOT sensitive.
- Never call a public wallet address a private key.
- Only warn if there is real risk like:
  - requesting private keys
  - suspicious transaction signing
  - phishing patterns

Output format:
- What the page is doing
- Risk level (Safe / Warning / Dangerous)
- Advice to user

Be accurate and avoid false alarms.
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

    // Debug log
    console.log("GROQ RESPONSE:", JSON.stringify(data, null, 2));

    const result =
      data?.choices?.[0]?.message?.content ||
      data?.error?.message ||
      "No response from AI";

    return res.status(200).json({ result });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ result: "Server error" });
  }
}