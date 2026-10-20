// String normalization for matching and stable keys.

/**
 * Lowercase, Unicode-normalized, accent-free, whitespace-collapsed. Keeps non-Latin letters.
 * Only Latin combining diacritics (U+0300–U+036F) are stripped, then we recompose — stripping all
 * marks would turn ペ into ヘ and merge distinct Japanese titles.
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]+/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** URL-safe key segment. Letters/numbers of any script survive; everything else becomes "-". */
export function slug(input: string): string {
  const s = normalizeText(input)
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return s || '_';
}

/** Stable album key. Tier 1 has no album artist, so it's usually just the title. */
export function albumKey(albumTitle: string, albumArtist?: string, variant?: string): string {
  let key = slug(albumTitle);
  if (albumArtist) key += `~${slug(albumArtist)}`;
  if (variant) key += `~${variant}`;
  return key;
}

export function artistKey(name: string): string {
  return slug(name);
}

const DISC_SUFFIX =
  /\s*[([]\s*(?:disc|disk|cd)\s*(\d{1,2})(?:\s*(?:of|\/)\s*\d{1,2})?\s*[)\]]\s*$|\s+-?\s*(?:disc|disk|cd)\s*(\d{1,2})\s*$/i;

/**
 * Many rips encode the disc in the album title: "Album (Disc 2)", "Album [CD1]", "Album - Disc 3".
 * Returns the base title and the disc number if one was found.
 */
export function stripDiscSuffix(albumTitle: string): { title: string; disc?: number } {
  const m = DISC_SUFFIX.exec(albumTitle);
  if (!m) return { title: albumTitle };
  const disc = Number(m[1] ?? m[2]);
  const title = albumTitle.slice(0, m.index).trim();
  return title ? { title, disc } : { title: albumTitle };
}
