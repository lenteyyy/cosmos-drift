import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { restorePreferences } from '../src/engine/preferences.mjs';
import { selectEnglishVoice } from '../src/engine/narrator.mjs';
import { detectLocalMedia } from '../scripts/local-media.mjs';
const restore = (values) => restorePreferences((key) => values[key], 13);
test('malformed, disabled and wrongly typed browser storage restores safe defaults', () => {
  for (const values of [
    {},
    {
      'cosmos-log': '{}',
      'cosmos-lang': '"ja"',
      'cosmos-music': '"false"',
      'cosmos-ui-scale': '-1',
      'cosmos-mission-step': '"moon"',
    },
    { 'cosmos-log': '{broken' },
  ]) {
    const s = restore(values);
    assert.deepEqual(s.discoveries, []);
    assert.equal(s.lang, 'zh');
    assert.equal(s.musicEnabled, true);
    assert.equal(s.uiScale, 1);
    assert.equal(s.missionStep, 1);
  }
  assert.equal(
    restorePreferences(() => {
      throw Error('Storage blocked');
    }, 13).musicVolume,
    0.45,
  );
});
test('saved numeric ranges are bounded and discovery history rejects malformed and duplicate entries', () => {
  const entry = { id: 'earth', at: '2026-10-19T00:00:00.000Z' };
  const s = restore({
    'cosmos-music-volume': '8',
    'cosmos-sound-volume': '-1',
    'cosmos-sensitivity': '100',
    'cosmos-mission-step': '999',
    'cosmos-log': JSON.stringify([
      entry,
      entry,
      null,
      { id: 3, at: 'yesterday' },
      { id: 'moon', at: 'bad' },
      { id: 'mars', at: entry.at },
    ]),
  });
  assert.equal(s.musicVolume, 1);
  assert.equal(s.soundVolume, 0);
  assert.equal(s.sensitivity, 3);
  assert.equal(s.missionStep, 12);
  assert.deepEqual(s.discoveries, [entry, { id: 'mars', at: entry.at }]);
  assert.equal(restore({ 'cosmos-mission-step': '-10' }).missionStep, 0);
});
test('English narration prefers a natural voice and never falls back to a different language', () => {
  const natural = { name: 'Natural English', lang: 'en-GB' };
  const voices = [
    { name: 'Japanese', lang: 'ja-JP' },
    { name: 'Boing', lang: 'en-US' },
    { name: 'Samantha', lang: 'en-US' },
    natural,
  ];
  assert.equal(selectEnglishVoice(voices), natural);
  assert.equal(selectEnglishVoice(voices.slice(0, 2)), null);
  assert.equal(selectEnglishVoice([]), null);
});
test('clean checkouts require no private media and discovery only enables installed additions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cosmos-media-'));
  try {
    assert.deepEqual(detectLocalMedia(root), { music: [], voices: [] });
    await mkdir(join(root, 'public/audio/voice'), { recursive: true });
    await writeFile(join(root, 'public/audio/supermoon.mp3'), 'local test fixture');
    await writeFile(join(root, 'public/audio/voice/arrival.wav'), 'local test fixture');
    assert.deepEqual(detectLocalMedia(root), { music: ['supermoon.mp3'], voices: ['arrival'] });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
