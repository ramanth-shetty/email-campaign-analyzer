const analytics = require("../services/analytics.service");

function parseRange(value) {
  return ["30", "90", "all"].includes(value) ? value : "all";
}

// GET /api/analytics/overview?range=30|90|all
async function overview(req, res) {
  const data = await analytics.getOverview(
    req.user.id,
    parseRange(req.query.range),
  );
  res.json(data);
}

// GET /api/analytics/campaigns
async function listCampaigns(req, res) {
  const data = await analytics.getCampaignList(req.user.id);
  res.json(data);
}

// GET /api/analytics/campaigns/:id
async function campaignDetail(req, res) {
  const data = await analytics.getCampaignDetail(req.user.id, req.params.id);
  if (!data) return res.status(404).json({ error: "Campaign not found" });
  res.json(data);
}

// GET /api/analytics/trends?groupBy=month|week&range=30|90|all
async function trends(req, res) {
  const groupBy = req.query.groupBy === "week" ? "week" : "month";
  const data = await analytics.getTrends(
    req.user.id,
    groupBy,
    parseRange(req.query.range),
  );
  res.json(data);
}

// GET /api/analytics/compare?ids=id1,id2
async function compare(req, res) {
  const ids = (req.query.ids || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length < 2)
    return res.status(400).json({ error: "Provide at least 2 campaign ids" });
  if (ids.length > 10)
    return res
      .status(400)
      .json({ error: "Compare up to 10 campaigns at a time" });
  const data = await analytics.compareCampaigns(req.user.id, ids);
  res.json(data);
}

module.exports = { overview, listCampaigns, campaignDetail, trends, compare };
