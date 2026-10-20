import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { TRACKS, ORIGINAL_TRACKS, SUPPLIED_TRACKS, musicIndex } from '../src/engine/music.mjs';
import { detectLocalMedia, VOICE_CUES } from '../scripts/local-media.mjs';
const installed = detectLocalMedia(fileURLToPath(new URL('../', import.meta.url)));
test('ten original scores work in a clean clone and optional local songs are valid when installed', async () => {
  assert.equal(ORIGINAL_TRACKS.length, 10);
  assert.equal(TRACKS.length, 10);
  const available = [
    ...ORIGINAL_TRACKS,
    ...SUPPLIED_TRACKS.filter((t) => installed.music.includes(t.file)),
  ];
  const fingerprints = new Set();
  for (const track of available) {
    const wav = await readFile(
      new URL(`../public/audio/${track.file || track.id + '.wav'}`, import.meta.url),
    );
    if (track.supplied) {
      assert.ok(wav.length > 1e6, track.id);
      assert.ok(wav.toString('ascii', 0, 3) === 'ID3' || wav[0] === 255, track.id);
      fingerprints.add(track.id);
      continue;
    }
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.readUInt16LE(22), 2);
    const sr = wav.readUInt32LE(24),
      bytes = wav.readUInt32LE(40);
    assert.equal(bytes / (sr * 4), track.seconds);
    let energy = 0,
      peak = 0,
      hash = 0;
    for (let i = 44; i < wav.length; i += 4096) {
      const v = wav.readInt16LE(i);
      energy += v * v;
      peak = Math.max(peak, Math.abs(v));
      hash = (Math.imul(hash, 31) + v) >>> 0;
    }
    assert.ok(energy > 1e9 && peak > 5000, track.id);
    fingerprints.add(hash);
  }
  assert.equal(fingerprints.size, available.length);
});
test('every travel context has a valid musical choice and galaxy changes avoid immediate repeats', () => {
  for (let current = -1; current < TRACKS.length; current++) {
    for (const scene of ['solar', 'stellar', 'galaxy', 'deep', 'black_hole', 'wormhole']) {
      for (const region of ['NGC0224', 'NGC1300', 'milky-way']) {
        const next = musicIndex(scene, current, region);
        assert.ok(next >= 0 && next < TRACKS.length);
        assert.notEqual(next, current);
      }
    }
  }
});

test('optional English navigation recordings contain actual PCM speech when installed', async () => {
  assert.equal(VOICE_CUES.length, 7);
  for (const id of installed.voices) {
    const wav = await readFile(new URL(`../public/audio/voice/${id}.wav`, import.meta.url));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    let data = null;
    for (let offset = 12; offset + 8 <= wav.length;) {
      const size = wav.readUInt32LE(offset + 4);
      if (wav.toString('ascii', offset, offset + 4) === 'data') {
        data = wav.subarray(offset + 8, offset + 8 + size);
        break;
      }
      offset += 8 + size + (size % 2);
    }
    assert.ok(data && data.length > 20000, id);
    let peak = 0;
    for (let i = 0; i + 2 <= data.length; i += 2)
      peak = Math.max(peak, Math.abs(data.readInt16LE(i)));
    assert.ok(peak > 1000, id);
  }
});
