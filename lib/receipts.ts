import { supabase } from '@/lib/supabase';

function safeExtFromUri(uri: string): string {
  const m = uri.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)(\?|#|$)/);
  return m?.[1] ?? 'jpg';
}

async function readLocalUriAsBytes(localUri: string): Promise<{ bytes: Uint8Array; contentType?: string }> {
  // Prefer the modern Expo SDK 54 API (avoids deprecated readAsStringAsync).
  try {
    const mod = (await import('expo-file-system')) as typeof import('expo-file-system');
    const File = (mod as any).File as any;
    if (typeof File === 'function') {
      const f = new File({ uri: localUri } as any);
      const bytes = (await f.bytes()) as Uint8Array;
      const contentType = typeof f.type === 'string' && f.type ? (f.type as string) : undefined;
      return { bytes, contentType };
    }
  } catch {
    // fall through to fetch-based method
  }

  // Fallback: fetch(uri) works on some platforms for file:// URIs.
  const res = await fetch(localUri);
  const blob = await res.blob();
  const buf = await blob.arrayBuffer();
  return { bytes: new Uint8Array(buf), contentType: blob.type || undefined };
}

export async function uploadReceiptAndCreatePurchase(args: {
  userId: string;
  amountUsd: number;
  paymentMethod: 'ngn' | 'ghs' | 'usdt';
  purchaseType: 'deposit_wallet' | 'gas_fee_topup';
  localUri: string;
}): Promise<{ ok: boolean; error?: string; proofUrl?: string; purchaseId?: string }> {
  const { userId, amountUsd, paymentMethod, purchaseType, localUri } = args;

  let bytes: Uint8Array;
  let contentType: string | undefined;
  try {
    const r = await readLocalUriAsBytes(localUri);
    bytes = r.bytes;
    contentType = r.contentType;
  } catch (e) {
    return {
      ok: false,
      error: String((e as Error)?.message ?? 'Could not read receipt file for upload.'),
    };
  }

  const ext = safeExtFromUri(localUri);
  const path = `${userId}/${Date.now()}.${ext}`;

  const up = await supabase.storage.from('receipts').upload(path, bytes, {
    contentType: contentType || `image/${ext}`,
    upsert: false,
  });
  if (up.error) return { ok: false, error: up.error.message };

  // Store object path (admin can view in Storage). Also store a public URL if bucket is public.
  const pub = supabase.storage.from('receipts').getPublicUrl(path);
  const proofUrl = pub.data?.publicUrl ?? null;

  const { data: purchaseRow, error: insErr } = await supabase
    .from('purchases')
    .insert({
      user_id: userId,
      purchase_type: purchaseType,
      status: 'pending',
      scroll_points: 0,
      amount_usd: amountUsd,
      payment_method: paymentMethod,
      proof_image_url: proofUrl ?? path,
    })
    .select('id')
    .maybeSingle();
  if (insErr) return { ok: false, error: insErr.message };

  return { ok: true, proofUrl: proofUrl ?? undefined, purchaseId: (purchaseRow as any)?.id ?? undefined };
}

