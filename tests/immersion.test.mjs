import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { capturedBlackHole, canAbortTransit, canTraverse } from '../src/engine/flight.mjs';
import { engineSound } from '../src/engine/engine-sound.mjs';
import { starlight } from '../src/engine/starlight.mjs';
import {
  MIN_SPEED,
  MAX_SPEED,
  KM_PER_LY,
  AU_LY,
  splitPosition,
  translate,
  stopRadius,
  relative,
} from '../src/engine/navigation.mjs';
const { objects } = JSON.parse(
  await readFile(new URL('../public/data/universe-catalog.json', import.meta.url), 'utf8'),
);
test('every black hole captures entry and high-speed swept crossings without requiring a selected target', () => {
  for (const object of objects.filter((o) => o.category === 'black_hole')) {
    const radius = stopRadius(object) * 1.6,
      from = splitPosition(object.cartesian),
      to = splitPosition(object.cartesian);
    translate(from, [-radius * 10, 0, 0]);
    translate(to, [radius * 10, 0, 0]);
    const hit = capturedBlackHole([object], from, to);
    assert.equal(hit?.object.id, object.id);
    assert.ok(Math.abs(hit.fraction - 0.45) < 1e-6, object.id);
    assert.equal(capturedBlackHole([object], to, to), null);
    const inside = splitPosition(object.cartesian);
    translate(inside, [radius * 0.99, 0, 0]);
    assert.equal(capturedBlackHole([object], inside, inside)?.object.id, object.id);
    assert.equal(canTraverse(object, Math.hypot(...relative(object.cartesian, inside))), true);
    translate(from, [0, radius * 2, 0]);
    translate(to, [0, radius * 2, 0]);
    assert.equal(capturedBlackHole([object], from, to), null);
  }
});
test('capture picks the first boundary along a segment, ignores planets, and black holes alone disallow abort', () => {
  const near = { id: 'near', category: 'black_hole', scaleLy: 1, cartesian: { x: 0, y: 0, z: 0 } },
    far = { ...near, id: 'far', cartesian: { x: 100, y: 0, z: 0 } };
  const from = splitPosition({ x: -100, y: 0, z: 0 }),
    to = splitPosition({ x: 200, y: 0, z: 0 });
  assert.equal(capturedBlackHole([far, near], from, to).object.id, 'near');
  assert.equal(capturedBlackHole([{ ...near, category: 'planet' }], from, to), null);
  assert.equal(canAbortTransit('black_hole'), false);
  assert.equal(canAbortTransit('warp'), true);
  assert.equal(canAbortTransit('wormhole'), true);
});
test('engine timbre changes continuously with absolute speed, mirrors reverse, and silences when paused', () => {
  let last = engineSound(0);
  for (const speed of [
    MIN_SPEED,
    1 / KM_PER_LY,
    300 / KM_PER_LY,
    0.001,
    0.1,
    1e3,
    1e6,
    MAX_SPEED,
  ]) {
    const sound = engineSound(speed);
    assert.ok(
      sound.fundamental > last.fundamental &&
        sound.turbine > last.turbine &&
        sound.cutoff > last.cutoff &&
        sound.gain > last.gain,
    );
    assert.deepEqual(sound, engineSound(-speed));
    last = sound;
  }
  assert.equal(engineSound(MAX_SPEED, false).gain, 0);
  assert.equal(engineSound(0).mode, 'docking');
  assert.equal(engineSound(300 / KM_PER_LY).mode, 'impulse');
  assert.equal(engineSound(1).mode, 'warp');
  assert.equal(engineSound(MAX_SPEED).mode, 'deep');
  const a = engineSound(1),
    b = engineSound(1.000035);
  assert.ok(b.fundamental > a.fundamental && b.fundamental - a.fundamental < 0.01);
});
test('stellar magnitudes follow distance dilution and bright stars retain a brighter display response', () => {
  const star = { category: 'star', distanceLy: 100, physical: { magnitude: 2 } };
  const near = starlight(star, 100),
    far = starlight(star, 200);
  assert.equal(near.magnitude, 2);
  assert.ok(Math.abs(far.magnitude - near.magnitude - 5 * Math.log10(2)) < 1e-12);
  assert.ok(near.brightness > far.brightness);
  assert.equal(starlight({ id: 'sun', category: 'star' }, AU_LY).magnitude, -26.74);
  for (const object of objects.filter((o) => o.category === 'star'))
    for (const distance of [1e-13, object.distanceLy || AU_LY, 46.5e9]) {
      const light = starlight(object, distance);
      assert.ok(
        Number.isFinite(light.magnitude) && light.brightness >= 0.16 && light.brightness <= 3.5,
      );
    }
});
