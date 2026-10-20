import { flightEffects, KM_PER_LY } from './navigation.mjs';
/** Cabin vibration, turbine harmonics and filtered drive noise blend continuously with speed. */
export function engineSound(speed, active = true, transit = 0) {
  const value = Number.isFinite(speed) ? Math.abs(speed) : 0;
  const intensity = Math.max(flightEffects(value).intensity, Math.min(1, transit));
  const warp = Math.max(0, Math.min(1, (intensity - 0.5) / 0.35));
  const deep = Math.max(0, Math.min(1, (intensity - 0.84) / 0.16));
  return {
    mode:
      value < 1 / KM_PER_LY ? 'docking' : value < 0.001 ? 'impulse' : value < 1e6 ? 'warp' : 'deep',
    fundamental: 32 + intensity ** 1.4 * 108,
    turbine: 90 + intensity ** 2 * 1110,
    cutoff: 130 + intensity ** 3 * 3870,
    gain: active ? 0.003 + intensity * 0.045 : 0,
    harmonic: 0.12 + warp * 0.45 + deep * 0.28,
    noise: intensity ** 1.8 * 0.48,
  };
}
