import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import PlayStream from '@/assets/vibepay/icons/solar-play-stream-bold.svg';
import { supabase } from '@/lib/supabase';

const BG_IMAGE = require('@/assets/vibepay/images/4qCMqqeAgXH.png');

function FloatingIcon({
  name,
  size,
  color,
  style,
  durationMs,
  delayMs,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  size: number;
  color: string;
  style: object;
  durationMs: number;
  delayMs: number;
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

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });

  return (
    <Animated.View style={[style, { transform: [{ translateY }], opacity: 0.22 }]}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 10_000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 10_000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const bgTransform = useMemo(() => {
    const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1.05, 1.1] });
    const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.42] });
    return { transform: [{ scale }], opacity };
  }, [pulse]);

  const overlayOpacity = useMemo(
    () => pulse.interpolate({ inputRange: [0, 1], outputRange: [0.68, 0.48] }),
    [pulse]
  );

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, bgTransform]}>
        <Image source={BG_IMAGE} style={styles.bgImage} contentFit="cover" />
      </Animated.View>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View style={[styles.overlayBase, { opacity: overlayOpacity }]} />
        <View style={styles.overlayTopFade} />
      </View>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <FloatingIcon
          name="play"
          size={34}
          color={stylesVars.primary}
          durationMs={4000}
          delayMs={100}
          style={[styles.floating, { top: '15%', left: '10%' }]}
        />
        <FloatingIcon
          name="musical-notes"
          size={28}
          color={stylesVars.secondary}
          durationMs={5000}
          delayMs={250}
          style={[styles.floating, { top: '25%', right: '15%' }]}
        />
        <FloatingIcon
          name="heart"
          size={44}
          color={stylesVars.primary}
          durationMs={6000}
          delayMs={700}
          style={[styles.floating, { bottom: '30%', left: '20%' }]}
        />
        <FloatingIcon
          name="star"
          size={22}
          color={stylesVars.secondary}
          durationMs={4500}
          delayMs={450}
          style={[styles.floating, { bottom: '20%', right: '10%' }]}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.center}
        contentContainerStyle={styles.centerContent}>
        <View style={styles.header}>
          <View style={styles.logo}>
            <PlayStream width={44} height={44} color="#fff" />
          </View>
          <Text style={styles.brand}>
            Vibe<Text style={styles.brandAccent}>Pay</Text>
          </Text>
          <Text style={styles.tagline}>Watch, Play, Earn real cash.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.field}>
            <Ionicons name="mail" size={20} color={stylesVars.muted} style={styles.fieldIcon} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="Email address"
              placeholderTextColor={stylesVars.muted}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Ionicons name="lock-closed" size={20} color={stylesVars.muted} style={styles.fieldIcon} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="Password"
              placeholderTextColor={stylesVars.muted}
              style={[styles.input, styles.inputWithRight]}
            />
            <Pressable
              onPress={() => setShowPassword((s) => !s)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              style={styles.rightIconBtn}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={stylesVars.muted} />
            </Pressable>
          </View>

          <View style={styles.forgotRow}>
            <Link href="/error" asChild>
              <Pressable accessibilityRole="button" hitSlop={10}>
                <Text style={styles.forgot}>Forgot Password?</Text>
              </Pressable>
            </Link>
          </View>

          <Pressable
            disabled={submitting}
            onPress={async () => {
              if (!email || !password) return;
              setSubmitting(true);
              setError(null);
              try {
                const { error: authError } = await supabase.auth.signInWithPassword({
                  email: email.trim(),
                  password,
                });
                if (authError) {
                  setError(authError.message);
                  return;
                }
                router.replace('/(tabs)/watch');
              } finally {
                setSubmitting(false);
              }
            }}
            style={({ pressed }) => [
              styles.loginBtn,
              pressed && styles.loginBtnPressed,
              submitting && { opacity: 0.75 },
            ]}>
            <Text style={styles.loginBtnText}>Log In</Text>
            <Ionicons name="arrow-forward" size={18} color="#141414" />
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Don&apos;t have an account?{' '}
            <Link href="/register" asChild>
              <Text style={styles.footerLink}>Register now</Text>
            </Link>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const stylesVars = {
  primary: '#FE2C55',
  secondary: '#2CFEE0',
  muted: 'rgba(255,255,255,0.62)',
  card: 'rgba(24,24,24,0.40)',
  border: 'rgba(255,255,255,0.10)',
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  bgImage: {
    width: '100%',
    height: '100%',
  },
  overlayBase: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  overlayTopFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  floating: {
    position: 'absolute',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  centerContent: {
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 32,
    backgroundColor: stylesVars.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: stylesVars.primary,
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  brand: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: '#fff',
  },
  brandAccent: {
    color: stylesVars.primary,
    fontWeight: '900',
  },
  tagline: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: stylesVars.muted,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: stylesVars.card,
    borderWidth: 1,
    borderColor: stylesVars.border,
    borderRadius: 36,
    padding: 18,
  },
  field: {
    position: 'relative',
    marginBottom: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  fieldIcon: {
    position: 'absolute',
    left: 16,
    top: 14,
  },
  input: {
    height: 48,
    paddingLeft: 44,
    paddingRight: 16,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  inputWithRight: {
    paddingRight: 44,
  },
  rightIconBtn: {
    position: 'absolute',
    right: 8,
    top: 8,
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  forgot: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.60)',
  },
  loginBtn: {
    marginTop: 6,
    height: 52,
    borderRadius: 999,
    backgroundColor: stylesVars.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: stylesVars.primary,
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  loginBtnPressed: {
    transform: [{ scale: 0.98 }],
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#141414',
  },
  footer: {
    marginTop: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    fontWeight: '700',
    color: stylesVars.muted,
    textAlign: 'center',
  },
  footerLink: {
    color: stylesVars.secondary,
    fontWeight: '900',
  },
  errorText: {
    marginTop: 10,
    maxWidth: 420,
    textAlign: 'center',
    color: 'rgba(255,80,80,0.95)',
    fontSize: 12,
    fontWeight: '700',
  },
});

