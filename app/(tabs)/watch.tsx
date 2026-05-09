import GoldCoin from '@/assets/vibepay/icons/50cent.svg';
import ScrollIcon from '@/assets/vibepay/icons/scroll.svg';
import { VibeBottomNav } from '@/components/vibepay/bottom-nav';
import { SwipeUpOnboardingHint } from '@/components/vibepay/swipe-up-onboarding-hint';
import { SkeletonLoadingPage } from '@/components/vibepay/skeleton-loading-page';
import { vibeColors } from '@/components/vibepay/vibe-screen';
import { useAccountData } from '@/hooks/use-account-data';
import { fetchAppSettings } from '@/lib/app-settings';
import vimeoApi, { resolveFeedCreatorHandle } from '@/lib/vimeo';
import { addWatchCoins, saveScrollPoints } from '@/lib/wallet-remote';
import { hydrateWalletFromServer } from '@/lib/wallet-store';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { router, useFocusEffect } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

type FeedItem = {
  id: string;
  videoUri: string; // Vimeo video id
  poster?: string;
  handle: string;
  desc: string;
  audio: string;
  likeCount: string;
};

type GateItem = { id: 'no-scroll-gate'; kind: 'noScroll' };
type WatchItem = (FeedItem & { kind?: 'video' }) | GateItem;

function shuffleArray<T>(arr: T[]) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/** Active clip only: if playback never starts (e.g. geo “removed in your country”), skip without showing the iframe error UI. */
/** Geo-block UI often appears without a Player `error` event; skip if `play` never fires. */
const VIMEO_STALL_SKIP_MS = 10000;

function vimeoHtml(videoId: string, muted: boolean, autoplay: boolean) {
  const safeId = encodeURIComponent(videoId);
  const src = `https://player.vimeo.com/video/${safeId}?autoplay=${autoplay ? 1 : 0}&muted=${
    muted ? 1 : 0
  }&controls=0&pip=0&playsinline=1&title=0&byline=0&portrait=0&dnt=1`;
  const stallMs = VIMEO_STALL_SKIP_MS;
  const autoplayOn = autoplay ? 'true' : 'false';
  return `<!doctype html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
      <script src="https://player.vimeo.com/api/player.js"></script>
      <style>
        /* Block taps reaching Vimeo UI (share/scrub/fullscreen); RN feed keeps vertical swipes. */
        html, body {
          margin:0; padding:0; background:#000; height:100%; overflow:hidden;
          pointer-events: none;
          touch-action: none;
          -webkit-user-select: none;
          user-select: none;
        }
        /* "Cover" behavior: fill portrait screen like TikTok (crop if needed). */
        iframe {
          position:absolute;
          top:50%;
          left:50%;
          width:177.78vh;
          height:100vh;
          min-width:100vw;
          min-height:56.25vw;
          transform:translate(-50%, -50%);
          border:0;
          pointer-events: none !important;
          touch-action: none;
        }
      </style>
    </head>
    <body>
      <iframe id="vp" src="${src}" allow="autoplay"></iframe>
      <script>
        (function() {
          var autoplayActive = ${autoplayOn};
          var stallMs = ${stallMs};
          var played = false;
          var stallTimer = null;
          function clearStallTimer() {
            if (stallTimer) clearTimeout(stallTimer);
            stallTimer = null;
          }
          function post(event, payload) {
            try {
              if (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) return;
              window.ReactNativeWebView.postMessage(JSON.stringify({ source: "vimeo", event: event, payload: payload || null }));
            } catch (e) {}
          }
          function serializeErr(e) {
            try {
              if (!e) return "error";
              if (typeof e === "string") return e;
              return JSON.stringify({ n: e.name || "", m: String(e.message || ""), method: e.method || "" });
            } catch (ex) {
              return "error";
            }
          }
          try {
            var iframe = document.getElementById("vp");
            var player = new Vimeo.Player(iframe);
            player.on("loaded", function() {
              post("loaded");
              played = false;
              clearStallTimer();
              if (autoplayActive) {
                stallTimer = setTimeout(function() {
                  if (!played) post("stall_no_play", { ms: stallMs });
                }, stallMs);
              }
            });
            player.on("play", function() {
              played = true;
              clearStallTimer();
              post("play");
            });
            player.on("pause", function() { post("pause"); });
            player.on("ended", function() {
              clearStallTimer();
              post("ended");
            });
            player.on("error", function(e) {
              clearStallTimer();
              post("error", serializeErr(e));
            });
          } catch (e) {
            post("error", "init_failed");
          }
        })();
      </script>
    </body>
  </html>`;
}

const COIN_PARTICLES = 15;
const WATCH_REWARD_SECONDS = 35;
/** Old builds / Metro cache may still reference this name; keep defined to avoid ReferenceError. Scroll clamp no longer uses ratio slack. */
const WATCH_BACK_SCROLL_SNAP_RATIO = 0;
/** End of coin burst + count-up animation (must match timings inside playCoinBurst). */
function coinBurstAnimationSettleMs(): number {
  const burstMs = 220;
  const lingerMs = 1800;
  const flyMs = 520;
  const staggerMs = 35;
  const firstArrivalMs = burstMs + lingerMs + flyMs;
  const lastArrivalMs = firstArrivalMs + (COIN_PARTICLES - 1) * staggerMs;
  const countUpDuration = Math.max(520, lastArrivalMs - firstArrivalMs);
  return firstArrivalMs + countUpDuration + 120;
}

