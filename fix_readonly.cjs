const fs = require('fs');

let content = fs.readFileSync('src/hooks/useReadOnly.ts', 'utf8');

const oldCheck = `  if (agencyData?.subscriptionStatus === 'trialing' && agencyData?.trialEndsAt) {
    const trialEnds = safeDate(agencyData.trialEndsAt);
    if (trialEnds > new Date()) {
      hasActiveSubscription = true;
    }
  }`;

const newCheck = `  if (agencyData?.subscriptionStatus === 'trialing') {
    let trialEnds;
    if (agencyData.createdAt) {
      const createdDate = safeDate(agencyData.createdAt);
      trialEnds = new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else if (agencyData.trialEndsAt) {
      trialEnds = safeDate(agencyData.trialEndsAt);
    }

    if (trialEnds && trialEnds > new Date()) {
      hasActiveSubscription = true;
    }
  }`;

content = content.replace(oldCheck, newCheck);
fs.writeFileSync('src/hooks/useReadOnly.ts', content, 'utf8');
