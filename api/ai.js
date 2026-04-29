export default async function handler(req, res) {
  try {
    // only allow POST
    if (req.method !== "POST") {
      return res.status(405).end();
    }

    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ result: "No input provided" });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `
You are a Web3 security assistant.

Explain what the website is doing.
Keep it SHORT (max 3 lines).
Warn about risks.

Format:
Summary:
Risk:
Advice:
            `,
          },
          {
            role: "user",
            content: text,
          },
        ],
      }),
    });

    const data = await response.json();

    const result =
      data?.choices?.[0]?.message?.content || "No response from AI";

    return res.status(200).json({ result });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ result: "Server error" });
  }
}