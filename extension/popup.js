document.getElementById("analyze").onclick = async () => {
  const output = document.getElementById("output");
  output.innerText = "Thinking...";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { type: "GET_CONTEXT" }, async (response) => {
    // Note: Replace YOUR-VERCEL-URL with your actual deployment URL
    const res = await fetch("https://YOUR-VERCEL-URL/api/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: response.context,
      }),
    });

    const data = await res.json();
    output.innerText = data.result;
  });
};
