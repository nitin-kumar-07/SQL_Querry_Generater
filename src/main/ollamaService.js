function normalizeOllamaUrl(baseUrl) {
  return String(baseUrl || "http://localhost:11434").trim().replace(/\/+$/, "");
}

async function fetchModels(baseUrl) {
  const url = `${normalizeOllamaUrl(baseUrl)}/api/tags`;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}.`);
  }
  const data = await response.json();
  return (data.models || []).map((model) => ({
    name: model.name,
    modifiedAt: model.modified_at,
    size: model.size,
    recommended: isRecommendedModel(model.name)
  }));
}

async function generateSql({ baseUrl, model, database, schemaSummary, userRequest }) {
  const cleanModel = String(model || "").trim();
  if (!cleanModel) {
    throw new Error("Selected model is not available in Ollama. Please install it or choose another model.");
  }

  const prompt = [
    "System instruction:",
    "You are an expert MySQL SQL generator. Generate valid MySQL SQL based only on the provided schema. Do not invent tables or columns. Return only SQL unless the user request is impossible or ambiguous.",
    "",
    `Current selected database name: ${database}`,
    "",
    "Full schema summary:",
    schemaSummary,
    "",
    "User request:",
    userRequest,
    "",
    "Generate one SQL statement that satisfies the request. Prefer safe and precise SQL. Use LIMIT 100 by default for SELECT queries unless the user asks otherwise."
  ].join("\n");

  const response = await fetch(`${normalizeOllamaUrl(baseUrl)}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: cleanModel,
      prompt,
      stream: false,
      options: {
        temperature: 0.1
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}.`);
  }

  const data = await response.json();
  return extractSql(data.response || "");
}

function isRecommendedModel(modelName) {
  const name = String(modelName || "").toLowerCase();
  return name.startsWith("qwen2.5-coder") || name.startsWith("codegemma");
}

function extractSql(text) {
  let output = String(text || "").trim();
  const fenced = output.match(/```(?:sql|mysql)?\s*([\s\S]*?)```/i);
  if (fenced) {
    output = fenced[1].trim();
  }
  return output.replace(/^SQL:\s*/i, "").trim();
}

module.exports = {
  fetchModels,
  generateSql,
  isRecommendedModel,
  normalizeOllamaUrl,
  extractSql
};