export default function WatchScreen() {
  const { wallet, session, loading: accountLoading, refresh } = useAccountData();
  const [scrollPersistReady, setScrollPersistReady] = useState(false);
  const [rewardCoins, setRewardCoins] = useState(50);

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const uniqueIdRef = useRef(0);

  const isFocused = useIsFocused();

  const [liked, setLiked] = useState(false);
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 16);
  const bottomPad = Math.max(insets.bottom, 16);

  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  /** Measured FlatList viewport — must match row height or paging shows the next item. */
  const [listViewportH, setListViewportH] = useState<number | null>(null);
  const pageH = listViewportH ?? windowHeight;
  /** Keeps award scroll math current without re-creating callbacks when orientation changes row height. */
  const pageHRef = useRef(pageH);
  pageHRef.current = pageH;

  const onListLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h <= 0) return;
    setListViewportH(Math.round(h));
  }, []);

  useEffect(() => {
    setListViewportH(null);
  }, [windowHeight, windowWidth]);

  const listRef = useRef<FlatList<WatchItem> | null>(null);
  /** Active row WebView — reload when iOS/Android terminates the renderer (white/frozen surface). */
  const activeWebViewRef = useRef<WebView | null>(null);
  const activeIndexRef = useRef(0);
  /** Ignore bogus viewability indices while we re-snap scroll after orientation/page-height change. */
  const pinningOrientationRef = useRef(false);
  const prevPageHForPinRef = useRef<number | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  activeIndexRef.current = activeIndex;

  /**
   * When row height changes (rotate device / lock orientation), scroll offset in px stays fixed while
   * item height changes — FlatList maps the wrong index. Re-snap before paint (layout) so viewability
   * does not commit a bogus index.
   */
  useLayoutEffect(() => {
    if (!isFocused) return;
    const h = pageH;
    if (prevPageHForPinRef.current === null) {
      prevPageHForPinRef.current = h;
      return;
    }
    if (prevPageHForPinRef.current === h) return;
    prevPageHForPinRef.current = h;

    pinningOrientationRef.current = true;
    const idx = activeIndexRef.current;
    try {
      listRef.current?.scrollToOffset({ offset: idx * h, animated: false });
    } catch {
      try {
        listRef.current?.scrollToIndex({ index: idx, animated: false });
      } catch {
        // ignore
      }
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        pinningOrientationRef.current = false;
      });
    });
    // Intentionally omit activeIndex from deps: only re-snap when row height or focus changes.
  }, [pageH, isFocused]);

  const lastAwardedIndexRef = useRef<number | null>(null);
  /** Vimeo video ids that have already completed the 35s reward on this session — countdown must not repeat. */
  const rewardClaimedForUriRef = useRef<Set<string>>(new Set());
  /** Bumps when a clip is marked rewarded so scroll lock + FlatList re-evaluate. */
  const [scrollPermissionEpoch, setScrollPermissionEpoch] = useState(0);
  const watchTimerRef = useRef<{ idx: number; t: ReturnType<typeof setTimeout> } | null>(null);
  /** Latest burst impl so `awardForActiveIndex` stays stable when landscape UI toggles (same pattern as `pageHRef`). */
  const playCoinBurstRef = useRef<(amountToAdd: number) => Promise<boolean>>(async () => false);
  const spProgress = useRef(new Animated.Value(1)).current; // 1 -> 0 over 30s
  const [activePlaying, setActivePlaying] = useState(false);
  const [swipeHintVisible, setSwipeHintVisible] = useState(false);
  const [watchLandscapeMode, setWatchLandscapeMode] = useState(false);
  const skipBadVideo = useCallback(
    (badId: string) => {
      setFeed((prev) => {
        const next = prev.filter((v) => v.videoUri !== badId);
        // Same slot gets the next URI after removal; clamp when skipping the last row so offset stays in range.
        requestAnimationFrame(() => {
          const idx = Math.min(activeIndex, Math.max(0, next.length - 1));
          try {
            listRef.current?.scrollToOffset({ offset: idx * pageH, animated: true });
          } catch {
            try {
              listRef.current?.scrollToIndex({ index: idx, animated: true });
            } catch {
              // ignore
            }
          }
        });
        return next;
      });
    },
    [activeIndex, pageH]
  );
  const [spPillLayout, setSpPillLayout] = useState<{ w: number; h: number } | null>(null);

  const AnimatedPath = useMemo(() => Animated.createAnimatedComponent(Path), []);

  const spRing = useMemo(() => {
    if (!spPillLayout) return null;
    const inset = 1.5; // stroke sits on top of the pill
    const w = Math.max(10, spPillLayout.w - inset * 2);
    const h = Math.max(10, spPillLayout.h - inset * 2);
    const r = Math.max(1, h / 2);
    const x0 = inset;
    const y0 = inset;

    // Rounded-rect path (pill), starting at TOP-CENTER and going anti-clockwise.
    const cx = x0 + w / 2;
    const d = [
      `M ${cx} ${y0}`,
      // go left along top edge
      `H ${x0 + r}`,
      // top-left curve (anti-clockwise)
      `A ${r} ${r} 0 0 0 ${x0} ${y0 + r}`,
      // left side down
      `V ${y0 + h - r}`,
      // bottom-left curve
      `A ${r} ${r} 0 0 0 ${x0 + r} ${y0 + h}`,
      // bottom edge right
      `H ${x0 + w - r}`,
      // bottom-right curve
      `A ${r} ${r} 0 0 0 ${x0 + w} ${y0 + h - r}`,
      // right side up
      `V ${y0 + r}`,
      // top-right curve
      `A ${r} ${r} 0 0 0 ${x0 + w - r} ${y0}`,
      // back to top-center
      `H ${cx}`,
      'Z',
    ].join(' ');

    // Perimeter for stroke-dash animation (pill approximation).
    const straight = 2 * Math.max(0, w - 2 * r) + 2 * Math.max(0, h - 2 * r);
    const curved = 2 * Math.PI * r;
    const perimeter = straight + curved;

    // Countdown behavior:
    // - spProgress animates 1 -> 0 over 30s
    // - We want the GAP to grow anti-clockwise starting from the TOP-CENTER start point.
    //
    // Use a string dasharray because `react-native-svg` is more reliable with
    // Animated string props than Animated numeric arrays.
    const dasharray = spProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [`0 ${perimeter}`, `${perimeter} ${perimeter}`],
    });

    // Move the dash so the visible segment shrinks anti-clockwise.
    const dashoffset = Animated.multiply(Animated.subtract(1, spProgress), -perimeter);

    return { d, perimeter, dasharray, dashoffset };
  }, [spPillLayout, spProgress]);
  const [spLeft, setSpLeft] = useState(0);
  const spLeftRef = useRef(0);
  const lastVideoIndexRef = useRef<number>(0);
  /** Lowest index user may stay on; scrolling "down" / back to older videos is blocked. */
  const forwardFloorRef = useRef(0);
  const [lockedNoScroll, setLockedNoScroll] = useState(false);
  const data = useMemo<WatchItem[]>(() => {
    // Only show the “out of scroll points” gate when SP is actually 0.
    if (feed.length < 3) return feed.map((f) => ({ ...f, kind: 'video' as const }));
    const videos = feed.map((f) => ({ ...f, kind: 'video' as const }));
    if (spLeft > 0) return videos;
    const head = videos.slice(0, 3);
    const tail = videos.slice(3);
    return [...head, { id: 'no-scroll-gate', kind: 'noScroll' as const }, ...tail];
  }, [feed, spLeft]);

  const gateIndex = feed.length >= 3 && spLeft <= 0 ? 3 : -1;

  const [coinsDisplay, setCoinsDisplay] = useState(0);
  const countUpRafRef = useRef<number | null>(null);

  useEffect(() => {
    spLeftRef.current = spLeft;
  }, [spLeft]);

  const awardForActiveIndex = useCallback(() => {
    if (!isFocused) return;
    if (lockedNoScroll) return;
    if (spLeftRef.current <= 0) return;

    const clipItem = data[activeIndex];
    const clipUri =
      clipItem && 'videoUri' in clipItem ? String(clipItem.videoUri) : '';
    if (!clipUri || rewardClaimedForUriRef.current.has(clipUri)) return;
    if (lastAwardedIndexRef.current === activeIndex) return;

    rewardClaimedForUriRef.current.add(clipUri);
    setScrollPermissionEpoch((e) => e + 1);
    lastAwardedIndexRef.current = activeIndex;
    playBonus();
    void playCoinBurstRef.current(rewardCoins);

    const currentIdx = activeIndex;
    setSpLeft((s) => {
      const nextSp = Math.max(0, s - 1);
      requestAnimationFrame(() => {
        if (nextSp <= 0) {
          setLockedNoScroll(true);
          try {
            listRef.current?.scrollToIndex({ index: 3, animated: true });
          } catch {
            listRef.current?.scrollToOffset({ offset: 3 * pageHRef.current, animated: true });
          }
          return;
        }
        setSwipeHintVisible(true);
        // Prefetch; user scrolls manually to the next video after the reward timer.
        const rawNext = currentIdx + 1;
        if (rawNext >= data.length - 3) fetchMore();
      });
      return nextSp;
    });
  }, [activeIndex, data, data.length, fetchMore, isFocused, lockedNoScroll, playBonus, rewardCoins]);

  // Watch countdown animation around the SP pill.
  // IMPORTANT: it should NOT start until the active video actually starts playing.
  // Runs at most once per clip (same Vimeo id never counts down twice).
  useEffect(() => {
    const clipItem = data[activeIndex];
    const clipUri =
      clipItem && 'videoUri' in clipItem ? String(clipItem.videoUri) : '';

    if (
      !isFocused ||
      lockedNoScroll ||
      spLeft <= 0 ||
      !activePlaying ||
      (clipUri && rewardClaimedForUriRef.current.has(clipUri))
    ) {
      if (watchTimerRef.current) clearTimeout(watchTimerRef.current.t);
      watchTimerRef.current = null;
      spProgress.stopAnimation();
      spProgress.setValue(1);
      return;
    }

    if (watchTimerRef.current) clearTimeout(watchTimerRef.current.t);
    watchTimerRef.current = { idx: activeIndex, t: setTimeout(() => {}, 0) };

    spProgress.stopAnimation();
    spProgress.setValue(1);
    Animated.timing(spProgress, {
      toValue: 0,
      duration: WATCH_REWARD_SECONDS * 1000,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      if (!watchTimerRef.current || watchTimerRef.current.idx !== activeIndex) return;
      awardForActiveIndex();
    });

    watchTimerRef.current.t = setTimeout(() => {
      // no-op, just to keep a cancellable handle even if timing gets interrupted
    }, WATCH_REWARD_SECONDS * 1000 + 50);

    return () => {
      if (watchTimerRef.current) clearTimeout(watchTimerRef.current.t);
      watchTimerRef.current = null;
      spProgress.stopAnimation();
    };
  }, [
    activeIndex,
    activePlaying,
    awardForActiveIndex,
    data,
    isFocused,
    lockedNoScroll,
    scrollPermissionEpoch,
    spLeft,
    spProgress,
  ]);

  useEffect(() => {
    setSwipeHintVisible(false);
  }, [activeIndex]);

  useEffect(() => {
    if (!isFocused) setSwipeHintVisible(false);
  }, [isFocused]);

  /** After blur, `swipeHintVisible` clears; restore cue when this clip already earned so scroll isn’t stuck. */
  useEffect(() => {
    if (!isFocused) return;
    const clipItem = data[activeIndex];
    const clipUri =
      clipItem && 'videoUri' in clipItem ? String(clipItem.videoUri) : '';
    if (clipUri && rewardClaimedForUriRef.current.has(clipUri)) {
      setSwipeHintVisible(true);
    }
  }, [isFocused, activeIndex, data]);

  // Reset play state when changing videos (defer so the next clip's `play` event wins over this stale `false`).
  useEffect(() => {
    const t = requestAnimationFrame(() => {
      setActivePlaying(false);
      spProgress.stopAnimation();
      spProgress.setValue(1);
    });
    return () => cancelAnimationFrame(t);
  }, [activeIndex, spProgress]);

  useEffect(() => {
    // Automatically unlock scrolling when SP > 0 (e.g. after buying a pack).
    if (spLeft > 0 && lockedNoScroll) setLockedNoScroll(false);
  }, [spLeft, lockedNoScroll]);

  useFocusEffect(
    useCallback(() => {
      // Always pull latest wallet/coins from DB when Watch is opened or refocused.
      void refresh();
      void fetchAppSettings().then((s) => setRewardCoins(Math.max(0, Math.round(Number(s.watch_reward_coins ?? 50)))));
      return () => {
        const uid = session?.user?.id;
        if (!uid) return;
        void saveScrollPoints(uid, spLeftRef.current).then(({ wallet: w }) => {
          if (w) hydrateWalletFromServer(w);
        });
      };
    }, [refresh, session?.user?.id])
  );

  const toggleWatchLandscape = useCallback(async () => {
    if (Platform.OS === 'web') {
      setWatchLandscapeMode((v) => !v);
      return;
    }
    try {
      const next = !watchLandscapeMode;
      await ScreenOrientation.lockAsync(
        next ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP
      );
      setWatchLandscapeMode(next);
    } catch {
      setWatchLandscapeMode((v) => !v);
    }
  }, [watchLandscapeMode]);

  /** Leaving Watch restores portrait so other tabs stay upright; clears cinema chrome. */
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (Platform.OS === 'web') return;
        void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
        setWatchLandscapeMode(false);
      };
    }, [])
  );

  useEffect(() => {
    if (!isFocused) return;
    if (!session?.user?.id) {
      setScrollPersistReady(false);
      return;
    }
    if (!wallet) {
      setScrollPersistReady(false);
      setSpLeft(0);
      setCoinsDisplay(0);
      // IMPORTANT: do not hydrate zeros into the global wallet store.
      // When `wallet` is temporarily null (loading/race), pushing zeros here causes every other tab to flash 0.
      return;
    }
    setSpLeft(Math.round(wallet.scroll_points));
    setCoinsDisplay(Number(wallet.coin_balance));
    hydrateWalletFromServer(wallet);
    setScrollPersistReady(true);
  }, [wallet, session?.user?.id, isFocused]);

  useEffect(() => {
    if (!session?.user?.id || !scrollPersistReady || !isFocused) return;
    const uid = session.user.id;
    let cancelled = false;
    const t = setTimeout(() => {
      saveScrollPoints(uid, spLeft).then(({ wallet: w, error }) => {
        if (cancelled || error || !w) return;
        hydrateWalletFromServer(w);
      });
    }, 320);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [spLeft, session?.user?.id, scrollPersistReady, isFocused]);

  const bonusOpacity = useRef(new Animated.Value(0)).current;
  const bonusTranslate = useRef(new Animated.Value(0)).current;

  // Background audio to guarantee "sound" even for silent stock clips.
  const bgSoundRef = useRef<Audio.Sound | null>(null);

  const coinsPillRef = useRef<View | null>(null);
  const coinsIconRef = useRef<View | null>(null);
  const coinLayerRef = useRef<View | null>(null);
  const [coinsTarget, setCoinsTarget] = useState<{ x: number; y: number } | null>(null);
  const [coinLayerFrame, setCoinLayerFrame] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const coinsPillScale = useRef(new Animated.Value(1)).current;

  const coinParticles = useRef(
    Array.from({ length: COIN_PARTICLES }).map(() => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      s: new Animated.Value(0.7),
      o: new Animated.Value(0),
      r: new Animated.Value(0),
    }))
  ).current;

  const animateCountUp = useCallback((from: number, to: number, durationMs: number) => {
    if (countUpRafRef.current) cancelAnimationFrame(countUpRafRef.current);
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(from + (to - from) * eased);
      setCoinsDisplay(v);
      if (t < 1) countUpRafRef.current = requestAnimationFrame(tick);
    };
    countUpRafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    return () => {
      if (countUpRafRef.current) cancelAnimationFrame(countUpRafRef.current);
    };
  }, []);

  const fetchMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setFeedError(null);
    try {
      const fn = (vimeoApi as any)?.fetchVimeoVideos as undefined | ((limit?: number) => Promise<any>);
      if (!fn) {
        setFeedError('Video loader failed to initialize (bundler cache issue). Please reload the app.');
        return;
      }
      const r = await fn(20);
      if (r.error) {
        setFeedError(String(r.error));
        return;
      }
      const mapped: FeedItem[] = shuffleArray(r.videos).map((v) => {
        const handle = resolveFeedCreatorHandle(v);
        return {
          id: `dm-${v.id}-${uniqueIdRef.current++}`,
          videoUri: String(v.id),
          poster: v.thumbnail_720_url ?? undefined,
          handle,
          desc: v.title || 'Trending on Vimeo',
          audio: v.author_name?.trim() || 'Vimeo',
          likeCount: `${Math.floor(1 + Math.random() * 20)}.${Math.floor(Math.random() * 10)}k`,
        };
      });

      setFeed((prev) => {
        const seen = new Set(prev.map((p) => p.videoUri));
        const next = mapped.filter((m) => !seen.has(m.videoUri));
        if (next.length) {
          setFeedError(null);
        }
        return prev.concat(next);
      });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore]);

  /** Vimeo fires `ended` when the main clip finishes — advance before end-screen / recommendations UI kicks in. */
  const onVideoPlaybackEnded = useCallback(
    (endedAtIndex: number) => {
      if (!isFocused) return;
      if (lockedNoScroll) return;
      if (endedAtIndex !== activeIndex) return;

      const endedItem = data[endedAtIndex];
      const endedUri =
        endedItem && 'videoUri' in endedItem ? String(endedItem.videoUri) : '';
      if (!endedUri || !rewardClaimedForUriRef.current.has(endedUri)) return;

      const next = endedAtIndex + 1;
      if (next >= data.length) {
        void fetchMore();
        return;
      }

      requestAnimationFrame(() => {
        try {
          listRef.current?.scrollToIndex({ index: next, animated: true });
        } catch {
          listRef.current?.scrollToOffset({ offset: next * pageH, animated: true });
        }
      });

      if (next >= data.length - 3) void fetchMore();
    },
    [activeIndex, data, data.length, fetchMore, isFocused, lockedNoScroll, pageH]
  );

  const refreshAll = useCallback(async () => {
    await refresh();
    uniqueIdRef.current = 0;
    setFeed([]);
    setFeedError(null);
    setActiveIndex(0);
    setSwipeHintVisible(false);
    lastAwardedIndexRef.current = null;
    lastVideoIndexRef.current = 0;
    forwardFloorRef.current = 0;
    rewardClaimedForUriRef.current.clear();
    setScrollPermissionEpoch((e) => e + 1);
    setLockedNoScroll(false);
    await fetchMore();
  }, [fetchMore, refresh]);

  const [refreshing, setRefreshing] = useState(false);
  const watchRefreshBusyRef = useRef(false);
  const onWatchPressRefresh = useCallback(async () => {
    if (watchRefreshBusyRef.current) return;
    watchRefreshBusyRef.current = true;
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
      watchRefreshBusyRef.current = false;
    }
  }, [refreshAll]);

  /** User may not leave the clip until the 35s reward has completed (unless out of SP / gate). */
  const feedScrollEnabled = useMemo(() => {
    void scrollPermissionEpoch;
    if (lockedNoScroll) return false;
    const item = data[activeIndex];
    if (!item) return true;
    if ('kind' in item && item.kind === 'noScroll') return true;
    if (spLeft <= 0) return true;
    const uri = 'videoUri' in item ? String(item.videoUri) : '';
    if (!uri) return true;
    if (!rewardClaimedForUriRef.current.has(uri)) return false;
    return swipeHintVisible;
  }, [scrollPermissionEpoch, activeIndex, data, lockedNoScroll, spLeft, swipeHintVisible]);

  const feedScrollEnabledRef = useRef(feedScrollEnabled);
  feedScrollEnabledRef.current = feedScrollEnabled;

  const handleWatchListScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const page = pageHRef.current;
    const floor = forwardFloorRef.current;
    const minY = floor * page;

    // Never allow scrolling back before the earliest clip in this session (forward-only feed).
    if (y < minY - 0.5) {
      listRef.current?.scrollToOffset({ offset: minY, animated: false });
    }

    if (feedScrollEnabledRef.current) return;
    const lockedY = activeIndexRef.current * page;
    if (y > lockedY + 1) {
      listRef.current?.scrollToOffset({ offset: lockedY, animated: false });
    }
  }, []);

  const hasScrollPoints = useMemo(
    () => !!wallet && Math.round(wallet.scroll_points) > 0,
    [wallet]
  );

  /**
   * Prefetch toggles `loadingMore` off between rapid retries; `feedError` can stay set from a failed attempt.
   * Only allow the empty-state error UI after a short idle gap so “Connecting…” doesn’t flash against the error.
   */
  const [emptyFeedErrorReady, setEmptyFeedErrorReady] = useState(false);
  useEffect(() => {
    if (feed.length > 0) {
      setEmptyFeedErrorReady(false);
      return;
    }
    if (loadingMore || refreshing) {
      setEmptyFeedErrorReady(false);
      return;
    }
    const id = setTimeout(() => setEmptyFeedErrorReady(true), 450);
    return () => clearTimeout(id);
  }, [feed.length, loadingMore, refreshing]);

  /** Empty feed can briefly race prefetch — show connecting UI first; only confirm error after idle empty window. */
  useEffect(() => {
    if (!hasScrollPoints || !isFocused) return;
    if (feed.length > 0) return;
    if (loadingMore || refreshing) return;

    const t = setTimeout(() => {
      setFeedError(
        (prev) =>
          prev ??
          'No videos returned. Check your Supabase Edge Function secrets and deployment.'
      );
    }, 2800);
    return () => clearTimeout(t);
  }, [feed.length, loadingMore, refreshing, hasScrollPoints, isFocused]);

  useEffect(() => {
    if (!hasScrollPoints) return;
    if (!feed.length) fetchMore();
  }, [hasScrollPoints, feed.length, fetchMore]);

  // Ensure audio plays loudly (and in iOS silent mode).
  useEffect(() => {
    (async () => {
      try {
        await Audio.setIsEnabledAsync(true);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          interruptionModeIOS: Audio.InterruptionModeIOS.DoNotMix,
          interruptionModeAndroid: Audio.InterruptionModeAndroid.DoNotMix,
        });
      } catch {
        // If this fails, video still plays but may be silent on iOS silent switch.
      }
    })();
  }, []);

  // Guarantee "sound" by playing a lightweight looping music bed.
  // Many Pexels clips are silent; this keeps the feed lively.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Never play audio if user isn't on Watch tab or feed isn't active (no SP gate).
        if (!isFocused || !hasScrollPoints) {
          await bgSoundRef.current?.pauseAsync();
          return;
        }

        if (!bgSoundRef.current) {
          const { sound } = await Audio.Sound.createAsync(
            {
              // Temporary royalty-free sample track; replace with your own hosted audio later.
              uri: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_1f05f6e860.mp3?filename=future-bass-logo-11736.mp3',
            },
            { shouldPlay: true, isLooping: true, volume: 0.35 }
          );
          if (cancelled) {
            await sound.unloadAsync();
            return;
          }
          bgSoundRef.current = sound;
        } else {
          await bgSoundRef.current.setVolumeAsync(0.35);
          await bgSoundRef.current.playAsync();
        }
      } catch {
        // best-effort
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasScrollPoints, isFocused]);

  // If leaving Watch, pause immediately.
  useEffect(() => {
    if (!isFocused) {
      bgSoundRef.current?.pauseAsync().catch(() => {});
    }
  }, [isFocused]);

  // Background prefetch: load a bunch of videos early to reduce buffering.
  useEffect(() => {
    if (!hasScrollPoints) return;
    let cancelled = false;
    (async () => {
      while (!cancelled && feed.length < 60) {
        await fetchMore();
        await new Promise((r) => setTimeout(r, 250));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [feed.length, fetchMore, hasScrollPoints]);

  useEffect(() => {
    return () => {
      bgSoundRef.current?.unloadAsync().catch(() => {});
      bgSoundRef.current = null;
    };
  }, []);

  const measureCoinsTarget = useCallback(() => {
    requestAnimationFrame(() => {
      const node = coinsIconRef.current ?? coinsPillRef.current;
      if (!node) return;

      // Android-safe: measure both the coin icon and the particle layer in window coords,
      // then convert icon center -> layer-local coordinates.
      const layer = coinLayerRef.current;
      if (!layer) return;

      layer.measureInWindow((lx, ly, lw, lh) => {
        if (!Number.isFinite(lx) || !Number.isFinite(ly) || !Number.isFinite(lw) || !Number.isFinite(lh)) return;
        setCoinLayerFrame({ x: lx, y: ly, w: lw, h: lh });
        node.measureInWindow((x, y, w, h) => {
          if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return;
          const cx = x + w / 2;
          const cy = y + h / 2;
          // Convert to layer-local coordinates (what the particles use).
          setCoinsTarget({ x: cx - lx, y: cy - ly });
        });
      });
    });
  }, []);

  /**
   * Fresh measure after rotation — landscape rewards were using stale layer/target from portrait.
   * Double rAF lets layout settle before measureInWindow (same coords as portrait path).
   */
  const measureCoinsGeometryForBurstAsync = useCallback((): Promise<{
    layerW: number;
    layerH: number;
    targetTx: number;
    targetTy: number;
  } | null> => {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const layer = coinLayerRef.current;
          const node = coinsIconRef.current ?? coinsPillRef.current;
          if (!layer || !node) {
            resolve(null);
            return;
          }
          layer.measureInWindow((lx, ly, lw, lh) => {
            if (!Number.isFinite(lw) || !Number.isFinite(lh)) {
              resolve(null);
              return;
            }
            node.measureInWindow((x, y, w, h) => {
              if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
                resolve(null);
                return;
              }
              const cx = x + w / 2;
              const cy = y + h / 2;
              const tx = cx - lx - 4;
              const ty = cy - ly - 4;
              resolve({ layerW: lw, layerH: lh, targetTx: tx, targetTy: ty });
            });
          });
        });
      });
    });
  }, []);

  useEffect(() => {
    if (!watchLandscapeMode) return;
    measureCoinsTarget();
  }, [watchLandscapeMode, windowHeight, windowWidth, measureCoinsTarget]);

  const playBonus = useCallback(() => {
    bonusOpacity.setValue(0);
    bonusTranslate.setValue(0);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(bonusOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(bonusTranslate, { toValue: 1, useNativeDriver: true, friction: 6 }),
      ]),
      Animated.delay(900),
      Animated.timing(bonusOpacity, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start();
  }, [bonusOpacity, bonusTranslate]);

  const playCoinBurst = useCallback(
    async (amountToAdd: number): Promise<boolean> => {
      const uid = session?.user?.id;
      if (!uid) return false;

      // Play animations immediately; saving runs after (DB must not block UX).
      const optimisticTarget = coinsDisplay + amountToAdd;

      let layerW: number;
      let layerH: number;
      let targetTx: number;
      let targetTy: number;

      if (watchLandscapeMode) {
        const geo = await measureCoinsGeometryForBurstAsync();
        if (geo) {
          layerW = geo.layerW;
          layerH = geo.layerH;
          targetTx = geo.targetTx;
          targetTy = geo.targetTy;
        } else {
          const { width, height } = Dimensions.get('window');
          layerW = coinLayerFrame?.w ?? width;
          layerH = coinLayerFrame?.h ?? height;
          const target = coinsTarget ?? { x: layerW - 54, y: 56 };
          targetTx = target.x - 4;
          targetTy = target.y - 4;
        }
      } else {
        const { width, height } = Dimensions.get('window');
        layerW = coinLayerFrame?.w ?? width;
        layerH = coinLayerFrame?.h ?? height;
        const target = coinsTarget ?? { x: layerW - 54, y: 56 };
        targetTx = target.x - 4;
        targetTy = target.y - 4;
      }

      const startX = layerW / 2;
      const startY = layerH / 2;

      for (let i = 0; i < coinParticles.length; i++) {
        coinParticles[i].x.setValue(startX);
        coinParticles[i].y.setValue(startY);
        coinParticles[i].s.setValue(0.7);
        coinParticles[i].o.setValue(0);
        coinParticles[i].r.setValue(0);
      }

      const particleAnims = coinParticles.map((p, i) => {
        const jitterX = (Math.random() - 0.5) * 220;
        const jitterY = (Math.random() - 0.5) * 220;
        const burstX = startX + jitterX;
        const burstY = startY + jitterY;
        const delay = i * 35;

        return Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(p.o, { toValue: 1, duration: 120, useNativeDriver: true }),
            Animated.timing(p.s, { toValue: 1.05, duration: 180, useNativeDriver: true }),
            Animated.timing(p.r, { toValue: 1, duration: 260, useNativeDriver: true }),
            Animated.timing(p.x, { toValue: burstX, duration: 220, useNativeDriver: true }),
            Animated.timing(p.y, { toValue: burstY, duration: 220, useNativeDriver: true }),
          ]),
          Animated.delay(1800),
          Animated.parallel([
            Animated.timing(p.s, { toValue: 0.35, duration: 520, useNativeDriver: true }),
            Animated.timing(p.x, { toValue: targetTx, duration: 520, useNativeDriver: true }),
            Animated.timing(p.y, { toValue: targetTy, duration: 520, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(p.o, { toValue: 0, duration: 140, useNativeDriver: true }),
            Animated.timing(p.s, { toValue: 0.1, duration: 140, useNativeDriver: true }),
          ]),
        ]);
      });

      const burstMs = 220;
      const lingerMs = 1800;
      const flyMs = 520;
      const staggerMs = 35;
      const firstArrivalMs = burstMs + lingerMs + flyMs;
      const lastArrivalMs = firstArrivalMs + (coinParticles.length - 1) * staggerMs;
      const countUpDuration = Math.max(520, lastArrivalMs - firstArrivalMs);
      setTimeout(() => animateCountUp(coinsDisplay, optimisticTarget, countUpDuration), firstArrivalMs);

      setTimeout(() => {
        coinsPillScale.stopAnimation();
        coinsPillScale.setValue(1);
        Animated.sequence([
          Animated.spring(coinsPillScale, { toValue: 1.12, useNativeDriver: true, friction: 6 }),
          Animated.spring(coinsPillScale, { toValue: 1, useNativeDriver: true, friction: 7 }),
        ]).start();
      }, firstArrivalMs);

      Animated.stagger(20, particleAnims).start();

      const { wallet: w, error } = await addWatchCoins(uid, amountToAdd);
      if (error || !w) {
        const detail =
          error?.includes('did not apply') || error?.includes('policy') || error?.includes('RLS')
            ? 'Your Supabase project needs RLS UPDATE policies for wallet writes (see `supabase/sql/wallets_rls.example.sql`).'
            : (error ?? 'Could not save this reward. Your balance will stay unchanged until it succeeds.');
        Alert.alert('Reward not saved', detail);
        await refresh();
        return false;
      }

      hydrateWalletFromServer(w);
      // After animation finishes: snap pill to DB balance + refetch wallet so hooks/stores match Supabase.
      const settleMs = coinBurstAnimationSettleMs();
      setTimeout(() => {
        setCoinsDisplay(Number(w.coin_balance));
        void refresh();
      }, settleMs);
      return true;
    },
    [
      animateCountUp,
      coinLayerFrame,
      coinParticles,
      coinsDisplay,
      coinsPillScale,
      coinsTarget,
      measureCoinsGeometryForBurstAsync,
      refresh,
      session?.user?.id,
      watchLandscapeMode,
    ]
  );

  playCoinBurstRef.current = playCoinBurst;

  const bonusStyle = useMemo(() => {
    const translateY = bonusTranslate.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
    return { opacity: bonusOpacity, transform: [{ translateY }] };
  }, [bonusOpacity, bonusTranslate]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null; isViewable: boolean }> }) => {
      const first = viewableItems.find((v) => v.isViewable && typeof v.index === 'number');
      if (!first || typeof first.index !== 'number') return;
      const idx = first.index;

      // Mid-rotation FlatList often reports the wrong index until scroll is re-snapped to offset = index * pageH.
      if (pinningOrientationRef.current && idx !== activeIndexRef.current) {
        return;
      }

      // Forward-only: cannot scroll back to a previous item (only "up" / next video).
      const floor = forwardFloorRef.current;
      if (!lockedNoScroll && idx < floor) {
        requestAnimationFrame(() => {
          try {
            listRef.current?.scrollToIndex({ index: floor, animated: true });
          } catch {
            listRef.current?.scrollToOffset({ offset: floor * pageH, animated: true });
          }
        });
        return;
      }
      if (!lockedNoScroll && idx >= floor) {
        forwardFloorRef.current = Math.max(floor, idx);
      }

      const item = data[idx];

      // Clamp overscroll past the gate.
      if (gateIndex === 3 && spLeftRef.current <= 0 && idx > 3) {
        requestAnimationFrame(() => listRef.current?.scrollToIndex({ index: 3, animated: true }));
        setLockedNoScroll(true);
        setActiveIndex(3);
        return;
      }

      if (item && 'kind' in item && item.kind === 'noScroll') {
        // When the gate is reached, SP must show 0.
        setSpLeft(0);
        setLockedNoScroll(true);
        setActiveIndex(idx);
        return;
      }

      if (!lockedNoScroll && gateIndex === 3 && spLeftRef.current > 0) {
        // SP consumption happens when the reward timer completes (`awardForActiveIndex`) so countdown stays 1-by-1.
        // Keep this ref in sync to prevent huge jumps if the list snaps multiple items.
        if (idx > lastVideoIndexRef.current) lastVideoIndexRef.current = idx;
      }

      setActiveIndex(idx);
    },
    [data, gateIndex, lockedNoScroll, pageH]
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const renderItem = useCallback(
    ({ item, index }: { item: WatchItem; index: number }) => {
      const isActive = index === activeIndex;
      // Preload a bit wider so the next 2 videos are already initialized.
      const shouldPreload = isFocused && Math.abs(index - activeIndex) <= 2;
      if ('kind' in item && item.kind === 'noScroll') {
        return <NoScrollGate height={pageH} />;
      }
      return (
        <View style={[styles.page, { height: pageH }]}>
          <View style={StyleSheet.absoluteFill}>
            {shouldPreload ? (
              <WebView
                ref={(r) => {
                  if (isActive) activeWebViewRef.current = r;
                }}
                source={{
                  html: vimeoHtml(
                    item.videoUri,
                    isActive ? false : true, // active with sound; keep preload silent
                    isActive // autoplay only on the active video; preloads just initialize quietly
                  ),
                }}
                style={styles.video}
                javaScriptEnabled
                domStorageEnabled
                cacheEnabled
                incognito={false as any}
                setSupportMultipleWindows={false}
                allowsFullscreenVideo={false}
                allowsPictureInPictureMediaPlayback={false}
                mediaPlaybackRequiresUserAction={false}
                allowsInlineMediaPlayback
                scrollEnabled={false}
                allowsLinkPreview={false}
                onContentProcessDidTerminate={
                  Platform.OS === 'ios'
                    ? () => {
                        if (isActive) activeWebViewRef.current?.reload();
                      }
                    : undefined
                }
                onRenderProcessGone={
                  Platform.OS === 'android'
                    ? () => {
                        if (isActive) activeWebViewRef.current?.reload();
                      }
                    : undefined
                }
                onHttpError={(ev) => {
                  if (!isActive) return;
                  const status = ev.nativeEvent.statusCode;
                  if (status >= 400) skipBadVideo(item.videoUri);
                }}
                onError={() => {
                  if (!isActive) return;
                  try {
                    activeWebViewRef.current?.reload();
                  } catch {
                    skipBadVideo(item.videoUri);
                  }
                }}
                onMessage={(ev) => {
                  if (!isActive) return;
                  try {
                    const msg = JSON.parse(ev.nativeEvent.data || '{}') as {
                      source?: string;
                      event?: string;
                      payload?: unknown;
                    };
                    if (msg.source !== 'vimeo') return;
                    if (msg.event === 'play') setActivePlaying(true);
                    if (msg.event === 'pause') setActivePlaying(false);
                    if (msg.event === 'ended') {
                      setActivePlaying(false);
                      onVideoPlaybackEnded(index);
                    }
                    // Geo-block / removed often never fires "play" or a rich "error" — stall timer handles that.
                    if (msg.event === 'stall_no_play' || msg.event === 'error') {
                      setActivePlaying(false);
                      skipBadVideo(item.videoUri);
                    }
                  } catch {
                    // ignore
                  }
                }}
              />
            ) : (
              <View style={styles.videoPlaceholder} />
            )}
          </View>

          {/* Fallback overlay if video is still loading */}
          <View pointerEvents="none" style={styles.videoShade} />

          <View
            style={[
              styles.rightActions,
              {
                bottom: bottomPad + (watchLandscapeMode ? 48 : 116),
                gap: watchLandscapeMode ? 0 : 18,
              },
            ]}>
            <Pressable
              onPress={() => void toggleWatchLandscape()}
              accessibilityLabel={watchLandscapeMode ? 'Exit landscape, portrait mode' : 'Landscape mode for video'}
              style={({ pressed }) => [styles.roundAction, pressed && { transform: [{ scale: 0.92 }] }]}>
              <Ionicons
                name={watchLandscapeMode ? 'phone-portrait-outline' : 'phone-landscape-outline'}
                size={22}
                color="#fff"
              />
            </Pressable>
            {!watchLandscapeMode ? (
              <Pressable
                onPress={() => void onWatchPressRefresh()}
                accessibilityLabel="Refresh feed"
                disabled={refreshing}
                style={({ pressed }) => [
                  styles.roundAction,
                  pressed && !refreshing && { transform: [{ scale: 0.92 }] },
                  refreshing && { opacity: 0.55 },
                ]}>
                <Ionicons name="refresh" size={22} color="#fff" />
              </Pressable>
            ) : null}
            {!watchLandscapeMode ? (
              <View style={{ alignItems: 'center', gap: 6 }}>
                <Pressable
                  onPress={() => setLiked((v) => !v)}
                  style={({ pressed }) => [styles.roundAction, pressed && { transform: [{ scale: 0.92 }] }]}>
                  <Ionicons name="heart" size={22} color={liked ? vibeColors.primary : '#fff'} />
                </Pressable>
                <Text style={styles.likeCount}>{item.likeCount}</Text>
              </View>
            ) : null}
          </View>

          {!watchLandscapeMode ? (
            <View pointerEvents="none" style={[styles.caption, { bottom: bottomPad + 116 }]}>
              <View style={styles.handleRow}>
                <Text style={styles.handle}>{item.handle}</Text>
                <Ionicons name="checkmark-circle" size={14} color="#60a5fa" />
              </View>
              <Text style={styles.desc}>{item.desc}</Text>
              <View style={styles.captionPillsRow}>
                <View style={styles.audioPill}>
                  <Ionicons name="musical-notes" size={12} color={vibeColors.secondary} />
                  <Text style={styles.audioText} numberOfLines={1}>
                    {item.audio}
                  </Text>
                </View>
                <View style={styles.audioPill} accessible accessibilityLabel="Sponsored video">
                  <Ionicons name="megaphone-outline" size={12} color={vibeColors.secondary} />
                  <Text style={styles.audioText} numberOfLines={1}>
                    Sponsored video
                  </Text>
                </View>
                <View style={styles.audioPill} accessible accessibilityLabel="Watch and earn rewards">
                  <Ionicons name="gift-outline" size={12} color={vibeColors.secondary} />
                  <Text style={styles.audioText} numberOfLines={1}>
                    Watch and earn rewards
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

        </View>
      );
    },
    [
      pageH,
      activeIndex,
      bottomPad,
      liked,
      topPad,
      onVideoPlaybackEnded,
      onWatchPressRefresh,
      refreshing,
      toggleWatchLandscape,
      watchLandscapeMode,
    ]
  );

  if (!session) {
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.authGate, { paddingTop: topPad + 48, paddingHorizontal: 28 }]}>
            <Text style={styles.authTitle}>Sign in to watch & earn</Text>
            <Text style={styles.authSub}>Coins and scroll points save to your Vidpay wallet.</Text>
            <Pressable onPress={() => router.push('/login')} style={({ pressed }) => [styles.authBtn, pressed && { opacity: 0.92 }]}>
              <Text style={styles.authBtnText}>Sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
        <VibeBottomNav />
      </View>
    );
  }

  if (accountLoading) {
    return (
      <View style={styles.root}>
        <SkeletonLoadingPage />
        <VibeBottomNav />
      </View>
    );
  }

  /** No SP: show gate immediately (after skeleton). Do not load or play the video feed. */
  if (!hasScrollPoints) {
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <NoScrollGate height={pageH} />
        </ScrollView>

        <View style={[styles.topRow, { top: topPad + 12 }]} pointerEvents="box-none">
          <View style={styles.pill}>
            <ScrollIcon width={18} height={18} />
            <Text style={styles.pillText}>
              {spLeft} <Text style={styles.pillUnit}>SP</Text>
            </Text>
          </View>
          <Animated.View style={[styles.pill, { transform: [{ scale: coinsPillScale }] }]}>
            <View collapsable={false} style={styles.coinIconWrap}>
              <GoldCoin width={18} height={18} />
            </View>
            <Text style={styles.pillText}>
              {coinsDisplay.toLocaleString()} <Text style={styles.pillUnit}>COINS</Text>
            </Text>
          </Animated.View>
        </View>

        <VibeBottomNav />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={{ flex: 1 }}>
        <FlatList
          ref={(r) => {
            listRef.current = r;
          }}
          style={{ flex: 1, backgroundColor: '#000' }}
          onLayout={onListLayout}
          data={data}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          snapToInterval={pageH}
          snapToAlignment="start"
          scrollEnabled
          alwaysBounceVertical
          onScroll={handleWatchListScroll}
          scrollEventThrottle={16}
          {...(Platform.OS === 'android' ? { overScrollMode: 'auto' as const } : {})}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        // Render a slightly larger window so the next/prev WebViews can preload.
        initialNumToRender={4}
        maxToRenderPerBatch={5}
        windowSize={7}
        updateCellsBatchingPeriod={30}
        removeClippedSubviews={false}
        onViewableItemsChanged={onViewableItemsChanged as any}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({ length: pageH, offset: pageH * index, index })}
        onEndReachedThreshold={2}
        onEndReached={() => {
          fetchMore();
        }}
        onMomentumScrollEnd={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          const idxSnap = activeIndexRef.current;
          const lockedY = idxSnap * pageH;
          if (!feedScrollEnabled) {
            const pullDownPastLocked = lockedY - y;
            const scrolledTowardNext = y - lockedY;
            if (pullDownPastLocked > 6 || scrolledTowardNext > 8) {
              try {
                listRef.current?.scrollToOffset({ offset: lockedY, animated: true });
              } catch {
                // ignore
              }
            }
            return;
          }
          const idx = Math.round(y / pageH);
          const floor = forwardFloorRef.current;
          if (idx < floor) {
            try {
              listRef.current?.scrollToIndex({ index: floor, animated: true });
            } catch {
              listRef.current?.scrollToOffset({ offset: floor * pageH, animated: true });
            }
          }
        }}
        onScrollEndDrag={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          const idxSnap = activeIndexRef.current;
          const lockedY = idxSnap * pageH;
          if (!feedScrollEnabled) {
            const pullDownPastLocked = lockedY - y;
            const scrolledTowardNext = y - lockedY;
            if (pullDownPastLocked > 6 || scrolledTowardNext > 8) {
              listRef.current?.scrollToOffset({ offset: lockedY, animated: false });
            }
            return;
          }
          const minY = forwardFloorRef.current * pageH;
          if (minY - y > 6) {
            listRef.current?.scrollToOffset({ offset: minY, animated: false });
          }
        }}
        ListEmptyComponent={
          <View style={[styles.page, { height: pageH, alignItems: 'center', justifyContent: 'center' }]}>
            {feedError && emptyFeedErrorReady ? (
              <View style={{ alignItems: 'center', paddingHorizontal: 22, gap: 12 }}>
                <Text style={{ color: '#fff', fontWeight: '900', textAlign: 'center' }}>Couldn’t load videos</Text>
                <Text style={{ color: 'rgba(229,231,235,0.88)', fontWeight: '700', textAlign: 'center', lineHeight: 18 }}>
                  {feedError}
                </Text>
                <Pressable
                  onPress={() => {
                    uniqueIdRef.current = 0;
                    setFeed([]);
                    setFeedError(null);
                    void fetchMore();
                  }}
                  style={({ pressed }) => [
                    {
                      marginTop: 6,
                      paddingHorizontal: 18,
                      paddingVertical: 12,
                      borderRadius: 999,
                      backgroundColor: vibeColors.primary,
                      opacity: pressed ? 0.92 : 1,
                    },
                  ]}>
                  <Text style={{ color: '#fff', fontWeight: '900', letterSpacing: 1.2 }}>RETRY</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ alignItems: 'center', gap: 14, paddingHorizontal: 24 }}>
                <ActivityIndicator size="large" color={vibeColors.primary} />
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Connecting…</Text>
                <Text style={{ color: 'rgba(229,231,235,0.72)', fontWeight: '600', fontSize: 13, textAlign: 'center' }}>
                  Loading your feed
                </Text>
              </View>
            )}
          </View>
        }
        />

      {/* Fixed HUD (so coin target is stable) */}
      <View
        style={[styles.topRow, { top: watchLandscapeMode ? Math.max(insets.top, 8) + 8 : topPad + 12 }]}
        pointerEvents="box-none">
        <View
          style={styles.spPillWrap}
          onLayout={(e) => {
            const { width: w, height: h } = e.nativeEvent.layout;
            if (!w || !h) return;
            setSpPillLayout({ w, h });
          }}>
          <View style={styles.pill}>
            <ScrollIcon width={18} height={18} />
            <Text style={styles.pillText}>
              {spLeft} <Text style={styles.pillUnit}>SP</Text>
            </Text>
          </View>

          {/* Animated countdown "ring" around the pill (30s). */}
          {spRing ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="spGrad" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={vibeColors.secondary} stopOpacity="1" />
                    <Stop offset="1" stopColor={vibeColors.primary} stopOpacity="1" />
                  </LinearGradient>
                </Defs>

                {/* faint track */}
                <Path d={spRing.d} fill="transparent" stroke="rgba(255,255,255,0.10)" strokeWidth={3} />

                {/* animated progress (pill-shaped, on top of pill) */}
                <AnimatedPath
                  d={spRing.d}
                  fill="transparent"
                  stroke="url(#spGrad)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={spRing.dasharray as any}
                  strokeDashoffset={spRing.dashoffset as any}
                  opacity={spLeft > 0 ? 1 : 0}
                />
              </Svg>
            </View>
          ) : null}
        </View>
        <Animated.View
          ref={(r) => {
            coinsPillRef.current = r as unknown as View;
          }}
          onLayout={measureCoinsTarget}
          style={[styles.pill, { transform: [{ scale: coinsPillScale }] }]}>
          <View
            ref={(r) => {
              coinsIconRef.current = r;
            }}
            onLayout={measureCoinsTarget}
            collapsable={false}
            style={styles.coinIconWrap}>
            <GoldCoin width={18} height={18} />
          </View>
          <Text style={styles.pillText}>
            {coinsDisplay.toLocaleString()} <Text style={styles.pillUnit}>COINS</Text>
          </Text>
        </Animated.View>
      </View>

      <View style={styles.bonusOverlay} pointerEvents="none">
        <Animated.View style={[styles.bonusWrap, bonusStyle]}>
          <View style={styles.bonusPill}>
            <GoldCoin width={20} height={20} />
            <Text style={styles.bonusText}>+{rewardCoins} Coins</Text>
          </View>
        </Animated.View>
      </View>

      {/* Coin burst particles */}
      <View
        ref={(r) => {
          coinLayerRef.current = r;
        }}
        pointerEvents="none"
        style={styles.coinLayer}>
        {coinParticles.map((p, idx) => {
          const rotate = p.r.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
          return (
            <Animated.View
              key={idx}
              style={[
                styles.coinParticle,
                {
                  opacity: p.o,
                  transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.s }, { rotate }],
                },
              ]}>
              <GoldCoin width={20} height={20} />
            </Animated.View>
          );
        })}
      </View>

      <SwipeUpOnboardingHint
        visible={swipeHintVisible && isFocused && hasScrollPoints && !lockedNoScroll}
        bottomOffset={bottomPad + 96}
        sizeScale={Math.min(1.18, Math.max(0.85, windowWidth / 390))}
        glideMs={860}
        pauseMs={680}
      />

      {!watchLandscapeMode ? <VibeBottomNav /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  authGate: { flex: 1, justifyContent: 'center', gap: 14 },
  authTitle: { color: '#fff', fontWeight: '900', fontSize: 24, letterSpacing: -0.4, textAlign: 'center' },
  authSub: {
    color: vibeColors.muted,
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  authBtn: {
    marginTop: 8,
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: vibeColors.secondary,
  },
  authBtnText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 1.2 },
  page: { width: '100%', backgroundColor: '#000' },
  video: { width: '100%', height: '100%', backgroundColor: '#000' },
  videoPlaceholder: { width: '100%', height: '100%', backgroundColor: '#000' },
  videoShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.10)' },
  topRow: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  pill: {
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  spPillWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  coinIconWrap: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  pillUnit: { color: vibeColors.muted, fontSize: 10, fontWeight: '700' },
  rightActions: {
    position: 'absolute',
    right: 16,
    bottom: 140,
    zIndex: 10,
    alignItems: 'center',
    gap: 18,
  },
  roundAction: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeCount: { color: '#fff', fontSize: 10, fontWeight: '900' },
  caption: {
    position: 'absolute',
    left: 16,
    bottom: 140,
    maxWidth: '70%',
    zIndex: 10,
  },
  handleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  handle: { color: '#fff', fontWeight: '900', fontSize: 16 },
  desc: { color: 'rgba(229,231,235,0.95)', fontWeight: '600', fontSize: 12, lineHeight: 16, marginBottom: 10 },
  captionPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  audioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.30)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  audioText: { color: '#fff', fontSize: 10, fontWeight: '600', maxWidth: 220 },
  bonusOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bonusWrap: {
    position: 'absolute',
    bottom: '20%',
  },
  bonusPill: {
    backgroundColor: 'rgba(254,44,85,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(254,44,85,0.40)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bonusText: { color: '#fff', fontWeight: '900', fontSize: 18 },

  coinLayer: { ...StyleSheet.absoluteFillObject, zIndex: 999 },
  coinParticle: {
    position: 'absolute',
    left: -10,
    top: -10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(250,204,21,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },

});

