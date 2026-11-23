import { MEDIA_MANIFEST } from "@/data/mediaManifest";

// Bundled copies of every remote photo the app can show (see
// scripts/bundle-media.mjs). Resolving through here means batch and product
// pictures still render from a flash drive with no Supabase keys and no
// internet, and hosts that block hotlinking (e.g. the Orchard Road cover) work.
const BASE = import.meta.env.BASE_URL || "/";

/** Swap a remote URL or Supabase storage path for its bundled copy. */
export function bundledMedia(src?: string | null): string | undefined {
  if (!src) return undefined;
  const key = src.trim();
  const mapped = MEDIA_MANIFEST[key];
  if (!mapped) return src;
  return `${BASE}${mapped}`;
}
