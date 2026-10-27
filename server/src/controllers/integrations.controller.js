const prisma = require("../lib/prisma");
const { encrypt } = require("../lib/encryption");
const { validateKey } = require("../services/mailchimp.service");
const mailchimpSyncQueue = require("../workers/mailchimpSync.worker");

// POST /api/integrations/mailchimp/connect
async function connect(req, res) {
  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== "string") {
    return res.status(400).json({ error: "apiKey is required" });
  }

  const trimmed = apiKey.trim();
  const valid = await validateKey(trimmed).catch(() => false);
  if (!valid)
    return res.status(422).json({ error: "Invalid Mailchimp API key" });

  await prisma.user.update({
    where: { id: req.user.id },
    data: { mailchimpApiKeyEnc: encrypt(trimmed) },
  });

  res.json({ message: "Mailchimp connected successfully" });
}

// POST /api/integrations/mailchimp/sync
async function sync(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user?.mailchimpApiKeyEnc) {
    return res.status(422).json({ error: "Connect a Mailchimp API key first" });
  }

  const job = await mailchimpSyncQueue.add(
    { userId: req.user.id },
    { attempts: 2, removeOnComplete: true, removeOnFail: true },
  );
  res.json({ message: "Sync started", jobId: job.id });
}

// GET /api/integrations/mailchimp/status
async function status(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { mailchimpLastSyncAt: true, mailchimpApiKeyEnc: true },
  });

  res.json({
    connected: !!user?.mailchimpApiKeyEnc,
    lastSyncAt: user?.mailchimpLastSyncAt || null,
  });
}

// DELETE /api/integrations/mailchimp
async function disconnect(req, res) {
  await prisma.user.update({
    where: { id: req.user.id },
    data: { mailchimpApiKeyEnc: null, mailchimpLastSyncAt: null },
  });
  res.json({ message: "Mailchimp disconnected" });
}

module.exports = { connect, sync, status, disconnect };
