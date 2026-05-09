import { supabase } from '@/lib/supabase';

export type VerifyBankAccountResult =
  | { ok: true; account_name: string }
  | { ok: false; error: string };

/**
 * Verify NG bank account name via server-side proxy (Supabase Edge Function).
 *
 * IMPORTANT: Do NOT call the provider URL with secret key directly from the app.
 * Client-side secrets are always extractable from a cloned/bundled app.
 */
export async function verifyNgBankAccount(args: {
  bank_code: string;
  acc_no: string;
}): Promise<VerifyBankAccountResult> {
  const bank_code = String(args.bank_code || '').trim();
  const acc_no = String(args.acc_no || '').replace(/\D/g, '').slice(0, 10);
  if (!bank_code) return { ok: false, error: 'Select a bank.' };
  if (acc_no.length !== 10) return { ok: false, error: 'Enter a valid 10-digit account number.' };

  try {
    const { data, error } = await supabase.functions.invoke('verify-nuban', {
      body: { bank_code, acc_no },
    });
    if (error) return { ok: false, error: error.message };
    const account_name = String((data as any)?.account_name ?? '').trim();
    if (!account_name) return { ok: false, error: String((data as any)?.error ?? 'Account name not found.') };
    return { ok: true, account_name };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? 'Verification failed.') };
  }
}

