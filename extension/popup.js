document.getElementById("analyze").onclick = async () => {
  const output = document.getElementById("output");
  output.innerText = "Thinking...";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { type: "GET_CONTEXT" }, async (response) => {
      try {
        // 🛑 check if content script responded
        if (!response || !response.context) {
          output.innerText = "No page data found";
          return;
        }

        const res = await fetch("https://solarisk.vercel.app/api/ai", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: response.context,
          }),
        });

        const data = await res.json();

        output.innerText = data.result || "No response from AI";

      } catch (err) {
        console.error(err);
        output.innerText = "Error fetching AI response";
      }
    });

  } catch (err) {
    console.error(err);
    output.innerText = "Error accessing tab";
  }
};