function NoScrollGate({ height }: { height: number }) {
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 520, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 520, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bounce]);

  const ty = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });

  return (
    <View style={[gateStyles.root, { height }]}>
      <View pointerEvents="none" style={gateStyles.blob1} />
      <View pointerEvents="none" style={gateStyles.blob2} />

      <View style={gateStyles.center}>
        <View style={gateStyles.iconStage}>
          <View style={gateStyles.iconCard}>
            <Ionicons name="film" size={48} color="rgba(254,44,85,0.40)" />
          </View>
          <Animated.View style={[gateStyles.bubble, { transform: [{ translateY: ty }] }]}>
            <Ionicons name="close-circle" size={24} color="#000" />
          </Animated.View>
        </View>

        <Text style={gateStyles.title}>Out of Scroll Points!</Text>
        <Text style={gateStyles.sub}>
          Each video consumes 1 SP. Purchase a scroll package to keep earning coins and watching premium content.
        </Text>

        <View style={gateStyles.btnCol}>
          <Pressable
            onPress={() => router.replace('/(tabs)/shop')}
            style={({ pressed }) => [gateStyles.primaryBtn, pressed && { transform: [{ scale: 0.98 }] }]}>
            <Ionicons name="storefront" size={18} color="#fff" />
            <Text style={gateStyles.primaryText}>GET SCROLL POINTS</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace('/(tabs)/wallet')}
            style={({ pressed }) => [gateStyles.secondaryBtn, pressed && { transform: [{ scale: 0.98 }] }]}>
            <Text style={gateStyles.secondaryText}>BACK TO WALLET</Text>
          </Pressable>
        </View>

        <View style={gateStyles.bonusPill}>
          <Ionicons name="gift" size={16} color={vibeColors.secondary} />
          <Text style={gateStyles.bonusText}>Top up scroll points in the shop</Text>
        </View>
      </View>
    </View>
  );
}

