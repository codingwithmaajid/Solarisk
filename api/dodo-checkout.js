export default async function handler(req, res) {
  try {
    // Allow only POST
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = process.env.DODO_PAYMENTS_API_KEY;
    const productId = process.env.DODO_PRODUCT_ID;

    if (!apiKey || !productId) {
      const sessionId = `mock_dodo_${Date.now()}`;

      return res.status(200).json({
        checkout_url: `https://solarisk.vercel.app/payment-success?session_id=${sessionId}&mock=true`,
        session_id: sessionId,
        mock: true,
        message: "Mock Dodo checkout session created",
      });
    }

    const response = await fetch("https://test.dodopayments.com/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_cart: [
          {
            product_id: productId,
            quantity: 1,
          },
        ],
        metadata: {
          app: "Solarisk",
          action: "pay_and_execute",
        },
        return_url: "https://solarisk.vercel.app/payment-success",
        cancel_url: "https://solarisk.vercel.app/payment-cancelled",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("DODO CHECKOUT ERROR:", JSON.stringify(data, null, 2));

      return res.status(response.status).json({
        error: data?.error?.message || data?.message || "Failed to create checkout session",
      });
    }

    if (!data?.checkout_url || !data?.session_id) {
      console.error("DODO CHECKOUT INVALID RESPONSE:", JSON.stringify(data, null, 2));

      return res.status(502).json({
        error: "Invalid response from Dodo Payments",
      });
    }

    return res.status(200).json({
      checkout_url: data.checkout_url,
      session_id: data.session_id,
    });
  } catch (err) {
    console.error("DODO CHECKOUT SERVER ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
