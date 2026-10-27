// Direct Mailchimp Marketing API v3 calls. Each call carries its own API key,
// so concurrent syncs for different users can never share credentials.

const PAGE_SIZE = 100;

function getDataCenter(apiKey) {
  const idx = apiKey.lastIndexOf("-");
  const dc = idx > 0 ? apiKey.slice(idx + 1) : "";
  // Strict check: prevents the key from redirecting requests to another host
  if (!/^[a-z]+\d+$/i.test(dc)) {
    throw Object.assign(new Error("Invalid Mailchimp API key format"), {
      status: 422,
    });
  }
  return dc.toLowerCase();
}

async function mcFetch(apiKey, path, params = {}) {
  const dc = getDataCenter(apiKey);
  const url = new URL(`https://${dc}.api.mailchimp.com/3.0${path}`);
  for (const [k, v] of Object.entries(params))
    url.searchParams.set(k, String(v));

  const res = await fetch(url, {
    headers: {
      Authorization:
        "Basic " + Buffer.from(`anystring:${apiKey}`).toString("base64"),
    },
  });

  if (!res.ok) {
    throw Object.assign(new Error(`Mailchimp API error ${res.status}`), {
      status: res.status,
    });
  }
  return res.json();
}

/**
 * Validate an API key by pinging the /ping endpoint.
 */
async function validateKey(apiKey) {
  const data = await mcFetch(apiKey, "/ping");
  return data.health_status === "Everything's Chimpy!";
}

/**
 * Fetch all sent campaigns (paginated).
 */
async function fetchCampaigns(apiKey) {
  const all = [];
  let offset = 0;

  for (;;) {
    const page = await mcFetch(apiKey, "/campaigns", {
      count: PAGE_SIZE,
      offset,
      status: "sent",
      fields:
        "total_items,campaigns.id,campaigns.settings.title,campaigns.settings.subject_line,campaigns.send_time,campaigns.emails_sent",
    });

    const items = page.campaigns || [];
    all.push(...items);
    offset += items.length;

    if (items.length === 0 || offset >= (page.total_items || 0)) break;
  }

  return all;
}

/**
 * Fetch the report for a single campaign. Returns null if unavailable.
 */
async function fetchReport(apiKey, campaignId) {
  try {
    return await mcFetch(apiKey, `/reports/${encodeURIComponent(campaignId)}`);
  } catch {
    return null;
  }
}

/**
 * Map a Mailchimp report to our CampaignMetrics shape.
 */
function mapReportToMetrics(report) {
  if (!report) return null;
  const opens = report.opens || {};
  const clicks = report.clicks || {};
  const bounces = report.bounces || {};
  return {
    opens: opens.opens_total || 0,
    uniqueOpens: opens.unique_opens || 0,
    clicks: clicks.clicks_total || 0,
    uniqueClicks: clicks.unique_subscriber_clicks || 0,
    bounces: (bounces.hard_bounces || 0) + (bounces.soft_bounces || 0),
    unsubscribes: report.unsubscribed || 0,
    complaints: report.abuse_reports || 0,
    deliveries: report.emails_sent || 0,
  };
}

module.exports = {
  validateKey,
  fetchCampaigns,
  fetchReport,
  mapReportToMetrics,
};
