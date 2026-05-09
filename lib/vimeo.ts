import { supabase } from '@/lib/supabase';

export type VimeoVideo = {
  id: string;
  title: string;
  thumbnail_720_url: string | null;
  embed_url: string | null;
  duration: number;
  creator_handle: string;
  author_name: string | null;
};

/** First / last pools for stable, varied display handles when Vimeo only exposes numeric slugs. */
const DISPLAY_FIRST = [
  'Alex', 'Jordan', 'Riley', 'Sam', 'Quinn', 'Morgan', 'Casey', 'Avery', 'Jamie', 'Reese',
  'Noah', 'Leo', 'Maya', 'Zoe', 'Luna', 'Kai', 'Nova', 'River', 'Sky', 'Blake',
  'Emery', 'Rowan', 'Sage', 'Eden', 'Phoenix', 'Indigo', 'Marlow', 'Harper', 'Finley', 'Drew',
];

const DISPLAY_LAST = [
  'Chen', 'Patel', 'Kim', 'Singh', 'Park', 'Reyes', 'Silva', 'Costa', 'Nunes', 'Bauer',
  'Hayes', 'Brooks', 'Foster', 'Gray', 'Ellis', 'Murray', 'Rowe', 'Vaughn', 'Abbott', 'Keane',
  'Dalton', 'Mercer', 'Wilder', 'Summers', 'Knight', 'Drake', 'Cross', 'Palmer', 'Rhodes', 'Stone',
];

function hashVideoId(videoId: string): number {
  let h = 2166136261;
  for (let i = 0; i < videoId.length; i++) {
    h ^= videoId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function stableDisplayAlias(videoId: string): string {
  const u = hashVideoId(videoId);
  const fi = u % DISPLAY_FIRST.length;
  const li = Math.floor(u / DISPLAY_FIRST.length) % DISPLAY_LAST.length;
  return `@${DISPLAY_FIRST[fi]}${DISPLAY_LAST[li]}`;
}

function slugIsNumericLike(slug: string): boolean {
  const s = slug.replace(/^@/, '').trim();
  if (!s) return true;
  if (/^\d+$/.test(s)) return true;
  if (/^creator_\d+$/i.test(s)) return true;
  return false;
}

function handleFromAuthorName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  const t = name.trim();
  if (!/[a-zA-Z]/.test(t)) return null;
  const parts = t.split(/\s+/).filter(Boolean).slice(0, 3);
  const compact = parts
    .map((p) => {
      const letters = p.replace(/[^a-zA-Z0-9]/g, '');
      if (!letters) return '';
      return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
    })
    .filter(Boolean)
    .join('');
  if (!compact || /^[0-9]+$/.test(compact)) return null;
  return `@${compact}`;
}

/**
 * Display handle for the watch feed: real creator names when possible; never a bare numeric @123… slug.
 */
export function resolveFeedCreatorHandle(v: VimeoVideo): string {
  const fromAuthor = handleFromAuthorName(v.author_name);
  if (fromAuthor) return fromAuthor;

  const raw = v.creator_handle?.trim() ?? '';
  const slug = raw.replace(/^@/, '');
  if (slug && !slugIsNumericLike(slug)) {
    return raw.startsWith('@') ? raw : `@${slug}`;
  }

  return stableDisplayAlias(v.id);
}

export const fetchVimeoVideos = async (
  limit = 20
): Promise<{ videos: VimeoVideo[]; error?: string }> => {
  const { data, error } = await supabase.functions.invoke('vimeo-videos', {
    method: 'POST',
    body: { limit },
  } as any);
  if (error) return { videos: [], error: error.message };
  if (data?.error) return { videos: [], error: String(data.error) };

  const vids = (data?.videos ?? []) as any[];
  return {
    videos: vids
      .map((v) => ({
        id: String(v.id),
        title: String(v.title ?? ''),
        thumbnail_720_url: v.thumbnail_720_url ? String(v.thumbnail_720_url) : null,
        embed_url: v.embed_url ? String(v.embed_url) : null,
        duration: Number(v.duration ?? 0),
        creator_handle:
          typeof v.creator_handle === 'string' && v.creator_handle.trim()
            ? String(v.creator_handle).trim()
            : `@creator_${String(v.id)}`,
        author_name:
          typeof v.author_name === 'string' && v.author_name.trim()
            ? String(v.author_name).trim()
            : null,
      }))
      .filter((v) => Boolean(v.id && v.embed_url)),
  };
};

export default { fetchVimeoVideos, resolveFeedCreatorHandle };

