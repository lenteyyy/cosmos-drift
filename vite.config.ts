import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
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
  ],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: {
    rollupOptions: { output: { manualChunks: { three: ['three', '@react-three/fiber'] } } },
  },
});
