/** Floating origin with split 1 ly sectors. Sub-sector motion survives at cosmic distances. */
export const SECTOR = 1;
export const KM_PER_LY = 9.4607304725808e12;
export const AU_LY = 1 / 63241.077;
export const HORIZON = 46.5e9;
export const MIN_SPEED = 0.00001 / KM_PER_LY; // 1 cm/s
export const MAX_SPEED = 5e8; // 500 million ly/s, including boosts and strafing.
export const SPEEDS = [
  MIN_SPEED,
  0.0001 / KM_PER_LY,
  0.001 / KM_PER_LY,
  0.01 / KM_PER_LY,
  0.1 / KM_PER_LY,
  1 / KM_PER_LY,
  30 / KM_PER_LY,
  300 / KM_PER_LY,
  0.001 * AU_LY,
  0.1 * AU_LY,
  10 * AU_LY,
  0.1,
  1,
  100,
  1e4,
  1e5,
  1e6,
  1e7,
  1e8,
  MAX_SPEED,
];
export const SPEED_LABELS = [
  'Docking I',
  'Docking II',
  'Maneuver I',
  'Maneuver II',
  'Impulse I',
  'Impulse II',
  'Impulse III',
  'Impulse IV',
  'Warp 1',
  'Warp 2',
  'Warp 3',
  'Warp 4',
  'Warp 5',
  'Warp 6',
  'Deep Space I',
  'Deep Space II',
  'Deep Space III',
  'Deep Space IV',
  'Deep Space V',
  'Horizon Drive',
];
export const DEFAULT_SPEED_LEVEL = 7;
export function clampLevel(level) {
  return Math.max(
    0,
    Math.min(SPEEDS.length - 1, Number.isFinite(level) ? level : DEFAULT_SPEED_LEVEL),
  );
}
/** Continuous logarithmic interpolation; fractional input is never rounded into a gear. */
export function speedAtLevel(level) {
  const value = clampLevel(level),
    index = Math.floor(value),
    next = Math.min(SPEEDS.length - 1, index + 1);
  return Math.min(
    MAX_SPEED,
    SPEEDS[index] * Math.exp(Math.log(SPEEDS[next] / SPEEDS[index]) * (value - index)),
  );
}
export function levelForSpeed(speed) {
  const value = Math.max(
    MIN_SPEED,
    Math.min(MAX_SPEED, Number.isFinite(speed) ? speed : MIN_SPEED),
  );
  const next = SPEEDS.findIndex((v) => v >= value);
  if (next <= 0) return 0;
  return next - 1 + Math.log(value / SPEEDS[next - 1]) / Math.log(SPEEDS[next] / SPEEDS[next - 1]);
}
/** Trackpads use pixels, traditional wheels may use lines/pages. No dead zone or accumulator. */
export function wheelSpeedLevel(level, delta, mode = 0, pageHeight = 800, fine = false) {
  if (!Number.isFinite(delta) || delta === 0) return clampLevel(level);
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? pageHeight : 1);
  const exponent = Math.max(-60, Math.min(60, -pixels * 0.0035 * (fine ? 0.1 : 1)));
  return levelForSpeed(speedAtLevel(level) * Math.exp(exponent));
}
export function flightSpeedLimit(level, boost = false) {
  return Math.min(MAX_SPEED, speedAtLevel(level) * (boost ? 4 : 1));
}
/** Absolute speed, rather than render-unit scaling, drives the visual acceleration. */
export function flightEffects(speed) {
  const value = Math.max(0, Math.min(MAX_SPEED, Math.abs(speed)));
  const intensity = value
    ? Math.max(0, Math.min(1, Math.log1p(value / MIN_SPEED) / Math.log1p(MAX_SPEED / MIN_SPEED)))
    : 0;
  return {
    intensity,
    opacity: intensity ** 1.8 * 0.88,
    length: 1 + intensity ** 2 * 42,
    rate: 4 + intensity ** 2 * 250,
    count: Math.round(900 * intensity ** 1.45),
  };
}
export const BANDS = [
  { name: 'Earth vicinity', zh: '地球近地空间', max: 0.01 * AU_LY },
  { name: 'Solar System', zh: '太阳系', max: 1000 * AU_LY },
  { name: 'Stellar neighbourhood', zh: '邻近恒星', max: 1e3 },
  { name: 'Milky Way', zh: '银河系', max: 150e3 },
  { name: 'Local Group', zh: '本星系群', max: 1e7 },
  { name: 'Nearby Universe', zh: '近邻宇宙', max: 3e8 },
  { name: 'Clusters & superclusters', zh: '星系团与超星系团', max: 2e9 },
  { name: 'Deep Universe', zh: '深层宇宙', max: 15e9 },
  { name: 'Observable Universe', zh: '可观测宇宙', max: Infinity },
];
export function splitPosition(p) {
  const sector = [0, 0, 0],
    local = [0, 0, 0];
  [p.x, p.y, p.z].forEach((n, i) => {
    sector[i] = Math.round(n / SECTOR);
    local[i] = n - sector[i] * SECTOR;
  });
  return { sector, local, residual: [0, 0, 0] };
}
export function translate(p, delta) {
  p.residual ??= [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    // Error-free two-sum keeps sub-millimetre motion even when local is ~0.5 ly.
    const before = p.local[i],
      increment = delta[i],
      sum = before + increment,
      recovered = sum - before,
      error = before - (sum - recovered) + (increment - recovered) + p.residual[i];
    const shift = Math.round(sum / SECTOR);
    p.sector[i] += shift;
    const remainder = sum - shift * SECTOR,
      hi = remainder + error,
      loPart = hi - remainder;
    p.local[i] = hi;
    p.residual[i] = remainder - (hi - loPart) + (error - loPart);
  }
  return p;
}
export function relative(target, origin) {
  const p = target.sector ? target : splitPosition(target);
  return p.sector.map((n, i) => {
    const difference = p.local[i] - origin.local[i],
      recovered = difference - p.local[i],
      error = p.local[i] - (difference - recovered) + (-origin.local[i] - recovered);
    return (
      (n - origin.sector[i]) * SECTOR +
      difference +
      error +
      ((p.residual?.[i] || 0) - (origin.residual?.[i] || 0))
    );
  });
}
export function absolute(p) {
  return {
    x: p.sector[0] * SECTOR + p.local[0],
    y: p.sector[1] * SECTOR + p.local[1],
    z: p.sector[2] * SECTOR + p.local[2],
  };
}
export function bandForDistance(d) {
  return Math.max(
    0,
    BANDS.findIndex((b) => d < b.max),
  );
}
export function formatDistance(ly) {
  const a = Math.abs(ly);
  if (a < 0.01 * AU_LY)
    return `${(ly * KM_PER_LY).toLocaleString('en-US', { maximumFractionDigits: 0 })} km`;
  if (a < 0.1) return `${(ly / AU_LY).toLocaleString('en-US', { maximumFractionDigits: 2 })} AU`;
  if (a < 1e3) return `${ly.toFixed(a < 10 ? 2 : 1)} ly`;
  if (a < 1e6) return `${(ly / 1e3).toFixed(2)} kly`;
  if (a < 1e9) return `${(ly / 1e6).toFixed(2)} Mly`;
  return `${(ly / 1e9).toFixed(2)} Gly`;
}
export function formatSpeed(ly) {
  const value = Number.isFinite(ly) ? ly : 0,
    a = Math.abs(value),
    km = a * KM_PER_LY;
  const number = (n) => n.toLocaleString('en-US', { maximumSignificantDigits: 7 });
  if (km < 1) return `${number(value * KM_PER_LY * 1000)} m/s`;
  if (a < 0.001 * AU_LY) return `${number(value * KM_PER_LY)} km/s`;
  if (a < 0.1) return `${number(value / AU_LY)} AU/s`;
  if (a < 1e3) return `${number(value)} ly/s`;
  if (a < 1e6) return `${number(value / 1e3)} kly/s`;
  return `${number(value / 1e6)} Mly/s`;
}
export function stopRadius(o) {
  if (o.id === 'horizon') return 1e6;
  if (o.category === 'black_hole') return Math.max((o.scaleLy || 0) * 8, 0.00000002);
  if (['planet', 'moon', 'dwarf_planet', 'exoplanet', 'star'].includes(o.category))
    return Math.max(
      ((Number(o.physical?.radiusKm) || Number(o.physical?.renderRadiusKm) || 6371) / KM_PER_LY) *
        3.8,
      1e-11,
    );
  return Math.max((o.scaleLy || 1000) * 0.55, 1);
}
export function autopilotStep(distance, stop, maxSpeed, dt) {
  const gap = Math.max(0, distance - stop);
  const speed = Math.max(0, Math.min(MAX_SPEED, maxSpeed, gap * 1.6));
  return { step: Math.min(gap, speed * dt), speed, arrived: gap <= Math.max(stop * 0.008, 1e-13) };
}
/** Immutable k-d tree used for nearest and range queries; positions always catalogue anchored. */
export class SpatialIndex {
  constructor(objects) {
    this.positions = new Map(objects.map((o) => [o.id, splitPosition(o.cartesian)]));
    const build = (a, depth) => {
      if (!a.length) return null;
      const axis = ['x', 'y', 'z'][depth % 3];
      a.sort((x, y) => x.cartesian[axis] - y.cartesian[axis]);
      const m = Math.floor(a.length / 2);
      return {
        o: a[m],
        axis,
        left: build(a.slice(0, m), depth + 1),
        right: build(a.slice(m + 1), depth + 1),
      };
    };
    this.root = build([...objects], 0);
  }
  nearest(p, limit = 16, predicate = () => true) {
    const v = absolute(p),
      best = [];
    const walk = (n) => {
      if (!n) return;
      const r = relative(this.positions.get(n.o.id), p),
        d = Math.hypot(...r);
      if (predicate(n.o)) {
        best.push({ object: n.o, distance: d });
        best.sort((a, b) => a.distance - b.distance);
        if (best.length > limit) best.pop();
      }
      const axis = n.axis,
        delta = v[axis] - n.o.cartesian[axis];
      walk(delta < 0 ? n.left : n.right);
      if (best.length < limit || Math.abs(delta) < best.at(-1).distance)
        walk(delta < 0 ? n.right : n.left);
    };
    walk(this.root);
    return best;
  }
}
