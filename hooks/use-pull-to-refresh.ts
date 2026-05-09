import { useCallback, useState } from 'react';

/** Pull-to-refresh: drives skeleton overlay until `refreshFn` resolves. */
export function usePullToRefresh(refreshFn: () => void | Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.resolve(refreshFn());
    } finally {
      setRefreshing(false);
    }
  }, [refreshFn]);

  return { refreshing, onRefresh };
}
