import { spawn } from 'node:child_process';
import { build } from 'esbuild';
import { createServer } from 'vite';
await build({
  entryPoints: ['electron/main.ts', 'electron/preload.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outdir: 'dist-electron',
  outExtension: { '.js': '.cjs' },
  external: ['electron'],
});
const server = await createServer();
await server.listen();
const { default: electron } = await import('electron');
const electronEnv = { ...process.env, VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173' };
delete electronEnv.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: electronEnv,
});
child.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill());
