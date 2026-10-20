import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  splitPosition,
  translate,
  relative,
  absolute,
  SpatialIndex,
  SPEEDS,
  autopilotStep,
  stopRadius,
  KM_PER_LY,
  bandForDistance,
} from '../src/engine/navigation.mjs';
const { objects } = JSON.parse(
  await readFile(new URL('../public/data/universe-catalog.json', import.meta.url), 'utf8'),
);
const byId = new Map(objects.map((o) => [o.id, o]));
test('millimetre-scale local movement survives at the cosmic horizon', () => {
  const p = splitPosition({ x: 46.5e9, y: 0, z: 0 }),
    before = structuredClone(p),
    oneMetre = 1 / (KM_PER_LY * 1000);
  translate(p, [oneMetre, 0, 0]);
  assert.ok(Math.abs(relative(p, before)[0] - oneMetre) < oneMetre * 0.001);
});
test('sector crossings preserve direction and distance, including negative axes', () => {
  const p = splitPosition({ x: 0.49, y: -0.49, z: 0 });
  translate(p, [0.03, -0.03, 0]);
  const a = absolute(p);
  assert.ok(Math.abs(a.x - 0.52) < 1e-14);
  assert.ok(Math.abs(a.y + 0.52) < 1e-14);
  assert.deepEqual(p.sector, [1, -1, 0]);
});
test('all 20 speed levels are strictly increasing', () => {
  assert.equal(SPEEDS.length, 20);
  for (let i = 1; i < SPEEDS.length; i++) assert.ok(SPEEDS[i] > SPEEDS[i - 1]);
});
test('k-d queries match brute force around Earth, Galactic Centre and Andromeda', () => {
  const index = new SpatialIndex(objects);
  for (const id of ['earth', 'sgr-a', 'NGC0224']) {
    const p = splitPosition(byId.get(id).cartesian),
      near = index.nearest(p, 12),
      brute = objects
        .map((o) => ({ id: o.id, d: Math.hypot(...relative(o.cartesian, p)) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 12);
    assert.deepEqual(near.map((n) => n.object.id).sort(), brute.map((n) => n.id).sort());
  }
});
test('complete acceptance route crosses all nine scale bands and arrives without overshoot', () => {
  const route = [
    'earth',
    'moon',
    'mars',
    'jupiter',
    'neptune',
    'proxima',
    'hyg-32263',
    'sgr-a',
    'NGC0224',
    'virgo',
    'laniakea',
    'quipu',
    'ton618',
    'horizon',
  ];
  let p = splitPosition({ ...byId.get('earth').cartesian, z: 3e-9 });
  const bands = new Set([0]);
  for (const id of route) {
    const target = byId.get(id);
    assert.ok(target, `Missing ${id}`);
    let arrived = false,
      prior = Infinity;
    for (let i = 0; i < 10000; i++) {
      const r = relative(target.cartesian, p),
        d = Math.hypot(...r),
        stop = stopRadius(target),
        max = Math.max(SPEEDS[0], d / 5),
        flight = autopilotStep(d, stop, max, 1 / 30);
      assert.ok(d <= prior + Math.max(1e-10, d * 1e-14), `${id} overshot`);
      prior = d;
      if (flight.arrived) {
        arrived = true;
        break;
      }
      translate(
        p,
        r.map((n) => (n / d) * flight.step),
      );
      const earthD = Math.hypot(...relative(byId.get('earth').cartesian, p));
      bands.add(bandForDistance(earthD));
    }
    assert.ok(arrived, `Failed to arrive: ${id}`);
  }
  assert.equal(bands.size, 9);
});
test('opposite trajectories query different catalogue regions', () => {
  const index = new SpatialIndex(objects);
  const a = index.nearest(splitPosition(byId.get('NGC0224').cartesian), 15).map((n) => n.object.id),
    b = index.nearest(splitPosition(byId.get('virgo').cartesian), 15).map((n) => n.object.id);
  assert.ok(a.filter((id) => b.includes(id)).length < 4);
});
test('sky selection covers every RA sector and all equal-area declination bands', () => {
  const galaxies = objects.filter((o) => o.category === 'galaxy');
  const ra = Array(12).fill(0),
    dec = Array(4).fill(0);
  for (const g of galaxies) {
    ra[Math.min(11, Math.floor(g.raDeg / 30))]++;
    dec[Math.min(3, Math.floor((Math.sin((g.decDeg * Math.PI) / 180) + 1) * 2))]++;
  }
  assert.ok(
    ra.every((n) => n >= 4),
    `RA bins: ${ra}`,
  );
  assert.ok(
    dec.every((n) => n >= 8),
    `Dec bins: ${dec}`,
  );
});
test('scientific uncertainty is preserved', () => {
  assert.equal(byId.get('hlx1').scienceStatus, 'candidate');
  assert.equal(byId.get('oj287').scienceStatus, 'debated');
  assert.equal(byId.get('her-crb').scienceStatus, 'debated');
  assert.match(byId.get('holm15a').descriptionEn, /mass estimates vary/);
});
