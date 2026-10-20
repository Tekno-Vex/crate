// Builds the Spicetify custom app into dist/<appId>/:
//   index.js      custom app bundle; exposes global render()
//   extension.js  bundled extension (subfiles_extension), runs at Spotify startup
//   manifest.json custom app manifest with escaped SVG icons
//
// Flags:
//   --watch    rebuild on change
//   --install  after each successful build, copy into Spicetify's CustomApps folder
//
// React is NOT bundled: react / react-dom / react/jsx-runtime resolve to shims over Spicetify.React.

import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installApp } from './install.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const { appId, displayName } = pkg.spicetify;
const watch = process.argv.includes('--watch');
const install = process.argv.includes('--install');
const dev = watch;
const outDir = path.join(root, 'dist', appId);
const globalName = `__${appId.replace(/[^a-zA-Z0-9_]/g, '_')}_app`;

/** Resolve React imports to our lazy shims over Spicetify.React. */
const reactShims = {
  name: 'spicetify-react-shims',
  setup(build) {
    const map = {
      react: 'src/shims/react.ts',
      'react/jsx-runtime': 'src/shims/jsx-runtime.ts',
      'react/jsx-dev-runtime': 'src/shims/jsx-runtime.ts',
      'react-dom': 'src/shims/react-dom.ts',
      'react-dom/client': 'src/shims/react-dom.ts',
    };
    build.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (args) => {
      const target = map[args.path];
      if (!target) return { errors: [{ text: `Unsupported React import "${args.path}" — add a shim.` }] };
      return { path: path.join(root, target) };
    });
  },
};

// App and extension builds finish together; installApp() does rm + cp of the whole folder, so
// concurrent calls race (ENOENT). Coalesce bursts into one install, and never run two at once.
let installTimer;
let installing = Promise.resolve();
function scheduleInstall() {
  clearTimeout(installTimer);
  installTimer = setTimeout(() => {
    installing = installing
      .then(() => installApp({ quiet: true }))
      .catch((e) => console.error(`  install failed: ${e.message}`));
  }, 150);
}

/** Writes manifest.json and optionally installs after each successful build. */
const afterBuild = (label) => ({
  name: `after-build-${label}`,
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length) {
        console.error(`✗ ${label} build failed`);
        return;
      }
      await writeManifest();
      console.log(`✓ ${label} built → ${path.relative(root, outDir)}`);
      if (install) scheduleInstall();
    });
  },
});

async function writeManifest() {
  const icon = (await readFile(path.join(root, 'src/assets/icon.svg'), 'utf8')).trim();
  const activeIcon = (await readFile(path.join(root, 'src/assets/icon-active.svg'), 'utf8')).trim();
  const manifest = {
    name: displayName,
    icon,
    'active-icon': activeIcon,
    subfiles: [],
    subfiles_extension: ['extension.js'],
  };
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

const common = {
  bundle: true,
  format: 'iife',
  target: ['chrome120'],
  jsx: 'automatic',
  loader: { '.css': 'text', '.svg': 'text' },
  plugins: [reactShims],
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  legalComments: 'none',
  logLevel: 'warning',
  define: {
    __APP_ID__: JSON.stringify(appId),
    __APP_NAME__: JSON.stringify(displayName),
    __APP_VERSION__: JSON.stringify(pkg.version),
    __DEV__: JSON.stringify(dev),
  },
};

const appOptions = {
  ...common,
  entryPoints: [path.join(root, 'src/app/index.tsx')],
  outfile: path.join(outDir, 'index.js'),
  globalName,
  // Spicetify calls the global render() when the custom app page opens.
  footer: { js: `function render(){return Spicetify.React.createElement(${globalName}.default);}` },
  plugins: [...common.plugins, afterBuild('app')],
};

const extensionOptions = {
  ...common,
  entryPoints: [path.join(root, 'src/extension/index.ts')],
  outfile: path.join(outDir, 'extension.js'),
  plugins: [...common.plugins, afterBuild('extension')],
};

if (!watch) await rm(outDir, { recursive: true, force: true });

if (watch) {
  const contexts = await Promise.all([esbuild.context(appOptions), esbuild.context(extensionOptions)]);
  await Promise.all(contexts.map((c) => c.watch()));
  console.log(`watching… (install into CustomApps: ${install ? 'on' : 'off'})`);
} else {
  await Promise.all([esbuild.build(appOptions), esbuild.build(extensionOptions)]);
}
