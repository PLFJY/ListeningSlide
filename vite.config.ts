import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const adapterFiles = ['player.html', 'player.css', 'annotations.js', 'bridge.js'];
async function syncPlayer() {
  const target = path.join(root, 'public/onlyoffice/runtime/web-apps/apps/presentationeditor/main');
  await mkdir(target, { recursive: true });
  await Promise.all(
    adapterFiles.map((file) =>
      copyFile(path.join(root, 'engine/onlyoffice', file), path.join(target, file)),
    ),
  );
}
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'listening-slide-player',
      async buildStart() {
        await syncPlayer();
        adapterFiles.forEach((file) =>
          this.addWatchFile(path.join(root, 'engine/onlyoffice', file)),
        );
      },
      async watchChange(id) {
        if (id.startsWith(path.join(root, 'engine/onlyoffice'))) await syncPlayer();
      },
    },
  ],
  base: './',
  build: { target: 'es2022' },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
