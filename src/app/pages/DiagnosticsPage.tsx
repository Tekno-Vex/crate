import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { buildLibrary } from '../../domain/grouping';
import { hasReliableNumbering } from '../../domain/ordering';
import {
  copyToClipboard,
  describeApi,
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
  s3?: { strategy: PlayStrategy; ok: boolean; message?: string }[];
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
      const imageSchemes = [...new Set(tracks.map((t) => t.imageUrl?.split(':').slice(0, 2).join(':') ?? 'none'))];
      // Pick 3 tracks from the same album (for S3 experiments).
      const firstMulti = lib.albums.find((a) => a.tracks.length >= 3);
      setSampleUris(firstMulti ? firstMulti.tracks.slice(0, 3).map((t) => t.uri) : tracks.slice(0, 3).map((t) => t.uri));
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
      setReport((r) => ({
        ...r,
        s3: [
          ...(r.s3 ?? []).filter((x) => x.strategy !== strategy),
          { strategy, ok: res.ok, message: res.ok ? undefined : `${res.error.message} ${String(res.error.detail ?? '')}` },
        ],
      }));
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
          Plays 3 tracks from one album with each strategy. After each, check: does Next go to track 2?
          Does Previous work? What does "Playing from" say? Note it when you paste the report.
        </p>
        <div className="crate-row">
          {(['local-files-context', 'app-context', 'queue-fallback'] as PlayStrategy[]).map((s) => (
            <button key={s} type="button" className="crate-btn crate-btn--ghost" disabled={!!busy} onClick={() => playExperiment(s)}>
              {s}
            </button>
          ))}
        </div>
        {sampleUris.length > 0 && <Json value={{ sampleUris }} />}
        {report.s3 && <Json value={report.s3} />}
      </Section>

      <Section title="Platform APIs">
        <p className="crate-muted">Everything on Spicetify.Platform, plus methods of the library-related ones.</p>
        <Json value={{ all: report.platformApis, methods: report.localish }} />
      </Section>
    </section>
  );
}
