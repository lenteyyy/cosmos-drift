import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { detectLocalMedia } from './scripts/local-media.mjs';
const workspace = fileURLToPath(new URL('.', import.meta.url));
const instance = createHash('sha256').update(workspace).digest('hex').slice(0, 16);
export default defineConfig({
  define: { __COSMOS_LOCAL_MEDIA__: JSON.stringify(detectLocalMedia(workspace)) },
  plugins: [
    react(),
    {
      name: 'cosmos-local-health',
      configureServer(server) {
        server.middlewares.use('/__cosmos/health', (_request, response) => {
          response.setHeader('Content-Type', 'application/json');
          response.setHeader('Cache-Control', 'no-store');
          response.end(JSON.stringify({ app: 'cosmos-drift', instance, pid: process.pid }));
        });
      },
    },
    {
      name: 'cosmos-distribution-notices',
      generateBundle() {
        for (const file of [
          'LICENSES/Paper-Shaders-Apache-2.0.txt',
          'LICENSES/Paper-Shaders-NOTICE.txt',
          'THIRD_PARTY_NOTICES.md',
        ])
          this.emitFile({
            type: 'asset',
            fileName: `licenses/${file.split('/').at(-1)}`,
            source: readFileSync(new URL(file, import.meta.url), 'utf8'),
          });
      },
    },
  ],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: {
    rollupOptions: { output: { manualChunks: { three: ['three', '@react-three/fiber'] } } },
  },
});
