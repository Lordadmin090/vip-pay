// Supabase Edge Function (Deno)
// Fetches Vimeo videos using *public JSON feeds* + oEmbed validation.
//
// Why:
// - `api.vimeo.com` can be region-restricted or rate-limited from Edge regions.
// - Vimeo public feeds (`vimeo.com/api/v2/...`) are broadly available.
// - oEmbed validation prevents "Sorry, this video does not exist" in the player.
//
// Request:
// - GET  /vimeo-videos?limit=20
// - POST { limit?: number }
// Response: { videos: Array<{ id,title,thumbnail_720_url,embed_url,duration,creator_handle,author_name }> }

let cachedVideos: { videos: unknown[]; expiresAtMs: number } | null = null;

function json(data: unknown, status = 200) {
  const reqId = crypto?.randomUUID?.() ?? String(Date.now());
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "x-vidpay-request-id": reqId },
  });
}

type OutVideo = {
  id: string;
  title: string;
  thumbnail_720_url: string | null;
  embed_url: string | null;
  duration: number;
  creator_handle: string;
  author_name: string | null;
};

function creatorFromOEmbed(data: unknown, videoId: string): { creator_handle: string; author_name: string | null } {
  const d = data as Record<string, unknown>;
  const author_name_raw = d.author_name;
  const author_name =
    typeof author_name_raw === "string" && author_name_raw.trim() ? author_name_raw.trim() : null;
  const author_url = typeof d.author_url === "string" ? d.author_url.trim() : "";

  const reservedPath = new Set([
    "channels",
    "groups",
    "albums",
    "showcase",
    "categories",
    "category",
    "tag",
    "explore",
    "watch",
    "trending",
    "staffpicks",
    "ondemand",
  ]);

  let slug = "";
  try {
    const u = new URL(author_url);
    const parts = u.pathname
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter(Boolean);
    const first = parts[0] ?? "";
    const lower = first.toLowerCase();
    // Typical profile: vimeo.com/username (avoid /channels/..., etc.)
    if (
      first &&
      !reservedPath.has(lower) &&
      /^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(first)
    ) {
      slug = first;
    }
  } catch {
    // ignore
  }

  // Numeric-only profile segments are not usable as a readable handle — prefer author_name below.
  if (slug && /^\d+$/.test(slug)) slug = "";

  if (!slug && author_name) {
    const base = author_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 28);
    slug = base || `creator_${videoId}`;
  }

  if (!slug) slug = `creator_${videoId.replace(/[^a-zA-Z0-9]/g, "").slice(-12) || "vimeo"}`;

  return { creator_handle: `@${slug}`, author_name };
}

async function fetchOEmbed(id: string): Promise<Pick<OutVideo, "title" | "thumbnail_720_url" | "creator_handle" | "author_name"> | null> {
  // oEmbed returns 200 only for public/embeddable videos.
  // Use the *player* URL so Vimeo can reject non-embeddable privacy settings.
  const url = `https://vimeo.com/api/oembed.json?url=https://player.vimeo.com/video/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", "user-agent": "vidpay/1.0 (supabase-edge)" },
  });
  if (!res.ok) return null;
  const txt = await res.text().catch(() => "");
  const data = (() => {
    try {
      return JSON.parse(txt);
    } catch {
      return null;
    }
  })() as any;
  if (!data) return null;
  const title = typeof data.title === "string" ? data.title : "";
  // If the video can't be embedded, oEmbed may return HTML without a playable iframe.
  const html = typeof data.html === "string" ? data.html : "";
  if (!html.includes("player.vimeo.com/video/")) return null;
  const thumb =
    typeof data.thumbnail_url === "string"
      ? data.thumbnail_url
      : typeof data.thumbnail_url_with_play_button === "string"
        ? data.thumbnail_url_with_play_button
        : null;
  const { creator_handle, author_name } = creatorFromOEmbed(data, id);
  return { title: title || "Vimeo", thumbnail_720_url: thumb, creator_handle, author_name };
}

async function fetchFallbackVideos(limit: number): Promise<OutVideo[]> {
  // Public, unauthenticated endpoint (much less rate-limited).
  // Docs are unofficial but stable: https://vimeo.com/api/v2/
  const page = randInt(1, 25);
  const urls = [
    `https://vimeo.com/api/v2/category/entertainment/videos.json?page=${page}&per_page=${limit}`,
    `https://vimeo.com/api/v2/channel/staffpicks/videos.json?page=${page}&per_page=${limit}`,
    `https://vimeo.com/api/v2/channel/documentary/videos.json?page=${page}&per_page=${limit}`,
  ];

  for (const u of urls) {
    const res = await fetch(u, {
      method: "GET",
      headers: {
        Accept: "application/json",
        // Some CDNs are pickier without a UA.
        "user-agent": "vidpay/1.0 (supabase-edge)",
      },
    });
    if (!res.ok) continue;
    const txt = await res.text().catch(() => "");
    const list = (() => {
      try {
        return JSON.parse(txt);
      } catch {
        return null;
      }
    })() as any;
    if (!Array.isArray(list)) continue;
    const ids = shuffle(list)
      .map((v: any) => String(v?.id ?? ""))
      .filter(Boolean);

    const out: OutVideo[] = [];
    // Validate with oEmbed (prevents "video doesn't exist").
    // Do a small concurrent pool to keep it fast.
    const pool = 6;
    let cursor = 0;
    const runOne = async () => {
      while (cursor < ids.length && out.length < limit) {
        const id = ids[cursor++];
        const meta = await fetchOEmbed(id);
        if (!meta) continue;
        out.push({
          id,
          title: meta.title,
          thumbnail_720_url: meta.thumbnail_720_url,
          embed_url: `https://player.vimeo.com/video/${encodeURIComponent(id)}`,
          duration: 0,
          creator_handle: meta.creator_handle,
          author_name: meta.author_name,
        });
      }
    };
    await Promise.all(Array.from({ length: pool }).map(() => runOne()));
    if (out.length) return out.slice(0, limit);
  }
  return [];
}

function randInt(min: number, maxInclusive: number) {
  const span = Math.max(1, maxInclusive - min + 1);
  const r =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
      : Math.random();
  return min + Math.floor(r * span);
}

function shuffle<T>(arr: T[]) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  let limit = Number(url.searchParams.get("limit") ?? 20);
  if (req.method === "POST") {
    try {
      const body = (await req.json().catch(() => null)) as { limit?: number } | null;
      if (body && typeof body.limit !== "undefined") limit = Number(body.limit);
    } catch {
      // ignore
    }
  }
  limit = Math.min(50, Math.max(5, Number.isFinite(limit) ? limit : 20));

  try {
    const now = Date.now();
    if (cachedVideos && cachedVideos.expiresAtMs - now > 5_000) return json({ videos: cachedVideos.videos });

    const videos = await fetchFallbackVideos(limit);
    cachedVideos = { videos, expiresAtMs: Date.now() + 60_000 };
    if (!videos.length) return json({ videos: [], error: "No Vimeo videos available right now. Please retry." });
    return json({ videos });
  } catch (e) {
    return json({ videos: [], error: String((e as Error)?.message ?? "Unknown error") });
  }
});

