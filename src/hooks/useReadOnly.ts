import { useAuth } from '../contexts/AuthContext';
import { hasActiveAccess } from '../lib/subscription';

export function useReadOnly() {
  const { userData, agencyData } = useAuth();
  if (userData?.role === 'master' || userData?.agencyId === 'unassigned') {
    return false;
  }

  return !hasActiveAccess(agencyData);
}
