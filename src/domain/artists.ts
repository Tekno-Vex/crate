// Spotify collapses multiple artist tags into one string ("A, B"). Split it back carefully.

/** Artist names that legitimately contain a separator. Users can extend this in settings (M2). */
export const DEFAULT_ARTIST_EXCEPTIONS = [
  'Tyler, The Creator',
  'Earth, Wind & Fire',
  'Crosby, Stills, Nash & Young',
  'Crosby, Stills & Nash',
  'Emerson, Lake & Palmer',
  'Peter, Paul and Mary',
  'Blood, Sweat & Tears',
  'Me First and the Gimme Gimmes',
  'AC/DC',
];

const SEPARATORS = /\s*;\s*|,\s+|\s+\/\s+|\u0000|\s+(?:feat\.?|ft\.?|featuring)\s+/i;

export function splitArtists(
  display: string,
  exceptions: readonly string[] = DEFAULT_ARTIST_EXCEPTIONS,
): string[] {
  let text = display.trim();
  if (!text) return [];

  // Protect exception names by swapping them for placeholders before splitting.
  const protectedNames: string[] = [];
  for (const name of exceptions) {
    const idx = text.toLowerCase().indexOf(name.toLowerCase());
    if (idx === -1) continue;
    const token = `\u0001${protectedNames.length}\u0001`;
    protectedNames.push(text.slice(idx, idx + name.length));
    text = text.slice(0, idx) + token + text.slice(idx + name.length);
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(SEPARATORS)) {
    const restored = raw.replace(/\u0001(\d+)\u0001/g, (_, i) => protectedNames[Number(i)] ?? '');
    const name = restored.trim();
    const k = name.toLowerCase();
    if (name && !seen.has(k)) {
      seen.add(k);
      out.push(name);
    }
  }
  return out;
}
