const { GoogleGenerativeAI } = require("@google/generative-ai");

const DEFAULT_MODEL = "gemini-2.5-flash";

function buildPrompt(campaignName, metrics, totalRecipients) {
  const denom = totalRecipients || 1;
  const openRate = ((metrics.uniqueOpens / denom) * 100).toFixed(1);
  const ctr = ((metrics.uniqueClicks / denom) * 100).toFixed(1);
  const bounceRate = ((metrics.bounces / denom) * 100).toFixed(1);
  const unsubRate = ((metrics.unsubscribes / denom) * 100).toFixed(1);

  return `You are an expert email marketing analyst. Analyze the following email campaign metrics and provide exactly 5 actionable suggestions to improve performance.

Campaign: "${campaignName}"
Metrics:
- Total Recipients: ${totalRecipients}
- Open Rate: ${openRate}%
- Click-Through Rate: ${ctr}%
- Bounce Rate: ${bounceRate}%
- Unsubscribe Rate: ${unsubRate}%
- Unique Opens: ${metrics.uniqueOpens}
- Unique Clicks: ${metrics.uniqueClicks}

Respond ONLY with a valid JSON array. Each element must have exactly these fields:
- "category": one of "Subject Line", "Send Time", "Audience", "A/B Testing", "Content"
- "suggestion": a specific, actionable recommendation (1-2 sentences)
- "priority": one of "High", "Medium", "Low"

Example format:
[{"category":"Subject Line","suggestion":"...","priority":"High"}]

Return only the JSON array, no markdown, no explanation.`;
}

function parseSuggestions(text) {
  const clean = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("Could not parse AI response as JSON array");
    parsed = JSON.parse(match[0]);
  }

  if (!Array.isArray(parsed)) throw new Error("AI returned unexpected format");
  return parsed;
}

/**
 * Call Google Gemini and return { prompt, suggestions }.
 */
async function generateInsights(campaignName, metrics, totalRecipients) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.startsWith("your_")) {
    throw Object.assign(
      new Error("GEMINI_API_KEY is not set. Add it to server/.env"),
      { status: 503 },
    );
  }

  const modelName = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const prompt = buildPrompt(campaignName, metrics, totalRecipients);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
    },
  });

  let text;
  try {
    const result = await model.generateContent(prompt);
    text = result.response.text()?.trim();
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg.includes("429")) {
      throw Object.assign(
        new Error(
          "Gemini rate limit reached. Please wait a minute and try again.",
        ),
        { status: 429 },
      );
    }
    if (msg.includes("API key") || msg.includes("401") || msg.includes("403")) {
      throw Object.assign(
        new Error("Gemini API key is invalid or not authorized."),
        { status: 401 },
      );
    }
    throw Object.assign(new Error(`Gemini API error: ${msg}`), { status: 502 });
  }

  if (!text)
    throw Object.assign(new Error("Gemini returned an empty response"), {
      status: 502,
    });

  const suggestions = parseSuggestions(text);
  return { prompt, suggestions };
}

module.exports = { generateInsights };
