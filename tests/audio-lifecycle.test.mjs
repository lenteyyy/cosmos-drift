import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as music from '../src/engine/music.mjs';
import * as sound from '../src/engine/engine-sound.mjs';
import * as narrator from '../src/engine/narrator.mjs';

// Exercise the real audio implementation with a frozen AudioContext clock and fake wall timers.
const code = ts.transpileModule(
  (await readFile(new URL('../src/engine/audio.ts', import.meta.url), 'utf8')).replaceAll(
    'import.meta.hot',
    'false',
  ),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
function harness() {
  const timers = new Map();
  let serial = 0;
  const modules = {
    './music.mjs': music,
    './engine-sound.mjs': sound,
    './narrator.mjs': narrator,
    './local-media.mjs': { LOCAL_MEDIA: { music: [], voices: [] } },
  };
  const exports = {};
  runInNewContext(code, {
    exports,
    require: (id) => {
      assert.ok(id in modules, id);
      return modules[id];
    },
    window: { dispatchEvent() {} },
    Event,
    setTimeout: (callback, delay) => {
      timers.set(++serial, { callback, delay });
      return serial;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  const cabin = exports.cabin;
  const node = () => ({
    connect() {
      return this;
    },
    disconnect() {},
    start() {},
    stop() {},
    gain: {
      value: 0,
      setValueAtTime() {},
      linearRampToValueAtTime() {},
      cancelScheduledValues() {},
    },
  });
  cabin.ctx = {
    currentTime: 0,
    state: 'running',
    createBufferSource: node,
    createGain: node,
    async suspend() {
      this.state = 'suspended';
    },
    async resume() {
      this.state = 'running';
    },
    async close() {
      this.state = 'closed';
    },
  };
  cabin.music = node();
  cabin.prepare = async () => ({ duration: 100 });
  return { cabin, timers };
}
test('standby cancels music wall timers and resumes from the frozen audio clock', async () => {
  const { cabin, timers } = harness();
  await cabin.playTrack(0);
  assert.equal([...timers.values()][0].delay, 97000);
  cabin.ctx.currentTime = 12;
  cabin.setBackgroundSuspended(true);
  assert.equal(cabin.ctx.state, 'suspended');
  assert.equal(timers.size, 0);
  cabin.setBackgroundSuspended(false);
  assert.equal(cabin.ctx.state, 'running');
  assert.equal([...timers.values()][0].delay, 85000);
  cabin.dispose();
  assert.equal(timers.size, 0);
});
test('an audio load completed in standby cannot start a background playlist loop', async () => {
  const { cabin, timers } = harness();
  const loading = cabin.playTrack(1);
  cabin.setBackgroundSuspended(true);
  await loading;
  assert.equal(cabin.trackIndex, 1);
  assert.equal(timers.size, 0);
  cabin.setBackgroundSuspended(false);
  assert.equal(timers.size, 1);
  cabin.dispose();
  assert.equal(timers.size, 0);
});
