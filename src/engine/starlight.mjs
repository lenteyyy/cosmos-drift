import { AU_LY } from './navigation.mjs';
/** Apparent magnitude follows the inverse-square distance law; display exposure is compressed. */
export function starlight(object, distance) {
  if (object.category !== 'star')
    return { magnitude: null, brightness: object.category === 'galaxy' ? 0.8 : 0.55 };
  const home = object.id === 'sun' ? AU_LY : Math.max(object.distanceLy || 32.6156, 1e-12);
  const recorded = object.id === 'sun' ? -26.74 : Number(object.physical?.magnitude ?? 4.83);
  const magnitude = recorded + 5 * Math.log10(Math.max(distance, 1e-14) / home);
  return { magnitude, brightness: Math.max(0.16, Math.min(3.5, 10 ** (-0.16 * (magnitude - 2)))) };
}
