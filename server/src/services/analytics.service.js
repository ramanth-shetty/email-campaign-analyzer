const prisma = require("../lib/prisma");

// ── Helpers ───────────────────────────────────────────────────────────────────

function rangeStart(range) {
  const days = { 30: 30, 90: 90 }[range];
  if (!days) return null;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function calcRates(metrics, totalRecipients) {
  const denom = totalRecipients || metrics.deliveries || 0;
  if (!denom)
    return { openRate: null, ctr: null, bounceRate: null, unsubRate: null };

  const pct = (n) => +(((n || 0) / denom) * 100).toFixed(2);
  return {
    openRate: pct(metrics.uniqueOpens),
    ctr: pct(metrics.uniqueClicks),
    bounceRate: pct(metrics.bounces),
    unsubRate: pct(metrics.unsubscribes),
  };
}

function enrichCampaign(c) {
  const rates = c.metrics
    ? calcRates(c.metrics, c.totalRecipients)
    : { openRate: null, ctr: null, bounceRate: null, unsubRate: null };
  return { ...c, ...rates };
}

function average(items, key) {
  if (items.length === 0) return 0;
  return +(items.reduce((sum, c) => sum + c[key], 0) / items.length).toFixed(2);
}

function getISOWeekParts(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

// ── Service functions ─────────────────────────────────────────────────────────

async function getOverview(userId, range = "all") {
  const start = rangeStart(range);
  const campaigns = await prisma.campaign.findMany({
    where: { userId, ...(start && { sentAt: { gte: start } }) },
    include: { metrics: true },
  });

  const measured = campaigns
    .map(enrichCampaign)
    .filter((c) => c.openRate !== null);

  const eventTotals = measured.reduce(
    (acc, c) => ({
      opens: acc.opens + (c.metrics.uniqueOpens || 0),
      clicks: acc.clicks + (c.metrics.uniqueClicks || 0),
      bounces: acc.bounces + (c.metrics.bounces || 0),
      unsubscribes: acc.unsubscribes + (c.metrics.unsubscribes || 0),
    }),
    { opens: 0, clicks: 0, bounces: 0, unsubscribes: 0 },
  );

  return {
    totalCampaigns: campaigns.length,
    avgOpenRate: average(measured, "openRate"),
    avgCtr: average(measured, "ctr"),
    avgBounceRate: average(measured, "bounceRate"),
    avgUnsubRate: average(measured, "unsubRate"),
    eventTotals,
  };
}

async function getCampaignList(userId) {
  const campaigns = await prisma.campaign.findMany({
    where: { userId },
    include: { metrics: true },
    orderBy: { sentAt: "desc" },
  });
  return campaigns.map(enrichCampaign);
}

async function getCampaignDetail(userId, campaignId) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
    include: { metrics: true, segments: true },
  });
  if (!campaign) return null;
  return enrichCampaign(campaign);
}

async function getTrends(userId, groupBy = "month", range = "all") {
  const start = rangeStart(range);
  const campaigns = await prisma.campaign.findMany({
    where: { userId, sentAt: start ? { gte: start } : { not: null } },
    include: { metrics: true },
    orderBy: { sentAt: "asc" },
  });

  const groups = {};
  for (const raw of campaigns) {
    const c = enrichCampaign(raw);
    if (c.openRate === null) continue;

    const d = new Date(c.sentAt);
    let key;
    if (groupBy === "week") {
      const { year, week } = getISOWeekParts(d);
      key = `${year}-W${String(week).padStart(2, "0")}`;
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }

    if (!groups[key]) groups[key] = { period: key, campaigns: [] };
    groups[key].campaigns.push(c);
  }

  return Object.values(groups)
    .sort((a, b) => a.period.localeCompare(b.period))
    .map(({ period, campaigns: cs }) => ({
      period,
      count: cs.length,
      avgOpenRate: average(cs, "openRate"),
      avgCtr: average(cs, "ctr"),
      avgBounceRate: average(cs, "bounceRate"),
    }));
}

async function compareCampaigns(userId, ids) {
  const campaigns = await prisma.campaign.findMany({
    where: { id: { in: ids }, userId },
    include: { metrics: true },
  });
  const byId = new Map(campaigns.map((c) => [c.id, enrichCampaign(c)]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

module.exports = {
  getOverview,
  getCampaignList,
  getCampaignDetail,
  getTrends,
  compareCampaigns,
};
