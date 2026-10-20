import { cp, mkdir, access } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url)),
  destination = resolve(process.argv[2] || 'cosmos-drift-open-source');
if (destination === root || !process.argv[2])
  throw Error('Pass a new destination directory; existing directories are never overwritten.');
try {
  await access(destination);
  throw Error('Destination already exists.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await mkdir(destination, { recursive: true });
const entries = [
  '.gitignore',
  '.gitattributes',
  '.prettierrc.json',
  '.github',
  'LICENSE',
  'LICENSES',
  'README.md',
  'CONTRIBUTING.md',
  'THIRD_PARTY_NOTICES.md',
  'docs',
  'package.json',
  'package-lock.json',
  'index.html',
  'tsconfig.json',
  'vite.config.ts',
  'start.command',
  'stop.command',
  'src',
  'scripts',
  'tests',
  'public',
  'data/curated.mjs',
  'data/snapshots',
];
for (const entry of entries)
  await cp(resolve(root, entry), resolve(destination, entry), {
    recursive: true,
    filter(path) {
      const name = relative(root, path).replaceAll('\\', '/');
      return (
        !/\.mp3$/i.test(name) &&
        !/^public\/audio\/voice(?:\/|$)/.test(name) &&
        !/(^|\/)\.DS_Store$/.test(name)
      );
    },
  });
console.log(`Public source prepared: ${destination}`);
