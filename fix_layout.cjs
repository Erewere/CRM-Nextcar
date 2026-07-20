const fs = require('fs');

let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const oldCheck = `  const trialDaysLeft = (agencyData?.subscriptionStatus === "trialing" && agencyData?.trialEndsAt)
    ? Math.max(0, Math.ceil((safeDate(agencyData.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 3600 * 24)))
    : null;`;

const newCheck = `  let trialDaysLeft = null;
  if (agencyData?.subscriptionStatus === "trialing") {
    if (agencyData.createdAt) {
      const createdDate = safeDate(agencyData.createdAt);
      const daysSinceCreation = Math.floor((new Date().getTime() - createdDate.getTime()) / (1000 * 3600 * 24));
      trialDaysLeft = Math.max(0, 30 - daysSinceCreation);
    } else if (agencyData.trialEndsAt) {
      trialDaysLeft = Math.max(0, Math.ceil((safeDate(agencyData.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 3600 * 24)));
    }
  }`;

content = content.replace(oldCheck, newCheck);
fs.writeFileSync('src/components/Layout.tsx', content, 'utf8');
