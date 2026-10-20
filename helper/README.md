# Crate Helper (M3 — not started)

Optional local companion that reads and writes audio tags for Crate.
Contract: [`../docs/HELPER_API.md`](../docs/HELPER_API.md).

Planned stack: Rust, `lofty` (tags), `axum` (HTTP on 127.0.0.1:47823), `notify` (file watching).
Before writing it, run spikes S2 (can the Spotify renderer reach localhost?), S4, S5 and S6.

Scaffold when ready:

```bash
cargo new --bin crate-helper   # inside this folder
```
