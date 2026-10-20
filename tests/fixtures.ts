import type { Track } from '../src/domain/model';

let idx = 0;

/** Build a Track with sensible defaults for tests. */
export function track(p: Partial<Track> & { title: string }): Track {
  const artistDisplay = p.artistDisplay ?? p.artists?.join(', ') ?? 'Artist';
  return {
    uri: p.uri ?? `spotify:local:${encodeURIComponent(artistDisplay)}:${encodeURIComponent(p.album ?? 'Album')}:${encodeURIComponent(p.title)}:200`,
    artists: p.artists ?? [artistDisplay],
    artistDisplay,
    album: p.album ?? 'Album',
    durationMs: p.durationMs ?? 200_000,
    source: 'spotify',
    originalIndex: p.originalIndex ?? idx++,
    ...p,
  };
}

/** Synthetic library generator for scale tests (M1: 20k tracks). */
export function syntheticLibrary(albumCount: number, tracksPerAlbum: number): Track[] {
  const out: Track[] = [];
  let i = 0;
  for (let a = 0; a < albumCount; a++) {
    for (let t = 0; t < tracksPerAlbum; t++) {
      out.push(
        track({
          title: `Song ${t + 1}`,
          album: `Album ${a}`,
          artists: [`Artist ${a % 500}`],
          trackNumber: t + 1,
          originalIndex: i++,
        }),
      );
    }
  }
  return out;
}

/**
 * A raw LocalFilesAPI.getTracks() item exactly as Spotify 1.3.5.3058 (Windows) returned it in
 * spike S1 (2026-10-20). addedAt is a real Date in the live client.
 */
export function realLocalTrack(): Record<string, unknown> {
  return {
    type: 'track',
    uid: '1',
    addedAt: new Date('2026-09-03T16:54:24.000Z'),
    uri: 'spotify:local:Addaura:Burning+For+The+Ancient:City+Light+%28In+Still+Dark+Forenoon+Silence%29:624',
    name: 'City Light (In Still Dark Forenoon Silence)',
    album: {
      type: 'album',
      uri: 'spotify:local:Addaura:Burning+For+The+Ancient',
      name: 'Burning For The Ancient',
      artist: { type: 'artist', uri: 'spotify:local:Addaura', name: 'Addaura' },
      images: [
        {
          url: 'spotify:localfileimage:C%3A%5CUsers%5Ckathi%5CMusic%5CiTunes%5CiTunes%20Media%5CMusic%5CAddaura%5CBurning%20For%20The%20Ancient%5C01%20City%20Light%20%28In%20Still%20Dark%20Forenoo.mp3',
          label: 'standard',
        },
      ],
    },
    artists: [{ type: 'artist', uri: 'spotify:local:Addaura', name: 'Addaura' }],
    discNumber: 0,
    trackNumber: 1,
    duration: { milliseconds: 624000 },
    isExplicit: false,
    isLocal: true,
    isPlayable: true,
    is19PlusOnly: false,
    isBanned: false,
  };
}

/** Real local URIs with encoded characters, from spike S1 on 1.3.5 (2026-10-20). */
export const REAL_LOCAL_URIS = [
  'spotify:local:Addaura:Burning+For+The+Ancient:City+Light+%28In+Still+Dark+Forenoon+Silence%29:624',
  'spotify:local:Addaura:Burning+For+The+Ancient:The+Muses+Thro%27+Their+Bowers:863',
  'spotify:local:Agalloch:Tomorrow+Will+Never+Come:The+Death+of+Man+%28Version+III%29:178',
  'spotify:local:Alcest:Tristesse+Hivernale:La+For%C3%AAt+de+cristal:278',
  'spotify:local:Alcest:Tristesse+Hivernale:En+m%C3%A9moire+aux+valeureux+guerriers:324',
  'spotify:local:Alcest:Tristesse+Hivernale:La+Mort+plane+sur+ces+contr%C3%A9es+glac%C3%A9es:451',
  'spotify:local:Antigama:Discomfort:Who+Is+My+Enemy%3F:103',
  'spotify:local:Asbestosdeath:Dejection+%2F+Unclean:Anguish:293',
  'spotify:local:At+The+Drive-In:El+Gran+Orgo+%28EP%29:Give+It+A+Name:156',
  'spotify:local:At+The+Drive-In:El+Gran+Orgo+%28EP%29:Winter+Month+Novelty:220',
  'spotify:local:Black+Kray:Crack+Cloud%24+Over+Arts+Kitchen:Drip:175',
  'spotify:local:Black+Kray:Crack+Cloud%24+Over+Arts+Kitchen:Drop+%28feat.+Luckaleannn%29:185',
  'spotify:local:Black+Kray:Crack+Cloud%24+Over+Arts+Kitchen:Crack+Cloud%24+Over+Arts+Kitchen+%28Intro%29:67',
  'spotify:local:Black+Kray:Crack+Cloud%24+Over+Arts+Kitchen:Cunt+Hoe%24+%28feat.+Sacrivice%29:152',
  'spotify:local:Black+Kray:Crack+Cloud%24+Over+Arts+Kitchen:Alicia+Key%24+%2F+80+Dime+Bag%24+%28Remix%29+%5Bfeat.+Chris+Travis+%26+Xavier+Wulf%5D:313',
  'spotify:local:Black+Kray:Crack+Cloud%24+Over+Arts+Kitchen:Daydre4m:222',
  'spotify:local:Black+Kray:Crack+Cloud%24+Over+Arts+Kitchen:Broke+De%24igna:88',
  'spotify:local:Black+Kray:Crack+Cloud%24+Over+Arts+Kitchen:30+Dollah:247',
  'spotify:local:Black+Kray:Crack+Cloud%24+Over+Arts+Kitchen:Ice+Cream+%26+Swishas+%28feat.+Wiz+Mack%29:185',
  'spotify:local:Black+Kray:Crack+Cloud%24+Over+Arts+Kitchen:92+Brown+Boi:115',
];
