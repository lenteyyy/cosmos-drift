import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderBudget,
  shaderSize,
  shouldRenderContinuously,
  resolutionForLoad,
  frameSlot,
} from '../src/engine/render-policy.mjs';
import { restorePreferences } from '../src/engine/preferences.mjs';
import { perlinNoiseFragmentShader, warpFragmentShader } from '@paper-design/shaders';
test('low quality reduces shader work and pixel density without limiting scene frame rate', () => {
  const high = renderBudget('high'),
    low = renderBudget('low');
  for (const field of ['shaderFps', 'shaderPixels', 'dpr', 'octaves', 'swirls'])
    assert.ok(low[field] < high[field], field);
  assert.equal('fps' in low || 'idleFps' in low, false);
  assert.equal('fps' in high || 'idleFps' in high, false);
});
test('sustained frame pressure reduces resolution within bounds and recovery requires headroom', () => {
  for (const quality of ['low', 'high']) {
    const ceiling = renderBudget(quality).dpr;
    let dpr = ceiling;
    assert.equal(resolutionForLoad(dpr, 60, quality), dpr);
    for (let i = 0; i < 40; i++) {
      const next = resolutionForLoad(dpr, 48, quality);
      assert.ok(next <= dpr && next >= 0.5);
      dpr = next;
    }
    assert.equal(resolutionForLoad(dpr, 60, quality), dpr);
    for (let i = 0; i < 40; i++) dpr = resolutionForLoad(dpr, 60, quality, true);
    assert.equal(dpr, ceiling);
  }
});
test('background pixel budgets remain bounded on mobile, ultrawide and high-density displays', () => {
  for (const quality of ['high', 'low'])
    for (const [width, height] of [
      [1, 1],
      [375, 812],
      [1280, 720],
      [7680, 4320],
      [15000, 200],
    ]) {
      const [w, h] = shaderSize(width, height, quality);
      assert.ok(w >= 1 && h >= 1 && w <= width && h <= height);
      assert.ok(w * h <= renderBudget(quality).shaderPixels);
    }
});
test('RAF pacing stays near 60 FPS on 60–165 Hz displays without drift or catch-up bursts', () => {
  for (const refresh of [60, 120, 144, 165]) {
    let deadline = 0,
      frames = 0;
    for (let i = 0; i < refresh * 120; i++) {
      const slot = frameSlot((i * 1000) / refresh, deadline);
      if (slot.render) frames++;
      deadline = slot.deadline;
    }
    assert.ok(Math.abs(frames - 7200) <= 2, `${refresh} Hz: ${frames}`);
  }
  const afterStall = frameSlot(5000, 1000);
  assert.equal(afterStall.render, true);
  assert.ok(afterStall.deadline > 5000);
  assert.equal(frameSlot(5001, afterStall.deadline).render, false);
});
const idle = {
  foreground: true,
  paused: false,
  panel: false,
  captured: false,
  jumping: false,
  pauseAnimations: false,
  motion: false,
};
test('hidden and standby tabs never animate, including during locked black-hole transit', () => {
  for (const captured of [false, true])
    assert.equal(
      shouldRenderContinuously({
        ...idle,
        foreground: false,
        captured,
        jumping: true,
        motion: true,
      }),
      false,
    );
});
test('pausing decorative animation stops idle rendering but preserves flight and locked transit', () => {
  assert.equal(shouldRenderContinuously(idle), true);
  assert.equal(shouldRenderContinuously({ ...idle, pauseAnimations: true }), false);
  assert.equal(shouldRenderContinuously({ ...idle, pauseAnimations: true, motion: true }), true);
  assert.equal(
    shouldRenderContinuously({ ...idle, pauseAnimations: true, captured: true, jumping: true }),
    true,
  );
  assert.equal(shouldRenderContinuously({ ...idle, paused: true }), false);
  assert.equal(shouldRenderContinuously({ ...idle, panel: true }), false);
});
test('power preferences persist safely and Paper GLSL programs are supplied by the pinned dependency', () => {
  const values = { 'cosmos-quality': '"low"', 'cosmos-pause-animations': 'true' };
  const result = restorePreferences((key) => values[key], 13);
  assert.equal(result.quality, 'low');
  assert.equal(result.pauseAnimations, true);
  assert.equal(restorePreferences(() => '"invalid"', 13).quality, 'high');
  for (const shader of [perlinNoiseFragmentShader, warpFragmentShader]) {
    assert.match(shader, /^#version 300 es/);
    assert.match(shader, /in vec2 v_patternUV/);
    assert.match(shader, /vec2 uv = v_patternUV;/);
    assert.match(shader, /void main\(\)/);
  }
});
