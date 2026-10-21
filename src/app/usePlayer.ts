import { useEffect, useState } from 'react';
import { getCurrentTrackUri, getShuffle, notify, onShuffleChange, onSongChange, playTracks, setShuffle } from '../platform';

export function useNowPlaying(): string | undefined {
  const [uri, setUri] = useState(getCurrentTrackUri);
  useEffect(() => onSongChange(setUri), []);
  return uri;
}

/** Spotify's global shuffle mode — follows toggles from the player bar too. */
export function useShuffle(): [boolean, () => void] {
  const [on, setOn] = useState(getShuffle);
  useEffect(() => onShuffleChange(setOn), []);
  const toggle = async () => {
    const next = !on;
    setOn(next); // optimistic — the player bar updates a moment later
    const res = await setShuffle(next);
    if (!res.ok) {
      setOn(!next);
      notify(`Couldn't change shuffle: ${res.error.message}`, true);
    }
  };
  return [on, () => void toggle()];
}

/**
 * Play `uris` as one context starting at `index`, reporting failures as a Spotify toast.
 * `shuffle` makes sure Spotify shuffles the new context (see playTracks).
 */
export async function playList(uris: string[], index: number, shuffle = false): Promise<void> {
  const res = await playTracks(uris, index, undefined, { shuffle });
  if (!res.ok) notify(`Couldn't play: ${res.error.message}`, true);
}
