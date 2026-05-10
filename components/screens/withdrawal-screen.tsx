import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useVibeDropAlert } from '@/components/vibepay/drop-alert';
import { hiddenRefreshControl, PullRefreshSkeletonOverlay } from '@/components/vibepay/pull-refresh';
import { VibeScreen, vibeColors } from '@/components/vibepay/vibe-screen';
import { useAccountData } from '@/hooks/use-account-data';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import {
  DEFAULT_APP_SETTINGS,
  type AppPlatformSettings,
  fetchAppSettings,
} from '@/lib/app-settings';
import { verifyNgBankAccount } from '@/lib/bank-verify';
import { NG_BANKS, type NgBank } from '@/lib/ng-banks';
import { convertCoinsToUsd, executeWithdrawalUsd } from '@/lib/wallet-remote';
import {
  getWalletUsd,
  hydrateWalletFromServer,
  resetWalletStore,
  useCoinBalance,
  useGasFeeBalance,
  useWalletUsd,
} from '@/lib/wallet-store';
import GoldCoin from '@/assets/vibepay/icons/50cent.svg';

function fmtCoins(n: number) {
  return Number.isFinite(n)
    ? n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : '0';
}

export default function WithdrawalScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 16);
  const bottomPad = Math.max(insets.bottom, 16);
  const { show: showDrop, Banner: DropBanner } = useVibeDropAlert();
  const { wallet, refresh, session, loading, error } = useAccountData();
  const coins = useCoinBalance();
  const walletUsd = useWalletUsd();
  const gasFeeStore = useGasFeeBalance();
  const { refreshing, onRefresh } = usePullToRefresh(refresh);

  const [appSettings, setAppSettings] = useState<AppPlatformSettings>(DEFAULT_APP_SETTINGS);

  const coinsPerUsd = appSettings.coins_per_usd;
  const minWithdrawCoins = appSettings.min_withdraw_coins;
  const gasFeeAdmin = appSettings.gas_fee;
  const minConvertCoins = appSettings.min_convert_coins;
  const maxConvertCoins = appSettings.max_convert_coins;

  const coinsMaxStr = useMemo(() => {
    const n = Math.floor(coins);
    if (!Number.isFinite(n) || n <= 0) return '0';
    return String(n);
  }, [coins]);

  const [method, setMethod] = useState<'bank' | 'usdt'>('bank');
  /** User-chosen rail; initial guess from global store so balances match Wallet tab before fetch resolves. */
  const [withdrawSource, setWithdrawSource] = useState<'coins' | 'usd'>(() =>
    getWalletUsd() > 0.001 ? 'usd' : 'coins'
  );
  const [amount, setAmount] = useState('');
  const [bank, setBank] = useState<NgBank>(() => NG_BANKS[0] ?? { code: '000014', name: 'Access Bank', search: 'access bank 000014' });
  const [acct, setAcct] = useState('');
  const acctDigits = useMemo(() => acct.replace(/\D/g, ''), [acct]);

  type UsdtNetwork = 'TRC20' | 'ERC20' | 'BEP20';
  const USDT_NETWORKS: UsdtNetwork[] = ['TRC20', 'ERC20', 'BEP20'];
  const [usdtNetwork, setUsdtNetwork] = useState<UsdtNetwork>('TRC20');
  const [walletAddress, setWalletAddress] = useState('');

  const [convertOpen, setConvertOpen] = useState(false);
  const [convertVisible, setConvertVisible] = useState(false);
  const sheetT = useRef(new Animated.Value(0)).current; // 0 closed, 1 open

  // Picker sheets (same slide-up feel as Convert sheet)
  const windowH = Dimensions.get('window').height;
  const MID_SHEET_H = Math.min(420, Math.round(windowH * 0.52));
  // Expanded stops under the header (Withdrawal title area)
  const EXPANDED_SHEET_H = Math.max(MID_SHEET_H, windowH - (topPad + 96));

  const [netSheetVisible, setNetSheetVisible] = useState(false);
  const netOpenT = useRef(new Animated.Value(0)).current; // 0 closed, 1 open

  const [bankSheetVisible, setBankSheetVisible] = useState(false);
  const bankOpenT = useRef(new Animated.Value(0)).current; // 0 closed, 1 open
  const bankPosT = useRef(new Animated.Value(0)).current; // 0 mid, 1 expanded
  const [bankSearch, setBankSearch] = useState('');

  const scrollRef = useRef<ScrollView | null>(null);
  const scrollYRef = useRef(0);
  const keyboardHeightRef = useRef(0);
  const focusedInputWrapRef = useRef<View | null>(null);
  const amountSectionRef = useRef<View>(null);
  const acctSectionRef = useRef<View>(null);
  const usdtAddressSectionRef = useRef<View>(null);

  const [keyboardInset, setKeyboardInset] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void fetchAppSettings().then(setAppSettings);
    }, [refresh])
  );

  // After server wallet arrives or refreshes: USD rail when user has USD ready, otherwise coins.
  useEffect(() => {
    if (!wallet) return;
    const usd = Number(wallet.usd_ready);
    if (usd > 0.001) setWithdrawSource('usd');
    else setWithdrawSource('coins');
  }, [wallet]);

  const setWithdrawSourceMode = useCallback((mode: 'coins' | 'usd') => {
    setWithdrawSource(mode);
    setAmount('');
  }, []);

  useEffect(() => {
    if (wallet) {
      hydrateWalletFromServer(wallet);
      return;
    }
    // Never reset while auth/session is still resolving — first paint has session=null and would wipe the
    // global store (Wallet tab briefly showed zeros when opening Withdrawal).
    if (!loading && !session?.user?.id) {
      resetWalletStore();
    }
  }, [wallet, loading, session?.user?.id]);

  const scrollFieldAboveKeyboard = useCallback((wrap: View | null) => {
    if (!wrap || !scrollRef.current) return;
    const kb = keyboardHeightRef.current;
    const schedule =
      kb > 0
        ? (fn: () => void) => fn()
        : (fn: () => void) => {
            requestAnimationFrame(() => setTimeout(fn, Platform.OS === 'android' ? 120 : 32));
          };

    schedule(() => {
      wrap.measureInWindow((x, y, w, h) => {
        const winH = Dimensions.get('window').height;
        const measuredKb = keyboardHeightRef.current;
        const kbH = measuredKb > 0 ? measuredKb : Math.round(winH * 0.38);
        const gapAboveKeyboard = 20;
        const visibleBottom = winH - kbH - gapAboveKeyboard;
        const inputBottom = y + h;
        if (inputBottom <= visibleBottom) return;

        const dy = inputBottom - visibleBottom + 12;
        scrollRef.current?.scrollTo({
          y: scrollYRef.current + dy,
          animated: true,
        });
      });
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const subShow = Keyboard.addListener(showEvent, (e) => {
      const h = e.endCoordinates?.height ?? 0;
      keyboardHeightRef.current = h;
      setKeyboardInset(h);
      requestAnimationFrame(() => {
        const node = focusedInputWrapRef.current;
        if (node) scrollFieldAboveKeyboard(node);
      });
    });
    const subHide = Keyboard.addListener(hideEvent, () => {
      keyboardHeightRef.current = 0;
      setKeyboardInset(0);
    });

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [scrollFieldAboveKeyboard]);

  const [fromCoins, setFromCoins] = useState('10000');
  const [convertPreset, setConvertPreset] = useState<'min' | 'max' | null>(null);

  const toUsd = useMemo(() => {
    const n = Number(fromCoins || 0);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n / coinsPerUsd;
  }, [coinsPerUsd, fromCoins]);

  useEffect(() => {
    if (convertOpen) setConvertVisible(true);
    // Pull latest admin settings when opening the convert sheet so rate/limits reflect immediately.
    if (convertOpen) {
      void fetchAppSettings().then(setAppSettings);
    }

    Animated.timing(sheetT, {
      toValue: convertOpen ? 1 : 0,
      duration: convertOpen ? 320 : 240,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      if (!convertOpen) setConvertVisible(false);
    });
  }, [convertOpen, sheetT]);

  const closeConvert = useCallback(() => setConvertOpen(false), []);

  const addressCheck = useMemo(() => {
    const s = walletAddress.trim();
    if (!s) {
      return { kind: 'empty' as const };
    }
    const isEvm = /^0x[a-fA-F0-9]{40}$/.test(s);
    const isTron = /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(s);

    if (isEvm) {
      if (usdtNetwork === 'TRC20') {
        return {
          kind: 'mismatch' as const,
          detected: 'evm' as const,
          message:
            'This is an EVM address (0x…). It is not valid for TRC20. Switch to ERC20 or BEP20, or use a Tron address that starts with T.',
        };
      }
      return {
        kind: 'ok' as const,
        detected: 'evm' as const,
        message:
          usdtNetwork === 'ERC20'
            ? 'Format matches ERC20 (Ethereum).'
            : 'Format matches BEP20 (BNB Smart Chain). EVM addresses look the same on different chains—confirm your wallet is on the network you selected.',
      };
    }
    if (isTron) {
      if (usdtNetwork !== 'TRC20') {
        return {
          kind: 'mismatch' as const,
          detected: 'tron' as const,
          message:
            'This is a Tron (T…) address. It is not valid for ERC20/BEP20. Switch network to TRC20, or paste a 0x… EVM address.',
        };
      }
      return { kind: 'ok' as const, detected: 'tron' as const, message: 'Format matches TRC20 (Tron).' };
    }
    if (/^0x/i.test(s)) {
      if (s.length < 42) {
        return {
          kind: 'typing' as const,
          hint: 'EVM address must be 0x + 40 hex characters.',
        };
      }
      return {
        kind: 'invalid' as const,
        message: 'This 0x address is not 40 hex characters. Check for typos or extra spaces.',
      };
    }
    if (s.startsWith('T')) {
      if (s.length < 34) {
        return { kind: 'typing' as const, hint: 'Tron address is usually 34 characters starting with T.' };
      }
      return {
        kind: 'invalid' as const,
        message:
          'This does not look like a valid Tron address. Double-check characters (no spaces) and paste again.',
      };
    }
    if (!/^0x/i.test(s) && !/^T/.test(s) && s.length >= 8) {
      return {
        kind: 'invalid' as const,
        message:
          'USDT withdrawals here use Tron (T…) or EVM (0x…). This does not match either format—wrong address can mean total loss.',
      };
    }
    return { kind: 'invalid' as const, message: 'Enter a T… (Tron) or 0x… (EVM) USDT address.' };
  }, [walletAddress, usdtNetwork]);

  const cryptoFormReady = addressCheck.kind === 'ok';

  /** True when the user selected "USD Ready" (amount field is in USD). */
  const withdrawFromUsd = withdrawSource === 'usd';

  const amountNum = useMemo(() => {
    const n = Number(String(amount).replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [amount]);

  /** Placeholder: `1000 - 5,000,000.00` — plain min, hyphen, max with grouping + cents. */
  const amountPlaceholder = useMemo(() => {
    const minW = Math.round(minWithdrawCoins);
    const maxW = Math.round(maxConvertCoins);
    const sep = ' - ';
    const maxCoinsStr = maxW.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (withdrawFromUsd) {
      const minUsd = minW / coinsPerUsd;
      const maxUsd = maxW / coinsPerUsd;
      const maxUsdStr = maxUsd.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `${minUsd.toFixed(2)} - ${maxUsdStr}`;
    }
    return `${minW} - ${maxCoinsStr}`;
  }, [coinsPerUsd, maxConvertCoins, minWithdrawCoins, withdrawFromUsd]);

  const [acctVerify, setAcctVerify] = useState<'idle' | 'verifying' | 'verified' | 'error'>('idle');
  const [acctHolderName, setAcctHolderName] = useState('');
  const [acctVerifyError, setAcctVerifyError] = useState<string | null>(null);

  const onWithdrawAmountChange = useCallback(
    (t: string) => {
      if (withdrawFromUsd) {
        let s = t.replace(/[^0-9.]/g, '');
        const dot = s.indexOf('.');
        if (dot !== -1) {
          s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '').slice(0, 2);
        }
        setAmount(s);
      } else {
        setAmount(t.replace(/\D/g, ''));
      }
    },
    [withdrawFromUsd]
  );

  /** When focus leaves the amount field, cap at full coin balance (coins) or USD ready balance — never force upward. */
  const onAmountBlur = useCallback(() => {
    setAmount((prev) => {
      const parsed = Number(String(prev).replace(/,/g, ''));
      if (!Number.isFinite(parsed) || parsed <= 0) return prev;
      if (withdrawFromUsd) {
        const max = walletUsd;
        if (parsed > max + 1e-9) return max > 0 ? max.toFixed(2) : '';
        return prev;
      }
      const maxCoins = Math.floor(coins);
      if (parsed > maxCoins) return maxCoins > 0 ? String(maxCoins) : '';
      return prev;
    });
  }, [coins, withdrawFromUsd, walletUsd]);

  useLayoutEffect(() => {
    if (acctDigits.length !== 10) {
      setAcctVerify('idle');
      setAcctHolderName('');
      setAcctVerifyError(null);
      return;
    }
    setAcctVerify('verifying');
    setAcctHolderName('');
    setAcctVerifyError(null);
    const t = setTimeout(() => {
      void verifyNgBankAccount({ bank_code: bank.code, acc_no: acctDigits }).then((r) => {
        if (r.ok) {
          setAcctVerify('verified');
          setAcctHolderName(r.account_name);
          setAcctVerifyError(null);
        } else {
          setAcctVerify('error');
          setAcctHolderName('');
          setAcctVerifyError(r.error || 'Account name not found.');
        }
      });
    }, 450);
    return () => clearTimeout(t);
  }, [acctDigits, bank.code]);

  const bankPayoutReady =
    acctDigits.length === 10 && acctVerify === 'verified' && !!acctHolderName.trim();

  /** Confirm stays enabled when payout fields + positive amount are filled; min coins / gas alerts run on press. */
  const bankWithdrawReady = bankPayoutReady && amountNum > 0;

  const cryptoWithdrawReady = cryptoFormReady && amountNum > 0;

  const usdAmount = useMemo(() => {
    if (withdrawFromUsd) return amountNum;
    return amountNum / coinsPerUsd;
  }, [amountNum, coinsPerUsd, withdrawFromUsd]);

  const payoutNgn = useMemo(() => {
    const rate = Number(appSettings.ngn_per_usd ?? 1500);
    // Gas is deducted from `gas_fee_balance`, not from the withdrawal amount.
    return Math.max(0, usdAmount) * rate;
  }, [appSettings.ngn_per_usd, usdAmount]);

  const cryptoNetUsdt = useMemo(() => {
    // Gas is deducted from `gas_fee_balance`, not from the withdrawal amount.
    return Math.max(0, usdAmount);
  }, [usdAmount]);

  // Use store fallback to avoid false "insufficient gas fee" while wallet is still loading.
  // IMPORTANT: don't let a transient `0` from a stale wallet snapshot override the store (Profile hydrates the store too).
  // Also support legacy column name (`gas_fee`) if a caller still returns it.
  const gasBal = Math.max(
    0,
    Number((wallet as any)?.gas_fee_balance ?? (wallet as any)?.gas_fee ?? 0),
    Number(gasFeeStore ?? 0)
  );
  const hasGasFee = gasBal + 1e-9 >= gasFeeAdmin;

  useEffect(() => {
    if (!__DEV__) return;
    // eslint-disable-next-line no-console
    console.log('[withdrawal] gas check', {
      gasBal,
      gasFeeAdmin,
      walletGasFeeBalance: (wallet as any)?.gas_fee_balance,
      walletGasFeeLegacy: (wallet as any)?.gas_fee,
      gasFeeStore,
    });
  }, [gasBal, gasFeeAdmin, gasFeeStore, wallet]);

  const filteredBanks = useMemo(() => {
    const q = bankSearch.trim().toLowerCase();
    if (!q) return NG_BANKS;
    return NG_BANKS.filter((b) => b.search.includes(q));
  }, [bankSearch]);

  const openNetSheet = useCallback(() => {
    setNetSheetVisible(true);
    netOpenT.setValue(0);
    Animated.spring(netOpenT, { toValue: 1, useNativeDriver: true, damping: 28, stiffness: 260 }).start();
  }, [netOpenT]);

  const closeNetSheet = useCallback(() => {
    Animated.timing(netOpenT, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      setNetSheetVisible(false);
    });
  }, [netOpenT]);

  const openBankSheet = useCallback(() => {
    setBankSheetVisible(true);
    setBankSearch('');
    bankOpenT.setValue(0);
    bankPosT.setValue(0);
    Animated.spring(bankOpenT, { toValue: 1, useNativeDriver: true, damping: 28, stiffness: 260 }).start();
  }, [bankPosT, bankOpenT]);

  const expandBankSheet = useCallback(() => {
    Animated.spring(bankPosT, { toValue: 1, useNativeDriver: true, damping: 28, stiffness: 260 }).start();
  }, [bankPosT]);

  const collapseBankSheet = useCallback(() => {
    Animated.spring(bankPosT, { toValue: 0, useNativeDriver: true, damping: 28, stiffness: 260 }).start();
  }, [bankPosT]);

  const closeBankSheet = useCallback(() => {
    Animated.timing(bankOpenT, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      setBankSheetVisible(false);
    });
  }, [bankOpenT]);

  const bankPan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
        onPanResponderRelease: (_, g) => {
          if (g.dy < -40) {
            expandBankSheet();
            return;
          }
          if (g.dy > 70) {
            // If expanded, collapse to mid. Otherwise close.
            bankPosT.stopAnimation((v) => {
              if ((v as number) > 0.5) collapseBankSheet();
              else closeBankSheet();
            });
          }
        },
      }),
    [bankPosT, closeBankSheet, collapseBankSheet, expandBankSheet]
  );

  const netPan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
        onPanResponderRelease: (_, g) => {
          if (g.dy > 60) closeNetSheet();
        },
      }),
    [closeNetSheet]
  );

  const applyMinConvertPreset = useCallback(() => {
    const bal = Math.floor(coins);
    const minC = Math.round(minConvertCoins);
    const maxC = Math.round(maxConvertCoins);
    if (bal <= 0) {
      setFromCoins('0');
      setConvertPreset('min');
      return;
    }
    const target = bal < minC ? bal : Math.min(bal, maxC, minC);
    setFromCoins(String(Math.max(0, target)));
    setConvertPreset('min');
  }, [coins, maxConvertCoins, minConvertCoins]);

  const applyMaxConvertPreset = useCallback(() => {
    const bal = Math.floor(coins);
    const maxC = Math.round(maxConvertCoins);
    setFromCoins(String(Math.min(bal, maxC)));
    setConvertPreset('max');
  }, [coins, maxConvertCoins]);

  useEffect(() => {
    if (!convertOpen) return;
    setConvertPreset(null);
    applyMaxConvertPreset();
  }, [convertOpen, applyMaxConvertPreset]);

  const handleConvertNow = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) {
      showDrop('Please sign in.', 'warning');
      return;
    }
    // Conversion (coins → USD) is only enabled after user funds gas-fee balance.
    if (!hasGasFee) {
      showDrop('Insufficient gas fee balance. Fund your gas fee balance to enable conversion.', 'warning');
      return;
    }
    if (!convertPreset) {
      showDrop('Select Min Convert or Max Convert.', 'warning');
      return;
    }
    const coinsAmt = Math.round(Number(fromCoins) || 0);
    const { wallet: w, error } = await convertCoinsToUsd(uid, coinsAmt, coinsPerUsd, minConvertCoins, maxConvertCoins);
    if (error) {
      showDrop(error, 'warning');
      return;
    }
    if (w) hydrateWalletFromServer(w);
    await refresh();
    closeConvert();
    setWithdrawSource('usd');
    showDrop('Converted to USD', 'success');
  }, [
    session?.user?.id,
    hasGasFee,
    fromCoins,
    coinsPerUsd,
    minConvertCoins,
    maxConvertCoins,
    refresh,
    closeConvert,
    showDrop,
  ]);

  const handleConfirmWithdraw = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) {
      showDrop('Please sign in.', 'warning');
      return;
    }

    let parsedAmt = Number(String(amount).replace(/,/g, ''));
    if (!Number.isFinite(parsedAmt)) parsedAmt = 0;

    if (withdrawFromUsd) {
      const maxUsd = walletUsd;
      if (parsedAmt > maxUsd + 1e-9) {
        parsedAmt = maxUsd;
        setAmount(maxUsd > 0 ? maxUsd.toFixed(2) : '');
      }
    } else {
      const maxC = Math.floor(coins);
      if (parsedAmt > maxC) {
        parsedAmt = maxC;
        setAmount(maxC > 0 ? String(maxC) : '');
      }
    }

    if (parsedAmt <= 0) return;

    const payoutFormOk = method === 'bank' ? bankPayoutReady : cryptoFormReady;
    if (!payoutFormOk) return;

    if (coins < minWithdrawCoins) {
      showDrop(`Minimum ${Math.round(minWithdrawCoins)} coins required`, 'warning');
      return;
    }
    if (!withdrawFromUsd) {
      showDrop('You cannot withdraw coins. Please convert to USD', 'warning');
      return;
    }

    const wdUsd = withdrawFromUsd ? parsedAmt : parsedAmt / coinsPerUsd;
    const details =
      method === 'bank'
        ? {
            method: 'bank' as const,
            bank_name: bank.name,
            account_name: acctHolderName.trim(),
            account_number: acctDigits,
          }
        : {
            method: 'crypto' as const,
            crypto_asset: 'USDT',
            network: usdtNetwork,
            wallet_address: walletAddress.trim(),
          };
    const { wallet: w, error } = await executeWithdrawalUsd(uid, wdUsd, gasFeeAdmin, details);
    if (error) {
      showDrop(error, 'warning');
      return;
    }
    if (w) hydrateWalletFromServer(w);
    await refresh();
    router.push('/withdraw-success');
  }, [
    session?.user?.id,
    amount,
    coins,
    coinsPerUsd,
    minWithdrawCoins,
    withdrawFromUsd,
    walletUsd,
    hasGasFee,
    gasFeeAdmin,
    method,
    bankPayoutReady,
    cryptoFormReady,
    refresh,
    showDrop,
  ]);

  return (
    <VibeScreen>
      <View style={styles.flexFill}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]} pointerEvents="box-none">
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { transform: [{ scale: 0.95 }] }]}>
            <Ionicons name="chevron-back" size={18} color="#fff" />
          </Pressable>
          <Text style={styles.h1}>Withdrawal</Text>
        </View>

        <Pressable
          onPress={() => {
            if (!hasGasFee) {
              showDrop('Fund your gas fee balance to enable conversion.', 'warning');
              return;
            }
            setConvertOpen(true);
          }}
          style={({ pressed }) => [styles.convertBtn, pressed && { transform: [{ scale: 0.95 }] }]}>
          <Ionicons name="refresh-circle" size={18} color="#facc15" />
          <Text style={styles.convertText}>Convert</Text>
        </Pressable>
      </View>

      <DropBanner top={topPad + 66} />

      <ScrollView
        ref={scrollRef}
        automaticallyAdjustKeyboardInsets={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        refreshControl={hiddenRefreshControl(refreshing, onRefresh)}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: topPad + 86,
            paddingBottom: Math.max(bottomPad, 12) + 28 + keyboardInset,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        {error ? <Text style={styles.bannerErr}>{error}</Text> : null}
        <View style={styles.balanceRow}>
          <Pressable
            onPress={() => setWithdrawSourceMode('coins')}
            accessibilityRole="button"
            accessibilityState={{ selected: withdrawSource === 'coins' }}
            style={({ pressed }) => [
              styles.balanceCard,
              withdrawSource === 'coins' && styles.balanceCardActive,
              pressed && { opacity: 0.92 },
            ]}>
            <Text style={styles.balanceLabel}>Coin Balance</Text>
            <View style={styles.balanceValueRow}>
              <GoldCoin width={16} height={16} />
              <Text style={styles.balanceValue}>{fmtCoins(coins)}</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setWithdrawSourceMode('usd')}
            accessibilityRole="button"
            accessibilityState={{ selected: withdrawSource === 'usd' }}
            style={({ pressed }) => [
              styles.usdCard,
              withdrawSource === 'usd' && styles.usdCardActive,
              pressed && { opacity: 0.92 },
            ]}>
            <Text style={styles.usdLabel}>USD Ready</Text>
            <View style={styles.balanceValueRow}>
              <Ionicons name="cash" size={16} color={vibeColors.secondary} />
              <Text style={styles.balanceValue}>${walletUsd.toFixed(2)}</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.methodWrap}>
          <Pressable
            onPress={() => setMethod('bank')}
            style={[styles.methodBtn, method === 'bank' ? styles.methodBtnActive : null]}>
            <Text style={[styles.methodText, method === 'bank' ? styles.methodTextActive : null]}>Bank Transfer</Text>
          </Pressable>
          <Pressable
            onPress={() => setMethod('usdt')}
            style={[styles.methodBtn, method === 'usdt' ? styles.methodBtnActive : null]}>
            <Text style={[styles.methodText, method === 'usdt' ? styles.methodTextActive : null]}>Crypto (USDT)</Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          <View ref={amountSectionRef} collapsable={false} style={styles.field}>
            <Text style={styles.label}>
              {withdrawFromUsd ? 'Withdrawal Amount (USD)' : 'Withdrawal Amount (Coins)'}
            </Text>
            <View style={styles.amountWrap}>
              <TextInput
                value={amount}
                onChangeText={onWithdrawAmountChange}
                onBlur={onAmountBlur}
                keyboardType={withdrawFromUsd ? 'decimal-pad' : 'number-pad'}
                placeholder={amountPlaceholder}
                placeholderTextColor="rgba(255,255,255,0.25)"
                style={styles.amountInput}
                onFocus={() => {
                  focusedInputWrapRef.current = amountSectionRef.current;
                  requestAnimationFrame(() => scrollFieldAboveKeyboard(amountSectionRef.current));
                }}
              />
              <Pressable
                onPress={() =>
                  withdrawFromUsd
                    ? setAmount(walletUsd > 0 ? walletUsd.toFixed(2) : '')
                    : setAmount(coinsMaxStr)
                }
                style={({ pressed }) => [styles.maxBtn, pressed && { opacity: 0.85 }]}>
                <Text style={styles.maxText}>MAX</Text>
              </Pressable>
            </View>
          </View>

          {method === 'bank' ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Select Bank</Text>
                <Pressable
                  onPress={openBankSheet}
                  style={({ pressed }) => [styles.selectLike, pressed && { opacity: 0.92 }]}>
                  <Text style={styles.selectText}>{bank.name}</Text>
                  <Ionicons name="chevron-down" size={16} color={vibeColors.muted} />
                </Pressable>
              </View>

              <View ref={acctSectionRef} collapsable={false} style={styles.field}>
                <Text style={styles.label}>Account Number</Text>
                <TextInput
                  value={acct}
                  onChangeText={(t) => setAcct(t.replace(/\D/g, '').slice(0, 10))}
                  keyboardType="number-pad"
                  maxLength={10}
                  placeholder="Enter 10-digit account number"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  style={styles.input}
                  onFocus={() => {
                    focusedInputWrapRef.current = acctSectionRef.current;
                    requestAnimationFrame(() => scrollFieldAboveKeyboard(acctSectionRef.current));
                  }}
                />
              </View>

              {acctDigits.length === 10 ? (
                <View style={styles.holderCard}>
                  <View style={styles.holderIcon}>
                    <Ionicons
                      name={acctVerify === 'verified' ? 'person-circle' : acctVerify === 'error' ? 'alert-circle' : 'time-outline'}
                      size={20}
                      color={
                        acctVerify === 'verified'
                          ? 'rgba(34,197,94,0.95)'
                          : acctVerify === 'error'
                            ? vibeColors.primary
                            : vibeColors.secondary
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.holderLabel}>Account holder</Text>
                    {acctVerify === 'verified' ? (
                      <Text style={styles.holderName}>{acctHolderName}</Text>
                    ) : acctVerify === 'error' ? (
                      <Text style={styles.holderError}>
                        {acctVerifyError ?? 'Could not verify this account. Check bank and number.'}
                      </Text>
                    ) : (
                      <View style={styles.verifyRow}>
                        <ActivityIndicator size="small" color={vibeColors.secondary} />
                        <Text style={styles.holderVerifying}>Verifying name…</Text>
                      </View>
                    )}
                  </View>
                </View>
              ) : null}

              <View style={styles.summary}>
                {!withdrawFromUsd ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLeft}>Withdrawal (coins)</Text>
                    <Text style={styles.summaryRight}>{amountNum > 0 ? `${fmtCoins(amountNum)} coins` : '—'}</Text>
                  </View>
                ) : null}
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLeft}>USD equivalent</Text>
                  <Text style={styles.summaryRight}>
                    ${usdAmount.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLeft}>Exchange Rate</Text>
                  <Text style={styles.summaryRight}>1 USD = ₦1,500</Text>
                </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLeft}>Gas fee balance</Text>
                <Text style={[styles.summaryRight, !hasGasFee && { color: vibeColors.primary }]}>
                  ${gasBal.toFixed(2)}
                </Text>
              </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLeftBad}>Gas Fee Deduction</Text>
                  <Text style={styles.summaryRightBad}>-${gasFeeAdmin.toFixed(2)}</Text>
                </View>
                <View style={styles.hr} />
                <View style={styles.summaryFinalRow}>
                  <Text style={styles.finalLeft}>Final Payout</Text>
                  <Text style={styles.finalRight}>
                    ₦{payoutNgn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>USDT network</Text>
                <Text style={styles.hintText}>
                  Default is TRC20 (fast & low cost). Choose the network that matches the receive address in your wallet.
                </Text>
                <Pressable
                  onPress={openNetSheet}
                  style={({ pressed }) => [styles.selectLike, pressed && { opacity: 0.92 }]}>
                  <View style={styles.netLeft}>
                    <Ionicons name="link" size={16} color={vibeColors.secondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selectText}>{usdtNetwork}</Text>
                      <Text style={styles.netSub} numberOfLines={1}>
                        {usdtNetwork === 'TRC20'
                          ? 'Tron · T… address'
                          : usdtNetwork === 'ERC20'
                            ? 'Ethereum · 0x… address'
                            : 'BNB Smart Chain · 0x… address'}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-down" size={16} color={vibeColors.muted} />
                </Pressable>
              </View>

              <View ref={usdtAddressSectionRef} collapsable={false} style={styles.field}>
                <Text style={styles.label}>USDT wallet address</Text>
                <TextInput
                  value={walletAddress}
                  onChangeText={setWalletAddress}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={
                    usdtNetwork === 'TRC20' ? 'Paste T… address (Tron / TRC20)' : 'Paste 0x… address (EVM wallet)'
                  }
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  onFocus={() => {
                    focusedInputWrapRef.current = usdtAddressSectionRef.current;
                    requestAnimationFrame(() => scrollFieldAboveKeyboard(usdtAddressSectionRef.current));
                  }}
                  style={[
                    styles.inputMultiline,
                    addressCheck.kind === 'ok' && styles.inputMultilineOk,
                    (addressCheck.kind === 'mismatch' || addressCheck.kind === 'invalid') && styles.inputMultilineBad,
                    (addressCheck.kind === 'typing' && walletAddress.trim().length > 0) && styles.inputMultilineTyping,
                  ]}
                />
                {addressCheck.kind === 'ok' && (
                  <View style={styles.matchCardOk}>
                    <Ionicons name="checkmark-circle" size={18} color="rgba(34,197,94,0.95)" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.matchTitle}>Address matches {usdtNetwork}</Text>
                      <Text style={styles.matchSub}>{addressCheck.message}</Text>
                    </View>
                  </View>
                )}
                {addressCheck.kind === 'mismatch' && (
                  <View style={styles.matchCardBad}>
                    <Ionicons name="alert-circle" size={18} color={vibeColors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.matchTitleBad}>Network and address do not match</Text>
                      <Text style={styles.matchSubBad}>{addressCheck.message}</Text>
                    </View>
                  </View>
                )}
                {addressCheck.kind === 'typing' && (
                  <View style={styles.matchCardHint}>
                    <Ionicons name="information-circle" size={16} color={vibeColors.secondary} />
                    <Text style={styles.matchSubHint}>{addressCheck.hint}</Text>
                  </View>
                )}
                {(addressCheck.kind === 'invalid' && walletAddress.trim().length > 0) && (
                  <View style={styles.matchCardBad}>
                    <Ionicons name="close-circle" size={18} color={vibeColors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.matchTitleBad}>Check your address</Text>
                      <Text style={styles.matchSubBad}>{addressCheck.message}</Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.summary}>
                {!withdrawFromUsd ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLeft}>Withdrawal (coins)</Text>
                    <Text style={styles.summaryRight}>{amountNum > 0 ? `${fmtCoins(amountNum)} coins` : '—'}</Text>
                  </View>
                ) : null}
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLeft}>Withdrawal (USD)</Text>
                  <Text style={styles.summaryRight}>${usdAmount.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLeft}>Payout asset</Text>
                  <Text style={styles.summaryRight}>USDT ({usdtNetwork})</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLeft}>Gas fee balance</Text>
                  <Text style={[styles.summaryRight, !hasGasFee && { color: vibeColors.primary }]}>
                    ${gasBal.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLeftBad}>Network / gas fee</Text>
                  <Text style={styles.summaryRightBad}>-${gasFeeAdmin.toFixed(2)}</Text>
                </View>
                <View style={styles.hr} />
                <View style={styles.summaryFinalRow}>
                  <Text style={styles.finalLeft}>You receive</Text>
                  <Text style={styles.finalRight}>{cryptoNetUsdt.toFixed(2)} USDT</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <Pressable
          disabled={method === 'bank' ? !bankWithdrawReady : !cryptoWithdrawReady}
          onPress={() => void handleConfirmWithdraw()}
          style={({ pressed }) => [
            styles.cta,
            (method === 'bank' ? !bankWithdrawReady : !cryptoWithdrawReady) && styles.ctaDisabled,
            pressed && (method === 'bank' ? bankWithdrawReady : cryptoWithdrawReady) && { transform: [{ scale: 0.98 }] },
          ]}>
          <Text style={styles.ctaText}>CONFIRM WITHDRAWAL</Text>
        </Pressable>
      </ScrollView>

      {/* Network picker sheet (slides up like Convert) */}
      {netSheetVisible ? (
        <View pointerEvents="auto" style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              styles.pickerBackdrop,
              {
                opacity: netOpenT,
              },
            ]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeNetSheet} />
          </Animated.View>

          <Animated.View
            style={[
              styles.pickerSheet,
              {
                paddingBottom: bottomPad + 18,
                transform: [
                  {
                    translateY: netOpenT.interpolate({ inputRange: [0, 1], outputRange: [520, 0] }),
                  },
                ],
              },
            ]}>
            <View style={styles.sheetHandle} {...netPan.panHandlers} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>USDT network</Text>
              <Text style={styles.sheetSub}>Select the network that matches your address format.</Text>
            </View>

            <View style={styles.pickerRows}>
              {USDT_NETWORKS.map((n) => {
                const sub = n === 'TRC20' ? 'Tron · T…' : n === 'ERC20' ? 'Ethereum · 0x…' : 'BNB Smart Chain · 0x…';
                return (
                  <Pressable
                    key={n}
                    onPress={() => {
                      setUsdtNetwork(n);
                      closeNetSheet();
                    }}
                    style={({ pressed }) => [
                      styles.pickerRow,
                      n === usdtNetwork && styles.pickerRowActive,
                      pressed && { opacity: 0.9 },
                    ]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerRowText}>{n}</Text>
                      <Text style={styles.pickerRowSub} numberOfLines={1}>
                        {sub}
                      </Text>
                    </View>
                    {n === usdtNetwork ? <Ionicons name="checkmark-circle" size={22} color={vibeColors.secondary} /> : null}
                  </Pressable>
                );
              })}
            </View>

            <Pressable onPress={closeNetSheet} style={styles.pickerClose}>
              <Text style={styles.pickerCloseText}>Cancel</Text>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}

      {/* Bank picker sheet (expandable to full height on scroll/drag) */}
      {bankSheetVisible ? (
        <View pointerEvents="auto" style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              styles.pickerBackdrop,
              {
                opacity: bankOpenT,
              },
            ]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeBankSheet} />
          </Animated.View>

          <Animated.View
            style={[
              styles.bankSheet,
              {
                paddingBottom: bottomPad + 18,
                height: EXPANDED_SHEET_H,
                transform: [
                  {
                    translateY: Animated.add(
                      bankOpenT.interpolate({ inputRange: [0, 1], outputRange: [520, 0] }),
                      bankPosT.interpolate({ inputRange: [0, 1], outputRange: [EXPANDED_SHEET_H - MID_SHEET_H, 0] })
                    ),
                  },
                ],
              },
            ]}>
            <View style={{ flex: 1 }}>
            <View style={styles.sheetHandle} {...bankPan.panHandlers} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select bank</Text>
              <Text style={styles.sheetSub}>Search and choose your bank.</Text>
            </View>

            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color={vibeColors.muted} />
              <TextInput
                value={bankSearch}
                onChangeText={setBankSearch}
                placeholder="Search bank"
                placeholderTextColor="rgba(255,255,255,0.25)"
                style={styles.searchInput}
                onFocus={expandBankSheet}
              />
              {bankSearch.trim().length > 0 ? (
                <Pressable onPress={() => setBankSearch('')} style={styles.clearBtn}>
                  <Ionicons name="close" size={16} color="rgba(255,255,255,0.80)" />
                </Pressable>
              ) : null}
            </View>

            <FlatList
              data={filteredBanks}
              keyExtractor={(item) => item.code}
              onScrollBeginDrag={expandBankSheet}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setBank(item);
                    closeBankSheet();
                  }}
                  style={({ pressed }) => [
                    styles.bankRow,
                    item.code === bank.code && styles.bankRowActive,
                    pressed && { opacity: 0.92 },
                  ]}>
                  <Text style={styles.bankRowText}>{item.name}</Text>
                  {item.code === bank.code ? <Ionicons name="checkmark" size={18} color={vibeColors.secondary} /> : null}
                </Pressable>
              )}
            />

            <Pressable onPress={closeBankSheet} style={styles.pickerClose}>
              <Text style={styles.pickerCloseText}>Cancel</Text>
            </Pressable>
            </View>
          </Animated.View>
        </View>
      ) : null}

      {/* Conversion bottom-sheet (embedded, like export-react) */}
      {convertVisible ? (
        <View pointerEvents={convertOpen ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            styles.sheetBackdrop,
            {
              opacity: sheetT.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
            },
          ]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeConvert} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: bottomPad + 18,
              transform: [
                {
                  translateY: sheetT.interpolate({ inputRange: [0, 1], outputRange: [520, 0] }),
                },
              ],
            },
          ]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Convert Coins</Text>
            <Text style={styles.sheetSub}>Exchange your earned coins for withdrawable USD.</Text>
          </View>

          <View style={styles.sheetBody}>
            <View style={styles.sheetCard}>
              <View style={styles.sheetCardLeft}>
                <View style={[styles.sheetIconWrap, { backgroundColor: 'rgba(250,204,21,0.10)' }]}>
                  <Ionicons name="logo-usd" size={22} color="#facc15" />
                </View>
                <View>
                  <Text style={styles.sheetMiniLabel}>From Coins</Text>
                  <Text style={styles.sheetFromInput}>{fmtCoins(Number(fromCoins) || 0)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.downWrap}>
              <View style={styles.downBall}>
                <Ionicons name="arrow-down" size={22} color="#fff" />
              </View>
              <View style={styles.downLine} />
            </View>

            <View style={styles.sheetCard}>
              <View style={styles.sheetCardLeft}>
                <View style={[styles.sheetIconWrap, { backgroundColor: 'rgba(29,161,242,0.10)' }]}>
                  <Ionicons name="cash" size={22} color={vibeColors.secondary} />
                </View>
                <View>
                  <Text style={styles.sheetMiniLabel}>To USD</Text>
                  <Text style={styles.sheetToText}>${toUsd.toFixed(2)}</Text>
                </View>
              </View>
              <Text style={styles.sheetRateText}>
                {coinsPerUsd.toLocaleString('en-US')} coins : $1
              </Text>
            </View>
          </View>

          <View style={styles.sheetGrid}>
            <Pressable
              onPress={applyMinConvertPreset}
              style={[styles.sheetGridBtn, convertPreset === 'min' && styles.sheetGridBtnActive]}>
              <Text style={[styles.sheetGridText, convertPreset === 'min' && styles.sheetGridTextActive]}>Min Convert</Text>
            </Pressable>
            <Pressable
              onPress={applyMaxConvertPreset}
              style={[styles.sheetGridBtn, convertPreset === 'max' && styles.sheetGridBtnActive]}>
              <Text style={[styles.sheetGridText, convertPreset === 'max' && styles.sheetGridTextActive]}>Max Convert</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => void handleConvertNow()}
            style={({ pressed }) => [
              styles.sheetCta,
              !convertPreset && { opacity: 0.6 },
              pressed && { transform: [{ scale: 0.98 }] },
            ]}>
            <Text style={styles.sheetCtaText}>CONVERT NOW</Text>
          </Pressable>
          <Pressable onPress={closeConvert} style={styles.sheetCancel}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </Pressable>
        </Animated.View>
        </View>
      ) : null}
      <PullRefreshSkeletonOverlay visible={refreshing} />
      </View>
    </VibeScreen>
  );
}