const gateStyles = StyleSheet.create({
  root: { width: '100%', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, overflow: 'hidden' },
  blob1: { position: 'absolute', top: '20%', left: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(254,44,85,0.20)' },
  blob2: { position: 'absolute', bottom: '20%', right: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(29,161,242,0.20)' },
  center: { alignItems: 'center', width: '100%', maxWidth: 420 },
  iconStage: { marginBottom: 26, position: 'relative' },
  iconCard: {
    width: 112,
    height: 112,
    borderRadius: 40,
    backgroundColor: 'rgba(18,18,18,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '12deg' }],
  },
  bubble: {
    position: 'absolute',
    top: -14,
    right: -14,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    borderWidth: 8,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#fff', fontWeight: '900', fontSize: 28, letterSpacing: -0.4, textAlign: 'center', marginBottom: 10 },
  sub: { color: vibeColors.muted, fontWeight: '600', fontSize: 13, lineHeight: 18, textAlign: 'center', marginBottom: 22 },
  btnCol: { width: '100%', gap: 12, marginBottom: 14 },
  primaryBtn: {
    width: '100%',
    height: 62,
    borderRadius: 999,
    backgroundColor: vibeColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
    shadowColor: vibeColors.primary,
    shadowOpacity: 0.40,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  primaryText: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' },
  secondaryBtn: {
    width: '100%',
    height: 62,
    borderRadius: 999,
    backgroundColor: 'rgba(18,18,18,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  secondaryText: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' },
  bonusPill: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 54,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(29,161,242,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(29,161,242,0.20)',
  },
  bonusText: { color: vibeColors.secondary, fontWeight: '900', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
});

