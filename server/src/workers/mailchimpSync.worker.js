const Queue = require("bull");
const prisma = require("../lib/prisma");
const { decrypt } = require("../lib/encryption");
const {
  fetchCampaigns,
  fetchReport,
  mapReportToMetrics,
} = require("../services/mailchimp.service");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const REPORT_BATCH_SIZE = 5;

// Bull takes the Redis URL as the first-argument-after-name string
const mailchimpSyncQueue = new Queue("mailchimp-sync", REDIS_URL);

mailchimpSyncQueue.process(async (job) => {
  const { userId } = job.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.mailchimpApiKeyEnc)
    throw new Error("No Mailchimp API key stored for user");

  const apiKey = decrypt(user.mailchimpApiKeyEnc);
  const campaigns = await fetchCampaigns(apiKey);

  let synced = 0;

  for (let i = 0; i < campaigns.length; i += REPORT_BATCH_SIZE) {
    const batch = campaigns.slice(i, i + REPORT_BATCH_SIZE);
    const reports = await Promise.all(
      batch.map((mc) => fetchReport(apiKey, mc.id)),
    );

    for (let j = 0; j < batch.length; j++) {
      const mc = batch[j];
      const metrics = mapReportToMetrics(reports[j]);

      const campaignData = {
        userId,
        source: "MAILCHIMP",
        name: mc.settings?.title || mc.settings?.subject_line || mc.id,
        subject: mc.settings?.subject_line || null,
        sentAt: mc.send_time ? new Date(mc.send_time) : null,
        totalRecipients: mc.emails_sent || 0,
        externalId: mc.id,
      };

      const campaign = await prisma.campaign.upsert({
        where: { userId_externalId: { userId, externalId: mc.id } },
        update: campaignData,
        create: campaignData,
      });

      if (metrics) {
        await prisma.campaignMetrics.upsert({
          where: { campaignId: campaign.id },
          update: metrics,
          create: { campaignId: campaign.id, ...metrics },
        });
      }
      synced++;
    }

    await job.progress(
      Math.round(((i + batch.length) / campaigns.length) * 100),
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { mailchimpLastSyncAt: new Date() },
  });

  return { synced };
});

mailchimpSyncQueue.on("failed", (job, err) => {
  console.error(`[mailchimp-sync] job ${job?.id} failed:`, err.message);
});

module.exports = mailchimpSyncQueue;
