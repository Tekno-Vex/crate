---
description: Pre-release checklist for a Marketplace release
---

Go through this checklist, report pass/fail per line, and fix what you can:

- [ ] `npm run check` green
- [ ] `package.json` version bumped; CHANGELOG entry written
- [ ] Root `manifest.json` (Marketplace) has correct name, description, preview image path,
      readme, authors, tags; preview image exists and is current
- [ ] README: install (Marketplace + PowerShell + sh), uninstall, helper (optional) install,
      known limitations, compatibility line ("tested on Spotify X / Spicetify Y"), credits
- [ ] `docs/SPIKES.md` results are for the Spotify version we claim to support
- [ ] Diagnostics "Copy report" works and includes versions
- [ ] No `console.log` noise outside `lib/log.ts`; no hard-coded colors outside fallbacks
- [ ] Tested empty library, local files disabled, 20k synthetic library
- [ ] Release zip of `dist/crate` attached to a GitHub release; install scripts point at it
- [ ] Repo has the `spicetify-apps` topic
