import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
const run = promisify(execFile);
const checksum = (bytes) => createHash('sha256').update(bytes).digest('hex');
export async function writeSourceManifest(upstream, lock) {
  const files = {};
  for (const [prefix, pin] of [['', lock], ...Object.entries(lock.submodules)]) {
    const directory = path.join(upstream, prefix);
    const head = (await run('git', ['rev-parse', 'HEAD'], { cwd: directory })).stdout.trim();
    if (head !== pin.commit) throw new Error(`Source archive pin mismatch: ${prefix}`);
    if (
      (
        await run('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: directory })
      ).stdout.trim()
    )
      throw new Error(`Modified upstream sources: ${prefix}`);
    const entries = (
      await run('git', ['ls-files', '--stage', '-z'], {
        cwd: directory,
        maxBuffer: 32 * 1024 * 1024,
      })
    ).stdout
      .split('\0')
      .filter(Boolean);
    for (let start = 0; start < entries.length; start += 64)
      await Promise.all(
        entries.slice(start, start + 64).map(async (entry) => {
          const tab = entry.indexOf('\t'),
            mode = entry.slice(0, 6),
            name = entry.slice(tab + 1);
          if (mode === '160000') return;
          const file = path.join(directory, name),
            relative = [prefix, name].filter(Boolean).join('/');
          const link = mode === '120000';
          files[relative] = {
            sha256: checksum(link ? Buffer.from(await fs.readlink(file)) : await fs.readFile(file)),
            ...(link ? { link: true } : {}),
          };
        }),
      );
  }
  const output = path.join(upstream, '../source-checkouts.json');
  await fs.writeFile(output, JSON.stringify({ lock, files }, null, 2));
  console.log(`Recorded SHA256 for ${Object.keys(files).length} pinned upstream source files.`);
}
export async function verifyArchivedSource(upstream, lock) {
  const manifest = JSON.parse(
    await fs.readFile(path.join(upstream, '../source-checkouts.json'), 'utf8'),
  );
  if (JSON.stringify(manifest.lock) !== JSON.stringify(lock))
    throw new Error('Archived source pin manifest mismatch');
  const entries = Object.entries(manifest.files);
  for (let start = 0; start < entries.length; start += 64)
    await Promise.all(
      entries.slice(start, start + 64).map(async ([name, record]) => {
        if (name.startsWith('/') || name.split(/[\\/]/).includes('..'))
          throw new Error('Unsafe source manifest path');
        const file = path.join(upstream, name);
        const bytes = record.link ? Buffer.from(await fs.readlink(file)) : await fs.readFile(file);
        if (checksum(bytes) !== record.sha256) throw new Error(`Archived source changed: ${name}`);
      }),
    );
  console.log(
    `Verified ${entries.length} archived source files against the pinned source manifest.`,
  );
}
