import { useCallback } from 'react';

import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';

/** Pull-to-refresh with animated skeleton until delay completes (static / demo pages). */
export function useDummyPullRefresh(ms = 700) {
  const fn = useCallback(async () => {
    await new Promise<void>((r) => setTimeout(r, ms));
  }, [ms]);
  return usePullToRefresh(fn);
}
