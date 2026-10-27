const prisma = require("../lib/prisma");
const { parseCSV } = require("../services/csvParser.service");

// POST /api/campaigns/upload
async function uploadCSV(req, res) {
  if (!req.file) {
    return res.status(400).json({
      error:
        'No file uploaded. Send a CSV as multipart/form-data field "file".',
    });
  }

  const rows = parseCSV(req.file.buffer);

  // All-or-nothing import; rows already imported earlier are skipped
  const { created, skipped } = await prisma.$transaction(
    async (tx) => {
      const createdCampaigns = [];
      let skippedCount = 0;

      for (const { campaign: campData, metrics: metricsData } of rows) {
        const existing = await tx.campaign.findFirst({
          where: {
            userId: req.user.id,
            source: "CSV",
            name: campData.name,
            sentAt: campData.sentAt,
          },
          select: { id: true },
        });

        if (existing) {
          skippedCount++;
          continue;
        }

        const campaign = await tx.campaign.create({
          data: {
            userId: req.user.id,
            source: "CSV",
            name: campData.name,
            subject: campData.subject,
            sentAt: campData.sentAt,
            totalRecipients: campData.totalRecipients,
            metrics: { create: metricsData },
          },
          include: { metrics: true },
        });
        createdCampaigns.push(campaign);
      }

      return { created: createdCampaigns, skipped: skippedCount };
    },
    { timeout: 60000 },
  );

  res.status(created.length > 0 ? 201 : 200).json({
    count: created.length,
    skipped,
    campaigns: created.map((c) => ({
      campaignId: c.id,
      name: c.name,
      totalRecipients: c.totalRecipients,
      metrics: c.metrics,
    })),
  });
}

module.exports = { uploadCSV };
