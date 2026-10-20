import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
export const OPTIONAL_MUSIC = ['cornfield-chase.mp3', 'end-of-the-world-sun.mp3', 'supermoon.mp3'];
export const VOICE_CUES = ['target', 'warp', 'arrival', 'exit', 'black_hole', 'wormhole', 'abort'];
/** Private media is detected at build/start time and is never required by a fresh clone. */
export function detectLocalMedia(root) {
  return {
    music: OPTIONAL_MUSIC.filter((file) => existsSync(resolve(root, 'public/audio', file))),
    voices: VOICE_CUES.filter((cue) =>
      existsSync(resolve(root, 'public/audio/voice', cue + '.wav')),
    ),
  };
}
