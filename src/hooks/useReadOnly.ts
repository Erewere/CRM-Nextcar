import { useAuth } from '../contexts/AuthContext';

const safeDate = (val: any) => {
  if (!val) return new Date();
  if (typeof val.toDate === 'function') return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
};

export function useReadOnly() {
  const { userData, agencyData } = useAuth();
  if (userData?.role === 'master' || userData?.agencyId === 'unassigned') {
    return false;
  }
  
  let hasActiveSubscription = agencyData?.hasFreeAccess || agencyData?.subscriptionStatus === 'active';
  
  if (agencyData?.subscriptionStatus === 'trialing') {
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
  }

  return !hasActiveSubscription;
}
