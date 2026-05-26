exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  try {
    const { messages } = JSON.parse(event.body);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system:
          "You are a web search assistant. For EVERY user query, always use the web_search tool to find current, real information before answering. Never answer from memory alone — always search first. After searching, provide a clear, concise answer and list your sources at the end under a 'Sources:' section with the URLs.",
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 3,
          },
        ],
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: err.error?.message || "API error" }),
      };
    }

    const data = await response.json();

    const reply = data.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    const sources = [];
    for (const block of data.content) {
      if (block.type === "tool_result" || block.type === "server_tool_use") continue;
      if (block.type === "web_search_tool_result") {
        const results = block.content || [];
        for (const r of results) {
          if (r.url) sources.push({ title: r.title || r.url, url: r.url });
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply, sources }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
