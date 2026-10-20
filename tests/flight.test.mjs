import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  EXPEDITION,
  jumpDestination,
  pickScreenObject,
  navigationCue,
  smoothValue,
  jumpEnvelope,
  portalExit,
  canTraverse,
  TRANSIT_DURATION,
} from '../src/engine/flight.mjs';
import { splitPosition, relative, stopRadius } from '../src/engine/navigation.mjs';
const { objects } = JSON.parse(
  await readFile(new URL('../public/data/universe-catalog.json', import.meta.url), 'utf8'),
);
const byId = new Map(objects.map((o) => [o.id, o]));
test('warp arrival is finite and outside the observation radius for every expedition destination', () => {
  let position = splitPosition(byId.get('earth').cartesian);
  for (const id of EXPEDITION) {
    const object = byId.get(id),
      jump = jumpDestination(object, position),
      distance = Math.hypot(...relative(object.cartesian, jump.destination));
    assert.ok(Object.values(jump.destination).flat().every(Number.isFinite), id);
    assert.ok(
      Math.abs(distance - jump.radius) < Math.max(jump.radius * 1e-5, 1e-13),
      `${id}: ${distance} vs ${jump.radius}`,
    );
    assert.ok(distance > stopRadius(object), id);
    position = jump.destination;
  }
});
test('jumping from a coincident anchor produces a valid fallback arrival direction', () => {
  const object = byId.get('earth'),
    jump = jumpDestination(object, splitPosition(object.cartesian));
  assert.deepEqual(jump.direction, [0, 0, -1]);
  assert.ok(Math.hypot(...relative(object.cartesian, jump.destination)) > stopRadius(object));
});
test('hover selects a nearer planet instead of a distant point behind its disk', () => {
  const bodies = [
    { id: 'star', x: 100, y: 100, radius: 3, distance: 4, visible: true },
    { id: 'earth', x: 110, y: 100, radius: 40, distance: 1e-9, visible: true },
  ];
  assert.equal(pickScreenObject(bodies, 100, 100).id, 'earth');
  assert.equal(pickScreenObject(bodies, 500, 500), null);
});
test('every independent visible star can be selected and invisible/behind-camera markers cannot', () => {
  const markers = objects.map((o, i) => ({
    id: o.id,
    x: i * 30,
    y: 20,
    radius: 4,
    distance: o.distanceLy,
    visible: true,
  }));
  markers.forEach((m, i) => assert.equal(pickScreenObject(markers, i * 30, 20)?.id, m.id));
  assert.equal(pickScreenObject([{ ...markers[0], visible: false }], 0, 20), null);
});
test('navigation distinguishes ahead, right, above and behind, and keeps the arrow in the safe HUD area', () => {
  const ahead = navigationCue([0, 0, -10], 1280, 900);
  assert.equal(ahead.onScreen, true);
  assert.ok(navigationCue([10, 0, -1], 1280, 900).yaw > 0);
  assert.ok(navigationCue([0, 10, -1], 1280, 900).pitch > 0);
  const behind = navigationCue([1, 0, 10], 1280, 900);
  assert.equal(behind.behind, true);
  assert.equal(behind.onScreen, false);
  assert.ok(behind.x <= 1190 && behind.x >= 90);
});
test('black holes randomly reach real galaxies and structures, avoid repeated exits and stay outside observation radii', () => {
  const structureTypes = [
    'galaxy_group',
    'galaxy_cluster',
    'supercluster',
    'wall',
    'filament',
    'void',
  ];
  for (const source of objects.filter((o) => o.category === 'black_hole')) {
    const departure = splitPosition(source.cartesian);
    for (const kind of [0, 0.99]) {
      const draws = [kind, 0.37],
        exit = portalExit(source, objects, departure, () => draws.shift());
      assert.ok(exit && !exit.isProcedural, source.id);
      assert.ok(kind === 0 ? exit.category === 'galaxy' : structureTypes.includes(exit.category));
      assert.ok(Math.hypot(...relative(exit.cartesian, departure)) > 1e6);
      const nextDraws = [kind, 0.37],
        next = portalExit(source, objects, departure, () => nextDraws.shift(), exit.id);
      assert.notEqual(next.id, exit.id);
      const jump = jumpDestination(exit, departure);
      assert.ok(Object.values(jump.destination).flat().every(Number.isFinite));
      assert.ok(Math.hypot(...relative(exit.cartesian, jump.destination)) > stopRadius(exit));
    }
    assert.equal(canTraverse(source, stopRadius(source) * 1.18), true);
    assert.equal(canTraverse(source, stopRadius(source) * 2), false);
  }
  const source = byId.get('sgr-a'),
    departure = splitPosition(source.cartesian);
  const exits = new Set(
    Array.from({ length: 20 }, (_, i) => {
      const draws = [i % 2, 0.01 + i * 0.047];
      return portalExit(source, objects, departure, () => draws.shift()).id;
    }),
  );
  assert.ok(exits.size > 15);
  assert.equal(portalExit(source, [], departure), null);
  assert.equal(canTraverse(byId.get('earth'), 0), false);
  assert.ok(TRANSIT_DURATION.black_hole > TRANSIT_DURATION.warp);
});
test('input smoothing has the same response at 30, 60 and 144 FPS without overshoot', () => {
  const results = [30, 60, 144].map((fps) => {
    let value = 0;
    for (let i = 0; i < fps; i++) {
      value = smoothValue(value, 1, 7, 1 / fps);
      assert.ok(value >= 0 && value <= 1);
    }
    return value;
  });
  assert.ok(Math.max(...results) - Math.min(...results) < 1e-12);
});
test('warp visual envelope starts and ends cleanly and peaks halfway through', () => {
  assert.equal(jumpEnvelope(0), 0);
  assert.ok(jumpEnvelope(1) < 1e-20);
  assert.equal(jumpEnvelope(0.5), 1);
});
