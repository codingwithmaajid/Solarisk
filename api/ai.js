export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { text } = req.body;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a Web3 security assistant. Explain what the page is doing in simple terms and warn if risky.",
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
    data.choices?.[0]?.message?.content || "No response from AI";

  res.json({ result });
}
