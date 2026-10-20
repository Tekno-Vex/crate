import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { pickHeaderColor } from '../../domain/color';
import { buildLibrary } from '../../domain/grouping';
import type { Library } from '../../domain/model';
import { hasReliableNumbering } from '../../domain/ordering';
import {
  copyToClipboard,
  describeApi,
  getLocalSourcesRaw,
  extractColors,
  getPlayerSnapshot,
  listReactComponents,
  sampleImagePixels,
  getLocalTracksRaw,
  getVersions,
  listPlatformApis,
  notify,
  playTracks,
  type PlayStrategy,
} from '../../platform';
import { fieldInventory, mapLocalTracks } from '../../platform/mapLocalTrack';
import { probeHttp, probeWebSocket, type ReachabilityResult } from '../../platform/probes';

// The bridge between Claude Code and the live Spotify client. Each probe maps to a spike in
// docs/SPIKES.md. "Copy report" produces JSON Vivek pastes back into Claude Code.

const HELPER_PORT = 47823;

interface Report {
  generatedAt: string;
  versions: ReturnType<typeof getVersions>;
  platformApis: string[];
  localish: Record<string, string[]>;
  s1?: unknown;
  s2?: ReachabilityResult[];
  s7?: unknown;
  s3?: { strategy: PlayStrategy; ok: boolean; message?: string; played?: string[]; snapshot?: unknown }[];
}

function Section({ title, spike, children }: { title: string; spike?: string; children: ReactNode }) {
  return (
    <section className="crate-diag__section">
      <h2>
        {title} {spike && <span className="crate-badge">{spike}</span>}
      </h2>
      {children}
    </section>
  );
}

