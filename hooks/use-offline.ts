import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useOffline(): { offline: boolean; ready: boolean } {
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      // `isInternetReachable` is the best signal; it can be null briefly.
      const reachable = state.isInternetReachable;
      const connected = state.isConnected;
      const isOffline =
        reachable === false || (reachable == null ? connected === false : false);
      setOffline(Boolean(isOffline));
      setReady(true);
    });
    return () => sub();
  }, []);

  return { offline, ready };
}

