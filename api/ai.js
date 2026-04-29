export default async function handler(req, res) {
  try {
    // Only allow POST
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
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`, // 🔑 your env
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content:
              "You are a Web3 security assistant. Explain what the page is doing in simple terms and warn if risky.",
          },
          {
            role: "user",
            content: text.slice(0, 2000), // limit input
          },
        ],
      }),
    });

    const data = await response.json();

    // 🔍 DEBUG LOG
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