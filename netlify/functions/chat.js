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
    const apiKey = process.env.GEMINI_API_KEY;

    const geminiMessages = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: geminiMessages,
          tools: [{ google_search: {} }],
          systemInstruction: {
            parts: [{ text: "You are a helpful web search assistant. Always search the web for current information before answering. Provide clear, concise answers with sources." }],
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: err.error?.message || "API error" }),
      };
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

    const sources = [];
    const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    for (const chunk of chunks) {
      if (chunk.web) {
        sources.push({ title: chunk.web.title || chunk.web.uri, url: chunk.web.uri });
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
