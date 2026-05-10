import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GoldCoin from '@/assets/vibepay/icons/50cent.svg';
import { VibeBottomNav } from '@/components/vibepay/bottom-nav';
import { hiddenRefreshControl, PullRefreshSkeletonOverlay } from '@/components/vibepay/pull-refresh';
import { vibeColors, VibeScreen } from '@/components/vibepay/vibe-screen';
import { useAccountData } from '@/hooks/use-account-data';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { supabase } from '@/lib/supabase';
import { hydrateWalletFromServer, resetWalletStore } from '@/lib/wallet-store';

function fmtMoney(n: number) {
  return `$${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`;
}

function fmtCoins(n: number) {
  return Number.isFinite(n)
    ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';
}

function fmtInt(n: number) {
  return Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '0';
}

/** Demo used ~1000 coins ≈ $1 for subtitle */
function usdFromCoins(coins: number) {
  return fmtMoney(coins / 1000);
}

function initialsFromName(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  const a = p[0]?.[0] ?? '?';
  const b = p.length > 1 ? p[p.length - 1]?.[0] ?? '' : p[0]?.[1] ?? '';
  return (a + b).toUpperCase();
}

export default function ProfileScreen() {
  const { profile, wallet, session, loading, error, refresh } = useAccountData();
  const [editOpen, setEditOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [fullNameEdit, setFullNameEdit] = useState('');
  const [firstNameEdit, setFirstNameEdit] = useState('');
  const [lastNameEdit, setLastNameEdit] = useState('');
  const [usernameEdit, setUsernameEdit] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 16);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    if (wallet) {
      hydrateWalletFromServer(wallet);
      return;
    }
    if (!loading && !session?.user?.id) {
      resetWalletStore();
    }
  }, [wallet, loading, session?.user?.id]);

  useEffect(() => {
    if (profile) {
      setFirstNameEdit(profile.first_name ?? '');
      setLastNameEdit(profile.last_name ?? '');
      setFullNameEdit(profile.full_name ?? '');
      setUsernameEdit(profile.username ?? '');
    }
  }, [profile]);

  // Display name should be first + last name (preferred), falling back to full_name.
  const displayName =
    [profile?.first_name?.trim(), profile?.last_name?.trim()].filter(Boolean).join(' ').trim() ||
    profile?.full_name?.trim() ||
    'User';
  // Username pill should reflect exactly what the user set; never derive from email.
  const handle = profile?.username?.trim() ? `@${profile.username.replace(/^@/, '')}` : '@—';
  const emailPill = profile?.email ?? session?.user?.email ?? null;
  const coins = wallet?.coin_balance ?? 0;
  const shopBal = wallet?.wallet_balance ?? 0;
  const usdReady = wallet?.usd_ready ?? 0;
  const sp = wallet?.scroll_points ?? 0;
  const gasUsd = wallet?.gas_fee_balance ?? 0;
  const emailVerified = Boolean(session?.user?.email_confirmed_at ?? session?.user?.confirmed_at);

  const { refreshing, onRefresh } = usePullToRefresh(refresh);
  const showSkeleton = loading || refreshing;

  return (
    <VibeScreen>
      <View style={styles.flexFill}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]} pointerEvents="box-none">
        <Text style={styles.h1}>Profile</Text>
        <Pressable
          onPress={() => router.push('/notification')}
          style={({ pressed }) => [styles.headerBtn, pressed && { transform: [{ scale: 0.95 }] }]}>
          <Ionicons name="notifications" size={18} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        refreshControl={hiddenRefreshControl(refreshing, onRefresh)}
        contentContainerStyle={[styles.container, { paddingTop: topPad + 70 }]}
        showsVerticalScrollIndicator={false}>
        {error ? <Text style={styles.bannerErr}>{error}</Text> : null}

        <View style={styles.centerBlock}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarRing}>
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarFallbackText}>{initialsFromName(displayName)}</Text>
              </View>
            </View>
            {emailVerified ? (
              <View style={styles.verified}>
                <Ionicons name="checkmark" size={12} color="#fff" />
              </View>
            ) : null}
          </View>

          <Text style={styles.name}>{displayName}</Text>
          <View style={styles.metaRow}>
            <View style={styles.handlePill}>
              <Text style={styles.handlePillText}>{handle}</Text>
            </View>
            <View style={styles.dot} />
            <View style={styles.activePill}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>Active</Text>
            </View>
          </View>
          {emailPill ? (
            <View style={styles.emailPill}>
              <Ionicons name="mail" size={14} color="rgba(255,255,255,0.70)" />
              <Text style={styles.emailPillText} numberOfLines={1}>
                {emailPill}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.grid}>
          <MiniCard
            icon="coinSvg"
            iconColor="#facc15"
            label="Coin Balance"
            value={fmtCoins(coins)}
            sub={`≈ ${usdFromCoins(coins)} USD`}
            subColor="#facc15"
          />
          <MiniCard
            icon="wallet"
            iconColor={vibeColors.secondary}
            label="Wallet Balance"
            value={fmtMoney(shopBal)}
            sub="Shop — buy SP only"
            subColor={vibeColors.secondary}
          />
          <MiniCard
            icon="logo-usd"
            iconColor="#22c55e"
            label="USD Ready"
            value={fmtMoney(usdReady)}
            sub="Withdrawable"
            subColor="#22c55e"
          />
          <MiniCard
            icon="bar-chart"
            iconColor="#60a5fa"
            label="Scroll Points"
            value={fmtInt(sp)}
            sub="Remaining"
            subColor="#60a5fa"
          />
        </View>

        <Text style={styles.sectionLabel}>Account Preferences</Text>

        <View style={styles.prefList}>
          <Pressable onPress={() => setEditOpen((s) => !s)} style={({ pressed }) => [styles.prefBtn, pressed && { opacity: 0.92 }]}>
            <View style={styles.prefLeft}>
              <View style={[styles.prefIcon, { backgroundColor: 'rgba(254,44,85,0.10)' }]}>
                <Ionicons name="person" size={18} color={vibeColors.primary} />
              </View>
              <Text style={styles.prefText}>Edit Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={vibeColors.muted} style={editOpen ? styles.chevOpen : undefined} />
          </Pressable>
          {editOpen ? (
            <View style={styles.expand}>
              {profileMsg ? <Text style={styles.bannerOk}>{profileMsg}</Text> : null}
              <Text style={styles.fieldLabel}>First name</Text>
              <View style={styles.inputRow}>
                <Ionicons name="person" size={18} color={vibeColors.muted} />
                <TextInput
                  value={firstNameEdit}
                  onChangeText={setFirstNameEdit}
                  style={styles.input}
                  placeholder="First name"
                  placeholderTextColor={vibeColors.muted}
                />
              </View>
              <Text style={styles.fieldLabel}>Last name</Text>
              <View style={styles.inputRow}>
                <Ionicons name="person" size={18} color={vibeColors.muted} />
                <TextInput
                  value={lastNameEdit}
                  onChangeText={setLastNameEdit}
                  style={styles.input}
                  placeholder="Last name"
                  placeholderTextColor={vibeColors.muted}
                />
              </View>
              <Text style={styles.fieldLabel}>Username</Text>
              <View style={styles.inputRow}>
                <Ionicons name="at" size={18} color={vibeColors.muted} />
                <TextInput
                  value={usernameEdit}
                  onChangeText={setUsernameEdit}
                  autoCapitalize="none"
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor={vibeColors.muted}
                />
              </View>

              <Pressable
                disabled={saveBusy}
                onPress={async () => {
                  setProfileMsg(null);
                  const uid = session?.user?.id;
                  if (!uid) return;
                  setSaveBusy(true);
                  try {
                    const { error: upErr } = await supabase
                      .from('profiles')
                      .update({
                        first_name: firstNameEdit.trim() || null,
                        last_name: lastNameEdit.trim() || null,
                        full_name:
                          ([firstNameEdit.trim(), lastNameEdit.trim()].filter(Boolean).join(' ').trim() ||
                            fullNameEdit.trim()) ||
                          null,
                        username: usernameEdit.trim() || null,
                      })
                      .eq('id', uid);
                    if (upErr) {
                      setProfileMsg(upErr.message);
                      return;
                    }
                    await refresh();
                    setProfileMsg('Saved.');
                    setEditOpen(false);
                  } finally {
                    setSaveBusy(false);
                  }
                }}
                style={({ pressed }) => [styles.saveBtn, pressed && { transform: [{ scale: 0.98 }] }, saveBusy && { opacity: 0.7 }]}>
                <Text style={styles.saveBtnText}>{saveBusy ? 'SAVING…' : 'SAVE CHANGES'}</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable onPress={() => setSecurityOpen((s) => !s)} style={({ pressed }) => [styles.prefBtn, pressed && { opacity: 0.92 }]}>
            <View style={styles.prefLeft}>
              <View style={[styles.prefIcon, { backgroundColor: 'rgba(29,161,242,0.10)' }]}>
                <Ionicons name="shield" size={18} color={vibeColors.secondary} />
              </View>
              <Text style={styles.prefText}>Security & Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={vibeColors.muted} style={securityOpen ? styles.chevOpen : undefined} />
          </Pressable>
          {securityOpen ? (
            <View style={styles.expand}>
              {pwMsg ? <Text style={styles.bannerOk}>{pwMsg}</Text> : null}
              <Text style={styles.fieldLabel}>Current Password</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed" size={18} color={vibeColors.muted} />
                <TextInput
                  value={currentPw}
                  onChangeText={setCurrentPw}
                  secureTextEntry
                  placeholder="Enter current password"
                  placeholderTextColor={vibeColors.muted}
                  style={styles.input}
                />
              </View>

              <Text style={styles.fieldLabel}>New Password</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed" size={18} color={vibeColors.muted} />
                <TextInput
                  value={newPw}
                  onChangeText={setNewPw}
                  secureTextEntry
                  placeholder="Enter new password"
                  placeholderTextColor={vibeColors.muted}
                  style={styles.input}
                />
              </View>

              <Text style={styles.fieldLabel}>Confirm New Password</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed" size={18} color={vibeColors.muted} />
                <TextInput
                  value={confirmPw}
                  onChangeText={setConfirmPw}
                  secureTextEntry
                  placeholder="Re-enter new password"
                  placeholderTextColor={vibeColors.muted}
                  style={styles.input}
                />
              </View>

              <Pressable
                disabled={pwBusy}
                onPress={async () => {
                  setPwMsg(null);
                  if (!newPw || newPw !== confirmPw) {
                    setPwMsg('New passwords must match.');
                    return;
                  }
                  if (currentPw.trim().length === 0) {
                    setPwMsg('Enter your current password.');
                    return;
                  }
                  setPwBusy(true);
                  try {
                    const email = session?.user?.email;
                    if (!email) {
                      setPwMsg('Not signed in.');
                      return;
                    }
                    const { error: checkErr } = await supabase.auth.signInWithPassword({
                      email,
                      password: currentPw,
                    });
                    if (checkErr) {
                      setPwMsg('Current password is incorrect.');
                      return;
                    }
                    const { error: pwErr } = await supabase.auth.updateUser({ password: newPw });
                    if (pwErr) {
                      setPwMsg(pwErr.message);
                      return;
                    }
                    setCurrentPw('');
                    setNewPw('');
                    setConfirmPw('');
                    setPwMsg('Password updated.');
                    setSecurityOpen(false);
                  } finally {
                    setPwBusy(false);
                  }
                }}
                style={({ pressed }) => [styles.compactBtn, pressed && { transform: [{ scale: 0.98 }] }, pwBusy && { opacity: 0.7 }]}>
                <Text style={styles.compactBtnText}>{pwBusy ? 'SAVING…' : 'SAVE PASSWORD'}</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable onPress={() => router.push('/notification')} style={({ pressed }) => [styles.prefBtn, pressed && { opacity: 0.92 }]}>
            <View style={styles.prefLeft}>
              <View style={[styles.prefIcon, { backgroundColor: 'rgba(29,161,242,0.10)' }]}>
                <Ionicons name="notifications" size={18} color={vibeColors.secondary} />
              </View>
              <Text style={styles.prefText}>Notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={vibeColors.muted} />
          </Pressable>
        </View>

        <Pressable onPress={() => router.push('/gas-fee-top-up')} style={({ pressed }) => [styles.gasCard, pressed && { opacity: 0.95 }]}>
          <View style={styles.gasLeft}>
            <View style={styles.gasIcon}>
              <Ionicons name="flame" size={18} color={vibeColors.primary} />
            </View>
            <View>
              <Text style={styles.gasLabel}>Gas fee Balance</Text>
              <View style={styles.gasValueRow}>
                <Text style={styles.gasValue}>{fmtMoney(gasUsd)}</Text>
                <Text style={styles.gasUnit}>USD</Text>
              </View>
            </View>
          </View>
          <View style={styles.topUpBtn}>
            <Text style={styles.topUpText}>Top-up</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={async () => {
            await supabase.auth.signOut();
            router.replace('/login');
          }}
          style={({ pressed }) => [styles.logout, pressed && { transform: [{ scale: 0.98 }] }]}>
          <Ionicons name="log-out" size={18} color="#ef4444" />
          <Text style={styles.logoutText}>LOG OUT ACCOUNT</Text>
        </Pressable>
      </ScrollView>

      <PullRefreshSkeletonOverlay visible={showSkeleton} />

      <VibeBottomNav />
      </View>
    </VibeScreen>
  );
}

function MiniCard({
  icon,
  iconColor,
  label,
  value,
  sub,
  subColor,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'] | 'coinSvg';
  iconColor: string;
  label: string;
  value: string;
  sub: string;
  subColor: string;
}) {
  return (
    <View style={styles.miniCard}>
      <View style={styles.miniHead}>
        {icon === 'coinSvg' ? <GoldCoin width={14} height={14} /> : <Ionicons name={icon} size={14} color={iconColor} />}
        <Text style={styles.miniLabel}>{label}</Text>
      </View>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={[styles.miniSub, { color: subColor }]}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  h1: { color: '#fff', fontWeight: '900', fontSize: 22, letterSpacing: -0.3 },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(18,18,18,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    paddingHorizontal: 24,
    paddingBottom: 140,
    gap: 18,
  },
  centerBlock: { alignItems: 'center', marginTop: 6, marginBottom: 6 },
  avatarWrap: { marginBottom: 10 },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    padding: 4,
    backgroundColor: vibeColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 4, borderColor: '#000' },
  verified: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: vibeColors.secondary,
    borderWidth: 4,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: '#fff', fontWeight: '900', fontSize: 22, letterSpacing: -0.3 },
  metaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emailPill: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    maxWidth: 320,
  },
  emailPillText: {
    color: 'rgba(255,255,255,0.70)',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.6,
    flexShrink: 1,
  },
  handlePill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  handlePillText: {
    color: 'rgba(255,255,255,0.70)',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.20)' },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.20)',
    backgroundColor: 'rgba(34,197,94,0.10)',
  },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  activeText: {
    color: '#22c55e',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  miniCard: {
    width: '48%',
    backgroundColor: 'rgba(18,18,18,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 14,
  },
  miniHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  miniLabel: {
    color: vibeColors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  miniValue: { color: '#fff', fontSize: 18, fontWeight: '900' },
  miniSub: { marginTop: 2, fontSize: 9, fontWeight: '900', letterSpacing: 0.4, textTransform: 'uppercase' },

  sectionLabel: {
    color: vibeColors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
  },
  prefList: { gap: 10 },
  prefBtn: {
    backgroundColor: 'rgba(18,18,18,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prefLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prefIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  prefText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  chevOpen: { transform: [{ rotate: '90deg' }] },
  expand: {
    marginTop: 8,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(18,18,18,0.30)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  fieldLabel: { color: vibeColors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.6, textTransform: 'uppercase' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 13 },
  saveBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: vibeColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '900', fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase' },
  compactBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: vibeColors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  compactBtnText: { color: '#fff', fontWeight: '900', fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase' },

  gasCard: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(18,18,18,0.40)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gasLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gasIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(254,44,85,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gasLabel: { color: vibeColors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.6, textTransform: 'uppercase' },
  gasValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  gasValue: { color: '#fff', fontSize: 20, fontWeight: '900' },
  gasUnit: { color: vibeColors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  topUpBtn: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(254,44,85,0.20)',
    backgroundColor: 'rgba(254,44,85,0.10)',
  },
  topUpText: { color: vibeColors.primary, fontWeight: '900', fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },

  logout: {
    height: 54,
    borderRadius: 20,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.20)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  logoutText: { color: '#ef4444', fontWeight: '900', fontSize: 12, letterSpacing: 2 },
  flexFill: { flex: 1 },
  bannerErr: {
    color: 'rgba(255,100,100,0.95)',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  bannerOk: {
    color: 'rgba(44,254,224,0.95)',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  avatarFallback: {
    backgroundColor: 'rgba(29,161,242,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { color: '#fff', fontWeight: '900', fontSize: 28 },
});

