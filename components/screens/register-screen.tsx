import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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
import { Link, router } from 'expo-router';
import { vibeColors } from '@/components/vibepay/vibe-screen';
import UserPlus from '@/assets/vibepay/icons/solar-user-plus-bold.svg';
import { requestOtp } from '@/lib/auth/otp';

const BG_IMAGE = require('@/assets/vibepay/images/5PpI0crjJhK.png');

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referral, setReferral] = useState('');
  const [agree, setAgree] = useState(false);
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
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.center}
        contentContainerStyle={styles.centerContent}>
        <View style={styles.header}>
          <View style={styles.logo}>
            <UserPlus width={34} height={34} color="#fff" />
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join the VibePay community today.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row2}>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First Name"
              placeholderTextColor={vibeColors.muted}
              style={[styles.input, styles.inputHalf]}
            />
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last Name"
              placeholderTextColor={vibeColors.muted}
              style={[styles.input, styles.inputHalf]}
            />
          </View>

          <View style={styles.field}>
            <Ionicons name="at" size={18} color={vibeColors.muted} style={styles.leftIcon} />
            <TextInput
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              placeholder="Username"
              placeholderTextColor={vibeColors.muted}
              style={[styles.input, styles.inputPadLeft]}
            />
          </View>

          <View style={styles.field}>
            <Ionicons name="mail" size={18} color={vibeColors.muted} style={styles.leftIcon} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="Email address"
              placeholderTextColor={vibeColors.muted}
              style={[styles.input, styles.inputPadLeft]}
            />
          </View>

          <View style={styles.field}>
            <Ionicons name="lock-closed" size={18} color={vibeColors.muted} style={styles.leftIcon} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Password"
              placeholderTextColor={vibeColors.muted}
              style={[styles.input, styles.inputPadLeft]}
            />
          </View>

          <View style={styles.field}>
            <Ionicons name="lock-closed" size={18} color={vibeColors.muted} style={styles.leftIcon} />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="Confirm Password"
              placeholderTextColor={vibeColors.muted}
              style={[styles.input, styles.inputPadLeft]}
            />
          </View>

          <View style={styles.field}>
            <Ionicons name="people" size={18} color={vibeColors.muted} style={styles.leftIcon} />
            <TextInput
              value={referral}
              onChangeText={setReferral}
              placeholder="Referral ID (Optional)"
              placeholderTextColor={vibeColors.muted}
              style={[styles.input, styles.inputPadLeft]}
            />
          </View>

          <Pressable onPress={() => setAgree((s) => !s)} style={styles.termsRow}>
            <View style={[styles.checkbox, agree && styles.checkboxOn]}>
              {agree ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
            </View>
            <Text style={styles.termsText}>
              I agree to the{' '}
              <Link href="/terms-and-conditions" asChild>
                <Text style={styles.link}>Terms & Conditions</Text>
              </Link>{' '}
              and{' '}
              <Link href="/legal" asChild>
                <Text style={styles.link}>Privacy Policy</Text>
              </Link>
            </Text>
          </Pressable>

          <Pressable
            disabled={!agree}
            onPress={async () => {
              if (!agree) return;
              if (!firstName || !lastName || !username || !email || !password || !confirmPassword) {
                setError('Fill all required fields.');
                return;
              }
              if (password !== confirmPassword) {
                setError('Passwords do not match.');
                return;
              }
              setSubmitting(true);
              setError(null);
              try {
                const trimmedEmail = email.trim();
                const { error: authError } = await requestOtp(trimmedEmail);
                if (authError) {
                  setError(authError.message);
                  return;
                }
                router.replace({
                  pathname: '/email-verification',
                  params: {
                    email: trimmedEmail,
                    password,
                    fullName: `${firstName} ${lastName}`.trim(),
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    username: username.trim(),
                    referral: referral.trim(),
                    flow: 'register',
                  },
                });
              } finally {
                setSubmitting(false);
              }
            }}
            style={({ pressed }) => [
              styles.primaryBtn,
              (!agree || pressed) && { transform: [{ scale: pressed ? 0.98 : 1 }] },
              (!agree || submitting) && { opacity: 0.55 },
            ]}>
            <Text style={styles.primaryBtnText}>Create Account</Text>
            <Ionicons name="person-add" size={18} color="#141414" />
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Already have an account?{' '}
            <Link href="/login" asChild>
              <Text style={styles.footerLink}>Sign In</Text>
            </Link>
          </Text>
        </View>
      </KeyboardAvoidingView>
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
  overlayBase: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
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
    marginBottom: 18,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: vibeColors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: vibeColors.secondary,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: vibeColors.muted,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: vibeColors.card,
    borderWidth: 1,
    borderColor: vibeColors.border,
    borderRadius: 36,
    padding: 18,
  },
  row2: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  inputHalf: {
    flex: 1,
  },
  field: {
    position: 'relative',
    marginBottom: 12,
  },
  leftIcon: {
    position: 'absolute',
    left: 16,
    top: 15,
  },
  input: {
    height: 48,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  inputPadLeft: {
    paddingLeft: 44,
  },
  termsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: vibeColors.primary,
    borderColor: vibeColors.primary,
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.60)',
  },
  link: {
    color: vibeColors.primary,
    fontWeight: '800',
  },
  primaryBtn: {
    marginTop: 10,
    height: 52,
    borderRadius: 999,
    backgroundColor: vibeColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: vibeColors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#141414',
  },
  footer: {
    marginTop: 14,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    fontWeight: '700',
    color: vibeColors.muted,
    textAlign: 'center',
  },
  footerLink: {
    color: vibeColors.secondary,
    fontWeight: '900',
  },
  errorText: {
    marginTop: 10,
    maxWidth: 440,
    textAlign: 'center',
    color: 'rgba(255,80,80,0.95)',
    fontSize: 12,
    fontWeight: '700',
  },
});

