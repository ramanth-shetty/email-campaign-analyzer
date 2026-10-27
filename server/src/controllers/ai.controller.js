const prisma = require("../lib/prisma");
const { generateInsights } = require("../services/gemini.service");

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function createInsight(req, res, { force }) {
  const { campaignId } = req.params;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId: req.user.id },
    include: { metrics: true },
  });
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });
  if (!campaign.metrics)
    return res.status(422).json({ error: "Campaign has no metrics yet" });

  const existing = await prisma.aIInsight.findFirst({
    where: { campaignId, userId: req.user.id },
    orderBy: { createdAt: "desc" },
  });

  if (
    !force &&
    existing &&
    Date.now() - existing.createdAt.getTime() < CACHE_TTL_MS
  ) {
    return res.json({ cached: true, insight: existing });
  }

  // Generate first; old insight is only replaced if this succeeds
  const { prompt, suggestions } = await generateInsights(
    campaign.name,
    campaign.metrics,
    campaign.totalRecipients,
  );

  const insight = await prisma.aIInsight.create({
    data: {
      campaignId,
      userId: req.user.id,
      prompt,
      response: suggestions,
    },
  });

  res.json({ cached: false, insight });
}

// POST /api/ai/insights/:campaignId
async function generate(req, res) {
  return createInsight(req, res, { force: false });
}

// GET /api/ai/insights/:campaignId
async function getInsight(req, res) {
  const { campaignId } = req.params;

  const insight = await prisma.aIInsight.findFirst({
    where: { campaignId, userId: req.user.id },
    orderBy: { createdAt: "desc" },
  });

  if (!insight)
    return res.status(404).json({ error: "No insights generated yet" });
  res.json({ insight });
}

// POST /api/ai/insights/:campaignId/regenerate
async function regenerate(req, res) {
  return createInsight(req, res, { force: true });
}

module.exports = { generate, getInsight, regenerate };
