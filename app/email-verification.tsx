import Mailbox from '@/assets/vibepay/icons/solar-mailbox-bold-duotone.svg';
import { OtpInput, type OtpInputHandle } from '@/components/auth/otp-input';
import { vibeColors } from '@/components/vibepay/vibe-screen';
import { requestOtp, verifyOtp } from '@/lib/auth/otp';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

const BG_IMAGE = require('@/assets/vibepay/images/5PpI0crjJhK.png');

function FloatingIcon({
  name,
  size,
  color,
  style,
  durationMs,
  delayMs,
  pulseOnly,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  size: number;
  color: string;
  style: object;
  durationMs: number;
  delayMs: number;
  pulseOnly?: boolean;
}) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: durationMs, delay: delayMs, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: durationMs, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [delayMs, durationMs, t]);

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
  const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] });

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: pulseOnly ? [] : [{ translateY }],
        },
      ]}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}

export default function EmailVerificationScreen() {
  const params = useLocalSearchParams<{
    email?: string;
    password?: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    referral?: string;
    flow?: string;
  }>();

  const email = (params.email ?? '').toString();
  const password = (params.password ?? '').toString();
  const fullName = (params.fullName ?? '').toString();
  const firstName = (params.firstName ?? '').toString();
  const lastName = (params.lastName ?? '').toString();
  const username = (params.username ?? '').toString();
  const referral = (params.referral ?? '').toString();
  const flow = (params.flow ?? '').toString();

  const OTP_LEN = 6;
  const [code, setCode] = useState<string[]>(Array.from({ length: OTP_LEN }, () => ''));
  const joined = useMemo(() => code.join(''), [code]);
  const otpRef = useRef<OtpInputHandle | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resendLeft, setResendLeft] = useState(59);
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 8000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 8000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const bgTransform = useMemo(() => {
    const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1.05, 1.1] });
    const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.68] });
    return { transform: [{ scale }], opacity };
  }, [pulse]);

  const overlayOpacity = useMemo(
    () => pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 0.52] }),
    [pulse]
  );

  const ping = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(ping, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(ping, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [ping]);

  const pingStyle = useMemo(() => {
    const scale = ping.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
    const opacity = ping.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0] });
    return { transform: [{ scale }], opacity };
  }, [ping]);

  useEffect(() => {
    if (!email) return;
    setResendLeft(59);
    if (resendTimer.current) clearInterval(resendTimer.current);
    resendTimer.current = setInterval(() => {
      setResendLeft((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => {
      if (resendTimer.current) clearInterval(resendTimer.current);
      resendTimer.current = null;
    };
  }, [email]);

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, bgTransform]}>
        <Image source={BG_IMAGE} style={styles.bgImage} contentFit="cover" />
      </Animated.View>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View style={[styles.overlayA, { opacity: overlayOpacity }]} />
        <View style={styles.overlayB} />
        <View style={styles.overlayC} />
      </View>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <FloatingIcon
          name="mail"
          size={64}
          color={vibeColors.secondary}
          durationMs={2500}
          delayMs={0}
          pulseOnly
          style={[styles.floating, { top: '10%', right: '14%' }]}
        />
        <FloatingIcon
          name="shield-checkmark"
          size={58}
          color={vibeColors.primary}
          durationMs={5200}
          delayMs={100}
          style={[styles.floating, { bottom: '18%', left: '10%' }]}
        />
        <FloatingIcon
          name="checkmark-done"
          size={38}
          color={'rgba(29,161,242,0.85)'}
          durationMs={3000}
          delayMs={250}
          pulseOnly
          style={[styles.floating, { top: '34%', left: '6%' }]}
        />
        <FloatingIcon
          name="lock-closed"
          size={50}
          color={'rgba(254,44,85,0.85)'}
          durationMs={4500}
          delayMs={650}
          style={[styles.floating, { bottom: '34%', right: '10%' }]}
        />
      </View>

      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Animated.View style={[styles.ping, pingStyle]} />
          <Mailbox width={56} height={56} color={vibeColors.secondary} />
        </View>

        <Text style={styles.title}>Verify Email</Text>
        <Text style={styles.sub}>
          We sent a code to <Text style={styles.subStrong}>{email || 'your email'}</Text>.
        </Text>

        <OtpInput
          ref={otpRef}
          length={OTP_LEN}
          value={code}
          disabled={submitting || success}
          autoFocus
          onChange={(next) => {
            setError(null);
            setCode(next);
          }}
        />

        <Pressable
          disabled={submitting}
          onPress={async () => {
            if (!email) {
              setError('Missing email. Go back and try again.');
              return;
            }
            if (joined.length !== OTP_LEN) return;
            setSubmitting(true);
            setError(null);
            try {
              const { data, error: verifyError } = await verifyOtp(email, joined);
              if (verifyError) {
                const msg = String(verifyError.message || 'Verification failed.');
                if (msg.toLowerCase().includes('used')) {
                  setError('This code has already been used. Tap “Resend code” to get a new one.');
                } else if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid')) {
                  setError('This code is invalid or expired. Tap “Resend code” and use the latest code.');
                } else {
                  setError(msg);
                }
                return;
              }

              if (flow === 'register') {
                const referralTrimmed = referral.trim();
                const payload: { password?: string; data?: Record<string, string> } = {};
                if (password) payload.password = password;
                if (referralTrimmed) payload.data = { referral_code: referralTrimmed };

                if (Object.keys(payload).length > 0) {
                  const { error: userErr } = await supabase.auth.updateUser(payload);
                  if (userErr) {
                    setError(userErr.message);
                    return;
                  }
                }
              }

              const authedUserId = data.user?.id;
              const authedEmail = data.user?.email ?? email;
              if (authedUserId && authedEmail && flow === 'register') {
                // Save the user's registration fields into `public.profiles` (MVP schema).
                const fn = firstName.trim();
                const ln = lastName.trim();
                const derivedFull = [fn, ln].filter(Boolean).join(' ').trim();
                const { error: profErr } = await supabase.from('profiles').upsert(
                  {
                    id: authedUserId,
                    email: authedEmail,
                    first_name: fn || null,
                    last_name: ln || null,
                    full_name: (derivedFull || fullName.trim()) || null,
                    username: username?.trim() || null,
                  },
                  { onConflict: 'id' }
                );
                if (profErr) {
                  setError(profErr.message);
                  return;
                }
              }

              setSuccess(true);
              setTimeout(() => {
                router.replace('/(tabs)/watch');
              }, 650);
            } finally {
              setSubmitting(false);
            }
          }}
          style={({ pressed }) => [
            styles.btn,
            pressed && { transform: [{ scale: 0.98 }] },
            submitting && { opacity: 0.75 },
          ]}>
          <Text style={styles.btnText}>Verify Code</Text>
        </Pressable>

        {success ? <Text style={styles.successText}>Verified. Redirecting…</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.resend}>
          <Text style={styles.resendMuted}>Didn&apos;t receive the code?</Text>
          <Pressable
            disabled={!email || resendLeft > 0}
            onPress={async () => {
              if (!email || resendLeft > 0) return;
              setError(null);
              setCode(Array.from({ length: OTP_LEN }, () => ''));
              otpRef.current?.focusFirst();
              setResendLeft(59);
              if (resendTimer.current) clearInterval(resendTimer.current);
              resendTimer.current = setInterval(() => {
                setResendLeft((s) => (s <= 0 ? 0 : s - 1));
              }, 1000);
              const { error: sendErr } = await requestOtp(email);
              if (sendErr) setError(sendErr.message);
            }}>
            <Text style={[styles.resendLink, resendLeft > 0 && { opacity: 0.6 }]}>
              {resendLeft > 0 ? `Resend code in ${resendLeft}s` : 'Resend code'}
            </Text>
          </Pressable>
        </View>

        <Link href="/login" asChild>
          <Pressable style={styles.back}>
            <Ionicons name="arrow-back" size={16} color={vibeColors.muted} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: vibeColors.background,
  },
  bgImage: {
    width: '100%',
    height: '100%',
  },
  overlayA: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  overlayB: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  overlayC: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  floating: {
    position: 'absolute',
    opacity: 0.55,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(29,161,242,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: vibeColors.secondary,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  ping: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: 'rgba(29,161,242,0.30)',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 10,
  },
  sub: {
    color: vibeColors.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 18,
  },
  subStrong: {
    color: '#fff',
    fontWeight: '800',
  },
  btn: {
    width: '100%',
    height: 54,
    borderRadius: 999,
    backgroundColor: vibeColors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    maxWidth: 440,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  resend: {
    alignItems: 'center',
    gap: 6,
  },
  resendMuted: {
    color: vibeColors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  resendLink: {
    color: vibeColors.secondary,
    fontSize: 13,
    fontWeight: '900',
  },
  errorText: {
    marginTop: 8,
    maxWidth: 440,
    textAlign: 'center',
    color: 'rgba(255,80,80,0.95)',
    fontSize: 12,
    fontWeight: '700',
  },
  successText: {
    marginTop: 8,
    maxWidth: 440,
    textAlign: 'center',
    color: 'rgba(44,254,224,0.95)',
    fontSize: 12,
    fontWeight: '800',
  },
  back: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  backText: {
    color: vibeColors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
});
