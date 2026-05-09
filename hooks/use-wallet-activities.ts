import { useCallback, useEffect, useState } from 'react';

import { fetchWalletActivities, type WalletActivityRow } from '@/lib/wallet-activities';

export function useWalletActivities(userId: string | null | undefined) {
  const [activities, setActivities] = useState<WalletActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setActivities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchWalletActivities(userId);
      setActivities(rows);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { activities, loading, refresh };
}
