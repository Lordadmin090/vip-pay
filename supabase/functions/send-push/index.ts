// Supabase Edge Function (Deno)
// Sends push notifications to all registered Expo tokens for a user.
//
// Secrets required:
// - EXPO_ACCESS_TOKEN (optional but recommended for higher rate limits / reliability)
//
// Request body:
// { user_id: string, title: string, body: string, data?: object }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Req = { user_id?: string; title?: string; body?: string; data?: Record<string, unknown> };

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN") || "";

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let body: Req;
  try {
    body = (await req.json()) as Req;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const user_id = String(body.user_id || "").trim();
  const title = String(body.title || "").trim();
  const msgBody = String(body.body || "").trim();
  if (!user_id || !title || !msgBody) return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });

  const { data: tokens, error } = await supabase
    .from("push_tokens")
    .select("expo_push_token")
    .eq("user_id", user_id);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  const expoTokens = (tokens ?? [])
    .map((t: any) => String(t.expo_push_token || "").trim())
    .filter(Boolean);

  if (!expoTokens.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });

  const payloads = expoTokens.map((to) => ({
    to,
    sound: "default",
    title,
    body: msgBody,
    data: body.data ?? {},
  }));

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {}),
    },
    body: JSON.stringify(payloads),
  });

  const json = await res.json().catch(() => null);
  return new Response(JSON.stringify({ ok: res.ok, status: res.status, response: json }), {
    status: res.ok ? 200 : 502,
    headers: { "content-type": "application/json" },
  });
});

