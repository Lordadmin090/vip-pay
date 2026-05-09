import { supabase } from '@/lib/supabase';

export async function requestOtp(email: string) {
  const trimmed = email.trim();

  return await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      shouldCreateUser: true,
    },
  });
}

export async function verifyOtp(email: string, codeOrToken: string) {
  const trimmedEmail = email.trim();
  const raw = codeOrToken.trim();

  // Supabase supports:
  // - Email OTP codes (usually 6 digits): verifyOtp({ email, token, type: 'email' })
  // - Magic link tokens (token_hash from URL): verifyOtp({ token_hash, type: 'magiclink' | 'signup' })
  const looksLikeOtp = /^\d{6}$/.test(raw);

  if (looksLikeOtp) {
    return await supabase.auth.verifyOtp({
      email: trimmedEmail,
      token: raw,
      type: 'email',
    });
  }

  // If the project is configured to send magic links (not 6-digit codes),
  // allow users to paste the token_hash and verify it.
  const first = await supabase.auth.verifyOtp({
    token_hash: raw,
    type: 'magiclink',
  } as any);
  if (!first.error) return first;

  // Some projects send "signup" links for new users.
  return await supabase.auth.verifyOtp({
    token_hash: raw,
    type: 'signup',
  } as any);
}
