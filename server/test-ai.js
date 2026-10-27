require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const campaign = await prisma.campaign.findFirst({ include: { metrics: true } });
  if (!campaign) {
    console.log('NO_CAMPAIGNS — upload a CSV first');
    return;
  }
  console.log('CAMPAIGN_ID:', campaign.id);
  console.log('HAS_METRICS:', !!campaign.metrics);
  console.log('NAME:', campaign.name);

  // Now call the AI endpoint directly
  const jwt = require('jsonwebtoken');
  const user = await prisma.user.findFirst();
  if (!user) { console.log('NO_USERS'); return; }

  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' });

  const res = await fetch(`http://localhost:4000/api/ai/insights/${campaign.id}`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  if (data.error) {
    console.log('ENDPOINT ERROR:', data.error);
  } else {
    const suggestions = data.insight?.response || [];
    console.log('SUCCESS - Got', suggestions.length, 'suggestions');
    suggestions.forEach((s, i) => console.log(i+1+'.', '['+s.priority+']', s.category+':',s.suggestion?.substring(0,60)));
  }
}

main().catch(e => console.log('ERROR:', e.message)).finally(() => prisma.$disconnect());
