// Copies dist/<appId> into Spicetify's CustomApps folder.
// Location lookup order:
//   1. SPICETIFY_CONFIG_DIR env var
//   2. directory of the config file printed by `spicetify -c`
//   3. platform default (%APPDATA%\spicetify on Windows, ~/.config/spicetify elsewhere)

import { cp, rm, readFile, access, mkdir, readdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function findSpicetifyDir() {
  if (process.env.SPICETIFY_CONFIG_DIR) return process.env.SPICETIFY_CONFIG_DIR;
  try {
    const out = execSync('spicetify -c', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .trim()
      .split(/\r?\n/)
      .pop();
    if (out && (await exists(out))) return path.dirname(out);
  } catch {
    // spicetify not on PATH — fall through to defaults
  }
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'spicetify');
  }
  return path.join(os.homedir(), '.config', 'spicetify');
}

export async function installApp({ quiet = false } = {}) {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const { appId } = pkg.spicetify;
  const src = path.join(root, 'dist', appId);
  if (!(await exists(path.join(src, 'index.js')))) {
    throw new Error(`No build found at ${src}. Run "npm run build" first.`);
  }
  const spicetifyDir = await findSpicetifyDir();
  if (!(await exists(spicetifyDir))) {
    throw new Error(
      `Spicetify folder not found at ${spicetifyDir}. Install Spicetify or set SPICETIFY_CONFIG_DIR.`,
    );
  }
  const dest = path.join(spicetifyDir, 'CustomApps', appId);
  // Overwrite in place — never delete the folder. `spicetify watch` reads it while we copy, and a
  // vanished folder/file makes it crash (seen 2026-10-20). Stale files are removed afterwards.
  await mkdir(dest, { recursive: true });
  const files = await readdir(src);
  for (const f of files) await cp(path.join(src, f), path.join(dest, f), { recursive: true, force: true });
  for (const f of await readdir(dest)) {
    if (!files.includes(f)) await rm(path.join(dest, f), { recursive: true, force: true });
  }
  if (!quiet) {
    console.log(`Installed → ${dest}`);
    console.log('\nFirst time only:');
    console.log(`  spicetify config custom_apps ${appId}`);
    console.log('  spicetify apply');
    console.log('\nAfter that, during development: npm run dev  +  spicetify watch -a -l');
  } else {
    console.log(`  ↳ copied to ${dest}`);
  }
  return dest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  installApp().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
