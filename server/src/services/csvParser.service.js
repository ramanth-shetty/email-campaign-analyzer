const { parse } = require("csv-parse/sync");

/**
 * Column aliases — maps common CSV export header names (Mailchimp, SendGrid, generic)
 * to internal field names. Rate columns (e.g. "CTR", "Open Rate") are intentionally
 * NOT mapped; rates are always computed from counts.
 */
const COLUMN_MAP = {
  // Campaign name
  "campaign name": "name",
  "campaign title": "name",
  name: "name",
  title: "name",

  // Subject
  "subject line": "subject",
  subject: "subject",
  "email subject": "subject",

  // Send time
  "send time": "sentAt",
  "sent at": "sentAt",
  "send date": "sentAt",
  date: "sentAt",

  // Recipients
  recipients: "totalRecipients",
  "total recipients": "totalRecipients",
  "emails sent": "totalRecipients",
  delivered: "deliveries",
  deliveries: "deliveries",

  // Opens
  opens: "opens",
  "total opens": "opens",
  "unique opens": "uniqueOpens",

  // Clicks
  clicks: "clicks",
  "total clicks": "clicks",
  "unique clicks": "uniqueClicks",

  // Bounces
  bounces: "bounces",
  "hard bounces": "bounces",
  "total bounces": "bounces",

  // Unsubscribes
  unsubscribes: "unsubscribes",
  "unsubscribe count": "unsubscribes",
  unsubs: "unsubscribes",

  // Complaints / spam
  complaints: "complaints",
  "spam reports": "complaints",
};

// Each group needs at least one of its fields present
const REQUIRED_GROUPS = [
  { label: "Campaign Name", fields: ["name"] },
  { label: "Recipients", fields: ["totalRecipients", "deliveries"] },
  { label: "Opens", fields: ["opens", "uniqueOpens"] },
  { label: "Clicks", fields: ["clicks", "uniqueClicks"] },
  { label: "Bounces", fields: ["bounces"] },
  { label: "Unsubscribes", fields: ["unsubscribes"] },
];

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function toInt(value) {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(String(value).replace(/[,%\s]/g, ""));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function present(row, key) {
  return row[key] !== undefined && row[key] !== null && row[key] !== "";
}

/**
 * Parse a CSV buffer and return normalized campaign + metrics data.
 * @param {Buffer} buffer
 * @returns {{ campaign: object, metrics: object }[]}
 */
function parseCSV(buffer) {
  let records;
  try {
    records = parse(buffer, {
      columns: (headers) =>
        headers.map((h) => {
          const key = String(h).trim().toLowerCase();
          return COLUMN_MAP[key] || key;
        }),
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });
  } catch (err) {
    throw badRequest(`Invalid CSV file: ${err.message}`);
  }

  if (records.length === 0) {
    throw badRequest("CSV file is empty or has no data rows");
  }

  const headerKeys = new Set(Object.keys(records[0]));
  const missing = REQUIRED_GROUPS.filter(
    (g) => !g.fields.some((f) => headerKeys.has(f)),
  ).map((g) => g.label);
  if (missing.length > 0) {
    throw badRequest(
      `CSV is missing required column(s): ${missing.join(", ")}. ` +
        "Expected: Campaign Name, Subject (optional), Send Time (optional), Recipients, Opens, Clicks, Bounces, Unsubscribes",
    );
  }

  return records.map((row, i) => {
    const rowNum = i + 2; // +1 for header, +1 for 1-based

    const name = String(row.name || "").trim();
    if (!name) throw badRequest(`Row ${rowNum}: campaign name is empty`);

    let sentAt = null;
    if (present(row, "sentAt")) {
      sentAt = new Date(row.sentAt);
      if (Number.isNaN(sentAt.getTime())) {
        throw badRequest(`Row ${rowNum}: invalid send date "${row.sentAt}"`);
      }
    }

    const totalRecipients = toInt(row.totalRecipients) || toInt(row.deliveries);
    const deliveries = toInt(row.deliveries) || totalRecipients;

    const opens = present(row, "opens")
      ? toInt(row.opens)
      : toInt(row.uniqueOpens);
    const uniqueOpens = present(row, "uniqueOpens")
      ? toInt(row.uniqueOpens)
      : opens;
    const clicks = present(row, "clicks")
      ? toInt(row.clicks)
      : toInt(row.uniqueClicks);
    const uniqueClicks = present(row, "uniqueClicks")
      ? toInt(row.uniqueClicks)
      : clicks;

    return {
      campaign: {
        name,
        subject: present(row, "subject") ? String(row.subject).trim() : null,
        sentAt,
        totalRecipients,
      },
      metrics: {
        opens,
        uniqueOpens,
        clicks,
        uniqueClicks,
        bounces: toInt(row.bounces),
        unsubscribes: toInt(row.unsubscribes),
        complaints: toInt(row.complaints),
        deliveries,
      },
    };
  });
}

module.exports = { parseCSV };