function Json({ value }: { value: unknown }) {
  return <pre className="crate-pre">{JSON.stringify(value, null, 2)}</pre>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Second-round S1 questions (2026-10-20): album artist semantics, artist splitting, numbering gaps, S6 sources. */
async function s1FollowUp(raws: any[], lib: Library) {
  const names = (r: any): string[] => (Array.isArray(r?.artists) ? r.artists.map((a: any) => a?.name) : []);
  const albumArtistDiffers = raws.filter((r) => r?.album?.artist?.name && r.album.artist.name !== names(r)[0]);
  const multiArtist = raws.filter((r) => names(r).length > 1);
  const weak = lib.albums.filter((a) => !hasReliableNumbering(a.tracks));
  const dupNumbered = lib.albums.filter((a) => {
    const seen = new Set<string>();
    return a.tracks.some((t) => {
      if (t.trackNumber === undefined) return false;
      const k = `${t.discNumber ?? 1}-${t.trackNumber}`;
      return seen.has(k) || !seen.add(k);
    });
  });
  const paths = lib.tracks.map((t) => t.filePath).filter((p): p is string => !!p);
  const prefix = paths.reduce((acc, p) => {
    let i = 0;
    while (i < acc.length && acc[i] === p[i]) i++;
    return acc.slice(0, i);
  }, paths[0] ?? '');
  const sources = await getLocalSourcesRaw();
  return {
    albumArtistDiffersFromFirstTrackArtist: {
      count: albumArtistDiffers.length,
      samples: albumArtistDiffers.slice(0, 10).map((r) => ({
        album: r.album.name,
        albumArtist: r.album.artist.name,
        trackArtists: names(r),
      })),
    },
    multiArtistTracks: { count: multiArtist.length, samples: multiArtist.slice(0, 8).map(names) },
    commaInSingleArtist: raws.filter((r) => names(r).length === 1 && /, |; | & /.test(names(r)[0] ?? '')).slice(0, 8).map((r) => names(r)[0]),
    weakNumberingAlbums: weak.slice(0, 30).map((a) => ({
      title: a.title,
      artist: a.albumArtist,
      tracks: a.tracks.length,
      numbered: a.tracks.filter((t) => t.trackNumber !== undefined).length,
    })),
    albumsWithDuplicateTrackNumbers: dupNumbered.slice(0, 15).map((a) => ({
      title: a.title,
      artists: a.artists.slice(0, 5),
      tracks: a.tracks.length,
    })),
    tracksWithFilePath: paths.length,
    commonPathPrefix: prefix,
    sources: sources.ok ? sources.value : sources.error,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function DiagnosticsPage() {
  const base = useMemo(() => {
    const apis = listPlatformApis();
    const localish = Object.fromEntries(
      apis.filter((n) => /local|librar|playlist|player|collection/i.test(n)).map((n) => [n, describeApi(n)]),
    );
    return { versions: getVersions(), platformApis: apis, localish };
  }, []);

  const [report, setReport] = useState<Report>(() => ({ generatedAt: new Date().toISOString(), ...base }));
  const [busy, setBusy] = useState<string | null>(null);
  const [sampleUris, setSampleUris] = useState<string[]>([]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const probeLocalFiles = () =>
    run('s1', async () => {
      const start = performance.now();
      const res = await getLocalTracksRaw();
      const ms = Math.round(performance.now() - start);
      if (!res.ok) {
        setReport((r) => ({ ...r, s1: { ok: false, ms, error: res.error } }));
        return;
      }
      const raws = res.value;
      const tracks = mapLocalTracks(raws);
      const lib = buildLibrary(tracks);
      const followUp = await s1FollowUp(raws, lib);
      const imageSchemes = [...new Set(tracks.map((t) => t.imageUrl?.split(':').slice(0, 2).join(':') ?? 'none'))];
      // S3: tracks 3, 2, 1 of an album with ≥4 tracks. Spotify's own Local Files order would go
      // 3 → 4 on Next; if it honours our list it goes 3 → 2.
      const s3Album = lib.albums.find((a) => a.tracks.length >= 4 && hasReliableNumbering(a.tracks));
      const s3Tracks = s3Album ? s3Album.tracks.slice(0, 3) : tracks.slice(0, 3);
      setSampleUris(s3Tracks.map((t) => t.uri).reverse());
      setReport((r) => ({
        ...r,
        s1: {
          ok: true,
          ms,
          rawCount: raws.length,
          mappedCount: tracks.length,
          albumCount: lib.albums.length,
          albumsWithReliableNumbering: lib.albums.filter((a) => hasReliableNumbering(a.tracks)).length,
          tracksWithTrackNumber: tracks.filter((t) => t.trackNumber !== undefined).length,
          tracksWithDiscNumber: tracks.filter((t) => t.discNumber !== undefined).length,
          tracksWithAddedAt: tracks.filter((t) => t.addedAt !== undefined).length,
          imageSchemes,
          fieldInventory: fieldInventory(raws),
          rawSamples: raws.slice(0, 2),
          oddUris: tracks
            .map((t) => t.uri)
            .filter((u) => /%|[^\x20-\x7e]/.test(u))
            .slice(0, 20),
          followUp,
        },
      }));
    });

  const probeLocalhost = () =>
    run('s2', async () => {
      const results = [
        await probeHttp(`http://127.0.0.1:${HELPER_PORT}/v1/health`),
        await probeHttp(`http://localhost:${HELPER_PORT}/v1/health`),
        await probeWebSocket(`ws://127.0.0.1:${HELPER_PORT}/v1/ws`),
      ];
      setReport((r) => ({ ...r, s2: results }));
    });

  const playExperiment = (strategy: PlayStrategy) =>
    run(`s3-${strategy}`, async () => {
      if (sampleUris.length < 1) {
        notify('Run "Probe local files" first', true);
        return;
      }
      const res = await playTracks(sampleUris, 0, strategy);
      await new Promise((r) => setTimeout(r, 1500)); // let the player settle before reading state
      const snap = await getPlayerSnapshot();
      setReport((r) => ({
        ...r,
        s3: [
          ...(r.s3 ?? []).filter((x) => x.strategy !== strategy),
          {
            strategy,
            ok: res.ok,
            message: res.ok ? undefined : `${res.error.message} ${String(res.error.detail ?? '')}`,
            played: sampleUris,
            snapshot: snap.ok ? snap.value : snap.error,
          },
        ],
      }));
    });

  const probeColors = () =>
    run('s7', async () => {
      const res = await getLocalTracksRaw();
      if (!res.ok) {
        setReport((r) => ({ ...r, s7: { ok: false, error: res.error } }));
        return;
      }
      const albums = buildLibrary(mapLocalTracks(res.value)).albums.filter((a) => a.imageUrl).slice(0, 3);
      const covers: unknown[] = [];
      for (const a of albums) {
        const uri = a.tracks[0]!.uri;
        const ext = await extractColors(uri);
        const t0 = performance.now();
        const px = await sampleImagePixels(a.imageUrl!);
        covers.push({
          album: a.title,
          colorExtractor: ext.ok ? ext.value : ext.error,
          canvas: px.ok
            ? { ok: true, ms: Math.round(performance.now() - t0), color: pickHeaderColor(px.value) }
            : { ok: false, error: px.error },
        });
      }
      setReport((r) => ({ ...r, s7: { covers, reactComponents: listReactComponents() } }));
    });

  const copyReport = async () => {
    const full = { ...report, generatedAt: new Date().toISOString() };
    const ok = await copyToClipboard(JSON.stringify(full, null, 2));
    notify(ok ? 'Diagnostics report copied' : 'Copy failed — select the JSON below manually', !ok);
  };

  return (
    <section className="crate-page crate-diag">
      <header className="crate-toolbar">
        <h1 className="crate-h1">Diagnostics</h1>
        <div className="crate-spacer" />
        <button type="button" className="crate-btn" onClick={copyReport}>
          Copy report
        </button>
      </header>

      <Section title="Versions">
        <Json value={report.versions} />
      </Section>

      <Section title="Local files API" spike="S1">
        <p className="crate-muted">
          Reads every local track, inventories the fields Spotify exposes, and checks whether track/disc
          numbers exist. Large libraries may take a few seconds.
        </p>
        <button type="button" className="crate-btn" disabled={!!busy} onClick={probeLocalFiles}>
          {busy === 's1' ? 'Probing…' : 'Probe local files'}
        </button>
        {report.s1 !== undefined && <Json value={report.s1} />}
      </Section>

      <Section title="Localhost reachability" spike="S2">
        <p className="crate-muted">
          Tries the future Crate Helper port ({HELPER_PORT}). With no helper running, "refused-or-offline"
          is the good answer; "blocked-by-csp" means Spotify forbids it.
        </p>
        <button type="button" className="crate-btn" disabled={!!busy} onClick={probeLocalhost}>
          {busy === 's2' ? 'Testing…' : 'Test localhost reachability'}
        </button>
        {report.s2 && <Json value={report.s2} />}
      </Section>

      <Section title="Playback experiments" spike="S3">
        <p className="crate-muted">
          Plays tracks 3, 2, 1 of one album (reversed on purpose) and records what the player reports
          as current/next. After each, press Next once: does it go to track 2 (our order) or track 4
          (Spotify's order)? Note what "Playing from" says.
        </p>
        <div className="crate-row">
          {(['local-files-context', 'app-context'] as PlayStrategy[]).map((s) => (
            <button key={s} type="button" className="crate-btn crate-btn--ghost" disabled={!!busy} onClick={() => playExperiment(s)}>
              {s}
            </button>
          ))}
        </div>
        {sampleUris.length > 0 && <Json value={{ sampleUris }} />}
        {report.s3 && <Json value={report.s3} />}
      </Section>

      <Section title="Cover colors + native components" spike="S7">
        <p className="crate-muted">
          Tries Spotify's colorExtractor and our canvas fallback on three covers, and lists
          Spicetify.ReactComponent primitives.
        </p>
        <button type="button" className="crate-btn" disabled={!!busy} onClick={probeColors}>
          {busy === 's7' ? 'Testing…' : 'Test cover colors'}
        </button>
        {report.s7 !== undefined && <Json value={report.s7} />}
      </Section>

      <Section title="Platform APIs">
        <p className="crate-muted">Everything on Spicetify.Platform, plus methods of the library-related ones.</p>
        <Json value={{ all: report.platformApis, methods: report.localish }} />
      </Section>
    </section>
  );
}
