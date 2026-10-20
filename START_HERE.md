# Start here (for Vivek)

## 1. Open the project

Unzip this folder somewhere permanent (e.g. `~/code/crate`), open it in Cursor, then in the
terminal:

```bash
npm install
npm run check          # typecheck + tests + build + smoke — should end with "SMOKE OK"
```

Optional but recommended: `git remote add origin <your new GitHub repo>` and push. The repo already
has an initial commit.

## 2. Put it into Spotify

```bash
npm run install-app                 # copies dist/crate into Spicetify's CustomApps folder
spicetify config custom_apps crate
spicetify apply
```

"Crate" appears in Spotify's sidebar. Open it → **Diagnostics** tab.

Turn on DevTools once, so you can inspect things: `spicetify enable-devtools`.

## 3. Dev loop

- Terminal A: `npm run dev` (rebuilds and re-copies on every save)
- Terminal B: `spicetify watch -a -l` (re-applies custom apps + live reload)

## 4. Start Claude Code

Run `claude` in this folder. It reads `CLAUDE.md` automatically. Suggested first message:

> Read CLAUDE.md and docs/. Then let's run spike S1 — I have Spotify open with Crate installed.

Or just type `/spike S1`. Claude will tell you what to click in Diagnostics, and you paste back
the copied report. Do S1 → S2 → S3 → S5 → S7 first; they decide most of M1.

Other commands: `/next` (build the next milestone item), `/ship-check` (before a release).

## 5. Before publishing

- Replace `REPLACE_WITH_GITHUB_USERNAME` in the root `manifest.json`
- Add `docs/images/preview.png` (screenshot of an album page)
- Add the `spicetify-apps` topic to the GitHub repo
- Run `/ship-check`
