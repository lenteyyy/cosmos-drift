import { LOCAL_MEDIA } from './local-media.mjs';
/** Ten redistributable original scores; private additions are included only when present. */
/** @type {Array<{id:string,title:string,scene:string,seconds:number,file?:string,supplied?:boolean}>} */
export const ORIGINAL_TRACKS = [
  { id: 'blue-orbit', title: 'Blue Orbit', scene: 'solar', seconds: 80 },
  { id: 'stellar-tides', title: 'Stellar Tides', scene: 'stellar', seconds: 80 },
  { id: 'andromeda', title: 'Galactic Letters', scene: 'galaxy', seconds: 80 },
  { id: 'silent-expanse', title: 'Silent Expanse', scene: 'deep', seconds: 80 },
  { id: 'event-horizon', title: 'Event Horizon', scene: 'black_hole', seconds: 80 },
  { id: 'folded-light', title: 'Folded Light', scene: 'wormhole', seconds: 80 },
  { id: 'abyssal-current', title: 'Abyssal Current', scene: 'black_hole', seconds: 120 },
  { id: 'intergalactic-rain', title: 'Intergalactic Rain', scene: 'galaxy', seconds: 120 },
  { id: 'dark-matter', title: 'Dark Matter', scene: 'deep', seconds: 120 },
  { id: 'beyond-the-veil', title: 'Beyond the Veil', scene: 'wormhole', seconds: 120 },
];
export const SUPPLIED_TRACKS = [
  {
    id: 'cornfield-chase',
    title: 'Cornfield Chase',
    scene: 'solar',
    seconds: 127.007347,
    file: 'cornfield-chase.mp3',
    supplied: true,
  },
  {
    id: 'end-of-the-world-sun',
    title: 'End Of The World Sun',
    scene: 'deep',
    seconds: 446.376,
    file: 'end-of-the-world-sun.mp3',
    supplied: true,
  },
  {
    id: 'supermoon',
    title: 'Supermoon',
    scene: 'galaxy',
    seconds: 262.4,
    file: 'supermoon.mp3',
    supplied: true,
  },
];
export const TRACKS = [
  ...ORIGINAL_TRACKS,
  ...SUPPLIED_TRACKS.filter((track) => LOCAL_MEDIA.music.includes(track.file)),
];
export function musicIndex(scene, current = -1, region = '') {
  const matches = TRACKS.map((t, i) => (t.scene === scene ? i : -1)).filter((i) => i >= 0);
  const preferred = [...matches].reverse().find((i) => i !== current) ?? -1;
  if (scene === 'galaxy' && region) {
    let hash = 0;
    for (const c of region) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    const choice = hash % TRACKS.length;
    return choice === current ? (choice + 1) % TRACKS.length : choice;
  }
  return preferred < 0 || preferred === current ? (current + 1) % TRACKS.length : preferred;
}
export function musicScene(object) {
  if (object.category === 'black_hole') return 'black_hole';
  if (object.category === 'galaxy') return 'galaxy';
  return object.distanceLy < 0.01 ? 'solar' : object.distanceLy < 100000 ? 'stellar' : 'deep';
}
