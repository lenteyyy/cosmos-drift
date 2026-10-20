import { relative, splitPosition, translate, stopRadius } from './navigation.mjs';
export const EXPEDITION = [
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
  'horizon',
];
export const JUMP_DURATION = 3.2;
export const TRANSIT_DURATION = { warp: JUMP_DURATION, black_hole: 10, wormhole: 8 };
/** Fictional random transit; endpoints remain real, distant catalogue objects.
 * @param {string | null} previousId
 */
export function portalExit(source, objects, departure, random = Math.random, previousId = null) {
  const structureTypes = [
    'galaxy_group',
    'galaxy_cluster',
    'supercluster',
    'wall',
    'filament',
    'void',
  ];
  const candidates = objects.filter(
    (o) =>
      o.id !== source.id &&
      o.id !== source.hostId &&
      o.id !== 'cosmic-web' &&
      (o.category === 'galaxy' || structureTypes.includes(o.category)) &&
      Math.hypot(...relative(o.cartesian, departure)) > 1e6,
  );
  const fresh = candidates.filter((o) => o.id !== previousId);
  const available = fresh.length ? fresh : candidates;
  const galaxies = available.filter((o) => o.category === 'galaxy'),
    structures = available.filter((o) => o.category !== 'galaxy');
  const preferred = random() < 0.65 ? galaxies : structures;
  const pool = preferred.length ? preferred : available;
  return pool.length
    ? pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))]
    : null;
}
export function canTraverse(object, distance) {
  return object?.category === 'black_hole' && distance <= stopRadius(object) * 1.6;
}
/** Test the swept flight segment so high-speed flight cannot skip a capture boundary. */
export function capturedBlackHole(objects, from, to) {
  const delta = relative(to, from),
    length2 = delta.reduce((sum, n) => sum + n * n, 0);
  let first = null,
    firstTime = Infinity;
  for (const object of objects) {
    if (object.category !== 'black_hole') continue;
    const offset = relative(object.cartesian, from),
      radius = stopRadius(object) * 1.6;
    const start2 = offset.reduce((sum, n) => sum + n * n, 0);
    let entry = 0;
    if (start2 > radius * radius) {
      if (!length2) continue;
      const projection = offset.reduce((sum, n, i) => sum + n * delta[i], 0) / length2;
      const closest2 = offset.reduce((sum, n, i) => sum + (n - projection * delta[i]) ** 2, 0);
      if (closest2 > radius * radius) continue;
      entry = projection - Math.sqrt(Math.max(0, radius * radius - closest2) / length2);
      if (entry < 0 || entry > 1) continue;
    }
    if (entry < firstTime) {
      first = object;
      firstTime = entry;
    }
  }
  return first ? { object: first, fraction: firstTime } : null;
}
export const canAbortTransit = (mode) => mode !== 'black_hole';
export function smoothValue(current, target, response, dt) {
  return current + (target - current) * (1 - Math.exp(-response * Math.max(0, dt)));
}
/** Arrival remains outside the destination's observation radius, even for co-located anchors. */
export function jumpDestination(object, departure) {
  const d = relative(object.cartesian, departure),
    length = Math.hypot(...d);
  const direction = length > 1e-20 ? d.map((n) => n / length) : [0, 0, -1];
  const radius = stopRadius(object) * 1.18;
  const destination = splitPosition(object.cartesian);
  translate(
    destination,
    direction.map((n) => -n * radius),
  );
  return { destination, direction, radius };
}
export function jumpEnvelope(progress) {
  const p = Math.max(0, Math.min(1, progress));
  return Math.sin(Math.PI * p) ** 2;
}
/** Screen-space hits use the rendered body radius. Front objects occlude distant points. */
export function pickScreenObject(objects, x, y) {
  let hit = null;
  for (const o of objects) {
    if (!o.visible) continue;
    const d = Math.hypot(x - o.x, y - o.y);
    if (d > Math.max(10, o.radius)) continue;
    if (!hit || o.distance < hit.distance) hit = o;
  }
  return hit;
}
export function navigationCue(local, width, height) {
  const [x, y, z] = local;
  const front = z < 0;
  const yaw = (Math.atan2(x, -z) * 180) / Math.PI,
    pitch = (Math.atan2(y, Math.hypot(x, z)) * 180) / Math.PI;
  const halfY = Math.tan((55 * Math.PI) / 360),
    halfX = (halfY * width) / height;
  const nx = front ? x / (-z * halfX) : Math.sign(x || 1) * 4,
    ny = front ? -y / (-z * halfY) : (-y / Math.max(Math.hypot(x, z), 1e-12)) * 4;
  const minX = Math.min(90, width * 0.15),
    maxX = width - minX,
    minY = Math.min(120, height * 0.2),
    maxY = height - Math.min(210, height * 0.3);
  const px = width / 2 + (nx * width) / 2,
    py = height / 2 + (ny * height) / 2;
  const onScreen = front && px > minX && px < maxX && py > minY && py < maxY;
  return {
    x: Math.max(minX, Math.min(maxX, px)),
    y: Math.max(minY, Math.min(maxY, py)),
    onScreen,
    behind: !front,
    yaw,
    pitch,
    angle: (Math.atan2(ny, nx) * 180) / Math.PI,
  };
}
