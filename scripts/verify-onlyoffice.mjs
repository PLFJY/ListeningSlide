import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = process.argv.indexOf('--platform');
const platform = index >= 0 ? process.argv[index + 1] : `${process.platform}-${process.arch}`;
const lock = JSON.parse(
  await fs.readFile(path.join(root, 'engine/onlyoffice/upstream.lock.json'), 'utf8'),
);
const native = path.join(root, 'runtime/onlyoffice', platform);
const manifest = JSON.parse(
  await fs.readFile(path.join(native, 'provenance.json'), 'utf8').catch(() => {
    throw new Error(
      `Missing ${platform} runtime. Run pnpm run onlyoffice:prepare -- --platform ${platform}`,
    );
  }),
);
if (manifest.version !== lock.version || manifest.sha256 !== lock.releases[platform]?.sha256)
  throw new Error('Native runtime provenance mismatch');
for (const file of [
  'sdkjs/slide/sdk-all-min.js',
  'sdkjs/slide/sdk-all.js',
  'sdkjs/common/libfont/engine/fonts.wasm',
  'sdkjs/common/AllFonts.js',
  'web-apps/apps/presentationeditor/main/bridge.js',
  'web-apps/apps/presentationeditor/main/annotations.js',
])
  await fs.access(path.join(root, 'public/onlyoffice/runtime', file));
await fs.access(path.join(native, 'converter', platform.startsWith('win32') ? 'x2t.exe' : 'x2t'));
const source = JSON.parse(
  await fs.readFile(path.join(root, 'public/onlyoffice/runtime/source-manifest.json'), 'utf8'),
);
if (
  source.commit !== lock.commit ||
  source.submodules.sdkjs.commit !== lock.submodules.sdkjs.commit
)
  throw new Error('SDKJS source manifest mismatch');
const hashes = JSON.parse(
  await fs.readFile(path.join(root, 'third_party/fonts/checksums.json'), 'utf8'),
);
for (const [file, expected] of Object.entries(hashes))
  if (
    createHash('sha256')
      .update(await fs.readFile(path.join(root, 'third_party/fonts', file)))
      .digest('hex') !== expected
  )
    throw new Error(`Font checksum mismatch: ${file}`);
console.log(
  `Verified ONLYOFFICE ${lock.version} source pin, ${platform} native provenance, required SDK assets and licensed font checksums.`,
);