const styles = StyleSheet.create({
  flexFill: { flex: 1 },
  bannerErr: {
    color: '#fecaca',
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    paddingHorizontal: 24,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(18,18,18,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: { color: '#fff', fontWeight: '900', fontSize: 18, letterSpacing: -0.2 },
  convertBtn: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(18,18,18,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  convertText: { color: '#fff', fontWeight: '900', fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase' },

  container: { paddingHorizontal: 24, gap: 18, flexGrow: 0 },
  balanceRow: { flexDirection: 'row', gap: 12 },
  balanceCard: {
    flex: 1,
    backgroundColor: 'rgba(18,18,18,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    padding: 14,
  },
  balanceCardActive: {
    borderWidth: 2,
    borderColor: 'rgba(250,204,21,0.55)',
    backgroundColor: 'rgba(250,204,21,0.08)',
  },
  balanceLabel: {
    color: vibeColors.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  usdCard: {
    flex: 1,
    backgroundColor: 'rgba(29,161,242,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(29,161,242,0.20)',
    borderRadius: 24,
    padding: 14,
  },
  usdCardActive: {
    borderWidth: 2,
    borderColor: 'rgba(29,161,242,0.65)',
    backgroundColor: 'rgba(29,161,242,0.18)',
  },
  usdLabel: {
    color: vibeColors.secondary,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  balanceValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  balanceValue: { color: '#fff', fontWeight: '900', fontSize: 18 },

  methodWrap: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(18,18,18,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  methodBtn: { flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  methodBtnActive: { backgroundColor: '#fff' },
  methodText: { color: vibeColors.muted, fontWeight: '900', fontSize: 12 },
  methodTextActive: { color: '#000' },

  form: { gap: 16 },
  field: { gap: 8 },
  label: {
    paddingHorizontal: 12,
    color: vibeColors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  amountWrap: {
    backgroundColor: 'rgba(18,18,18,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    paddingHorizontal: 16,
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  amountInput: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '900' },
  maxBtn: {
    backgroundColor: 'rgba(29,161,242,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  maxText: { color: vibeColors.secondary, fontWeight: '900', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },

  selectLike: {
    backgroundColor: 'rgba(18,18,18,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    paddingHorizontal: 18,
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: { color: '#fff', fontWeight: '900', fontSize: 13 },

  input: {
    backgroundColor: 'rgba(18,18,18,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    paddingHorizontal: 18,
    height: 58,
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
  },
  inputMultiline: {
    backgroundColor: 'rgba(18,18,18,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 14,
    minHeight: 96,
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    textAlignVertical: 'top',
  },
  inputMultilineOk: {
    borderColor: 'rgba(34,197,94,0.45)',
    backgroundColor: 'rgba(34,197,94,0.06)',
  },
  inputMultilineBad: {
    borderColor: 'rgba(254,44,85,0.55)',
    backgroundColor: 'rgba(254,44,85,0.06)',
  },
  inputMultilineTyping: {
    borderColor: 'rgba(29,161,242,0.40)',
  },
  hintText: {
    paddingHorizontal: 12,
    color: vibeColors.muted,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginBottom: 4,
  },
  netLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  netSub: { color: vibeColors.muted, fontWeight: '600', fontSize: 10, marginTop: 2 },
  matchCardOk: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    borderRadius: 18,
    padding: 12,
  },
  matchTitle: { color: 'rgba(34,197,94,0.95)', fontWeight: '900', fontSize: 11, marginBottom: 4 },
  matchSub: { color: 'rgba(255,255,255,0.72)', fontWeight: '600', fontSize: 11, lineHeight: 16 },
  matchCardBad: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(254,44,85,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(254,44,85,0.30)',
    borderRadius: 18,
    padding: 12,
  },
  matchTitleBad: { color: '#fff', fontWeight: '900', fontSize: 11, marginBottom: 4 },
  matchSubBad: { color: 'rgba(255,255,255,0.80)', fontWeight: '600', fontSize: 11, lineHeight: 16 },
  matchCardHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    marginTop: 2,
  },
  matchSubHint: { color: vibeColors.secondary, fontWeight: '600', fontSize: 11, lineHeight: 16, flex: 1 },
  warnCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(250,204,21,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.22)',
    borderRadius: 20,
    padding: 14,
  },
  warnText: { flex: 1, color: 'rgba(255,255,255,0.90)', fontWeight: '600', fontSize: 11, lineHeight: 16 },

  holderCard: {
    backgroundColor: 'rgba(34,197,94,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.20)',
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  holderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(34,197,94,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holderLabel: {
    color: 'rgba(34,197,94,0.70)',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  holderName: { color: '#fff', fontWeight: '900', fontSize: 13, marginTop: 4 },
  verifyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  holderVerifying: { color: vibeColors.muted, fontWeight: '700', fontSize: 13 },
  holderError: { color: vibeColors.primary, fontWeight: '700', fontSize: 12, marginTop: 4, lineHeight: 17 },
  amountHintBad: {
    color: '#f87171',
    fontWeight: '700',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 14,
  },

  summary: {
    backgroundColor: 'rgba(18,18,18,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 32,
    padding: 18,
    gap: 12,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLeft: { color: vibeColors.muted, fontWeight: '600', fontSize: 12 },
  summaryRight: { color: '#fff', fontWeight: '900', fontSize: 12 },
  summaryLeftBad: { color: vibeColors.primary, fontWeight: '700', fontSize: 12 },
  summaryRightBad: { color: vibeColors.primary, fontWeight: '900', fontSize: 12 },
  hr: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginTop: 4, marginBottom: 2 },
  summaryFinalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  finalLeft: { color: '#fff', fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  finalRight: { color: vibeColors.secondary, fontWeight: '900', fontSize: 18 },

  cta: {
    height: 58,
    borderRadius: 999,
    backgroundColor: vibeColors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: vibeColors.secondary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  ctaText: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 1.6 },
  ctaDisabled: { opacity: 0.42 },
  pickerBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.70)' },

  pickerSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(18,18,18,1)',
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  bankSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(18,18,18,1)',
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 24,
    paddingTop: 18,
    overflow: 'hidden',
  },
  pickerRows: { gap: 10, marginTop: 6, marginBottom: 12 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 22,
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  pickerRowActive: { backgroundColor: 'rgba(29,161,242,0.12)', borderColor: 'rgba(29,161,242,0.22)' },
  pickerRowText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  pickerRowSub: { color: vibeColors.muted, fontWeight: '600', fontSize: 11, marginTop: 2 },
  pickerClose: { alignItems: 'center', paddingVertical: 14 },
  pickerCloseText: { color: vibeColors.muted, fontWeight: '900', fontSize: 13 },

  searchWrap: {
    height: 54,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  searchInput: { flex: 1, color: '#fff', fontWeight: '800', fontSize: 13, paddingVertical: 0 },
  clearBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankRow: {
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.30)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bankRowActive: { backgroundColor: 'rgba(29,161,242,0.12)', borderColor: 'rgba(29,161,242,0.22)' },
  bankRowText: { color: '#fff', fontWeight: '900', fontSize: 13 },

  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(18,18,18,1)',
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  sheetHandle: {
    width: 48,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignSelf: 'center',
    marginBottom: 18,
  },
  sheetHeader: { alignItems: 'center', marginBottom: 20 },
  sheetTitle: { color: '#fff', fontWeight: '900', fontSize: 22, letterSpacing: -0.3, marginBottom: 6 },
  sheetSub: { color: vibeColors.muted, fontWeight: '600', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  sheetBody: { alignItems: 'center', gap: 14, marginBottom: 18 },
  sheetCard: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 32,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sheetMiniLabel: {
    color: vibeColors.muted,
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sheetFromInput: { color: '#fff', fontWeight: '900', fontSize: 18, paddingVertical: 0, width: 130 },
  sheetToText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  sheetPillBtn: { backgroundColor: 'rgba(29,161,242,0.10)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  sheetPillBtnText: { color: vibeColors.secondary, fontWeight: '900', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  sheetRateText: { color: vibeColors.muted, fontWeight: '900', fontSize: 10 },
  downWrap: { alignItems: 'center', justifyContent: 'center' },
  downBall: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: vibeColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: vibeColors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    zIndex: 2,
  },
  downLine: {
    position: 'absolute',
    width: 1,
    height: 68,
    backgroundColor: 'rgba(254,44,85,0.25)',
  },
  sheetGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  sheetGridBtn: {
    flex: 1,
    backgroundColor: 'rgba(18,18,18,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetGridText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  sheetGridBtnActive: {
    borderWidth: 2,
    borderColor: 'rgba(29,161,242,0.55)',
    backgroundColor: 'rgba(29,161,242,0.12)',
  },
  sheetGridTextActive: { color: '#fff' },
  sheetCta: {
    height: 58,
    borderRadius: 999,
    backgroundColor: vibeColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: vibeColors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  sheetCtaText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1.4 },
  sheetCancel: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  sheetCancelText: { color: vibeColors.muted, fontWeight: '900', fontSize: 13 },
});

