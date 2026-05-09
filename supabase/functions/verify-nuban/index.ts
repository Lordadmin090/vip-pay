// Supabase Edge Function (Deno)
// Hides the upstream API key from the mobile app.
//
// Env required on Supabase:
// - NUBAN_API_KEY: the token part used in `https://app.nuban.com.ng/api/<KEY>`
//
// Deploy:
// supabase functions deploy verify-nuban
// supabase secrets set NUBAN_API_KEY="NUBAN-...."

type VerifyRequest = { bank_code?: string; acc_no?: string };

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const key = Deno.env.get('NUBAN_API_KEY') || '';
  if (!key) {
    return new Response(JSON.stringify({ error: 'Server not configured (missing NUBAN_API_KEY).' }), { status: 500 });
  }

  let body: VerifyRequest;
  try {
    body = (await req.json()) as VerifyRequest;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), { status: 400 });
  }

  const bank_code = String(body.bank_code || '').trim();
  const acc_no = String(body.acc_no || '').replace(/\D/g, '').slice(0, 10);
  if (!bank_code) return new Response(JSON.stringify({ error: 'Missing bank_code.' }), { status: 400 });
  if (acc_no.length !== 10) return new Response(JSON.stringify({ error: 'Account number must be 10 digits.' }), { status: 400 });

  const url = `https://app.nuban.com.ng/api/${encodeURIComponent(key)}?bank_code=${encodeURIComponent(bank_code)}&acc_no=${encodeURIComponent(acc_no)}`;

  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Upstream failed (${res.status}).` }), { status: 502 });
    }
    const data = (await res.json()) as any;
    const first = Array.isArray(data) ? data[0] : data;
    const account_name = String(first?.account_name ?? '').trim();
    if (!account_name) {
      return new Response(JSON.stringify({ error: 'Account name not found.' }), { status: 200 });
    }
    return new Response(JSON.stringify({ account_name }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? 'Fetch failed.') }), { status: 502 });
  }
});

