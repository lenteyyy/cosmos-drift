import { create } from 'zustand';
import type { Catalog, CosmicObject, Panel, Source } from './types';
import { cabin } from './engine/audio';
import { restorePreferences } from './engine/preferences.mjs';
import {
  EXPEDITION,
  jumpDestination,
  portalExit,
  canTraverse,
  canAbortTransit,
  TRANSIT_DURATION,
} from './engine/flight.mjs';
import {
  splitPosition,
  relative,
  SpatialIndex,
  KM_PER_LY,
  DEFAULT_SPEED_LEVEL,
  clampLevel,
} from './engine/navigation.mjs';
export interface Discovery {
  id: string;
  at: string;
}
let catalogueLoad: Promise<void> | null = null;
const preferences = restorePreferences(
  (key: string) => localStorage.getItem(key),
  EXPEDITION.length,
);
interface GameState {
  catalog: Catalog | null;
  sources: Source[];
  error: string | null;
  targetId: string;
  level: number;
  throttle: number;
  autopilot: boolean;
  cockpit: boolean;
  panel: Panel;
  keyboardMode: boolean;
  lang: 'zh' | 'en';
  quality: 'high' | 'low';
  muted: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  soundVolume: number;
  voiceEnabled: boolean;
  voiceVolume: number;
  uiScale: number;
  sensitivity: number;
  jumping: boolean;
  missionStep: number;
  jump: () => void;
  traverse: (mode: 'black_hole' | 'wormhole') => void;
  findBlackHole: () => void;
  brake: () => void;
  nextDestination: () => void;
  paused: boolean;
  playing: boolean;
  toast: string | null;
  discoveries: Discovery[];
  set: (s: Partial<GameState>) => void;
  target: (id: string) => void;
  load: () => Promise<void>;
  discover: (id: string) => void;
  notify: (s: string) => void;
}
export const useGame = create<GameState>((set, get) => ({
  catalog: null,
  sources: [],
  error: null,
  targetId: EXPEDITION[preferences.missionStep] || 'moon',
  level: DEFAULT_SPEED_LEVEL,
  throttle: 0,
  autopilot: false,
  cockpit: false,
  panel: null,
  keyboardMode: false,
  lang: preferences.lang as 'zh' | 'en',
  quality: 'high',
  muted: preferences.muted,
  musicEnabled: preferences.musicEnabled,
  musicVolume: preferences.musicVolume,
  soundVolume: preferences.soundVolume,
  voiceEnabled: preferences.voiceEnabled,
  voiceVolume: preferences.voiceVolume,
  uiScale: preferences.uiScale,
  sensitivity: preferences.sensitivity,
  jumping: false,
  missionStep: preferences.missionStep,
  paused: false,
  playing: false,
  toast: null,
  discoveries: preferences.discoveries,
  set: (s) => {
    if (universe.jump?.mode === 'black_hole') s = { ...s, panel: null, paused: false };
    if ('level' in s) s = { ...s, level: clampLevel(s.level) };
    if ('throttle' in s)
      s = {
        ...s,
        throttle: Math.max(-1, Math.min(1, Number.isFinite(s.throttle) ? s.throttle! : 0)),
      };
    set(s);
    const fields = {
      lang: 'cosmos-lang',
      muted: 'cosmos-muted',
      musicEnabled: 'cosmos-music',
      musicVolume: 'cosmos-music-volume',
      soundVolume: 'cosmos-sound-volume',
      voiceEnabled: 'cosmos-voice',
      voiceVolume: 'cosmos-voice-volume',
      uiScale: 'cosmos-ui-scale',
      sensitivity: 'cosmos-sensitivity',
      missionStep: 'cosmos-mission-step',
    } as const;
    for (const [field, key] of Object.entries(fields)) {
      if (field in s)
        try {
          localStorage.setItem(key, JSON.stringify(s[field as keyof typeof fields]));
        } catch {
          /* Browser storage can be disabled. */
        }
    }
    if (s.panel && !get().keyboardMode && document.pointerLockElement) document.exitPointerLock();
  },
  target: (id) => {
    if (get().jumping || !universe.byId.has(id)) return;
    set({ targetId: id, autopilot: false });
    cabin.start();
    cabin.ping('select');
    cabin.speak('target');
  },
  brake() {
    if (universe.jump && !canAbortTransit(universe.jump.mode)) return;
    let targetId = get().targetId;
    if (universe.jump) {
      const jump = universe.jump;
      if (jump.committed) {
        targetId = jump.targetId;
        get().discover(targetId);
      }
      cabin.endTransit(jump.committed ? universe.byId.get(jump.targetId) : undefined);
      cabin.speak('abort', true);
    }
    universe.speed = 0;
    universe.jump = null;
    universe.jumpProgress = 0;
    universe.brakeRequested = true;
    universe.alignTarget = false;
    set({ throttle: 0, autopilot: false, jumping: false, targetId });
    cabin.ping('brake');
  },
  jump() {
    const s = get();
    if (s.jumping || !s.catalog) return;
    const object = universe.byId.get(s.targetId);
    if (!object) return;
    cabin.start();
    universe.jump = {
      mode: 'warp',
      duration: TRANSIT_DURATION.warp,
      sourceId: null,
      entryDirection: null,
      audioReady: true,
      targetId: object.id,
      elapsed: 0,
      committed: false,
      ...jumpDestination(object, universe.position),
    };
    universe.jumpProgress = 0;
    set({
      jumping: true,
      playing: true,
      paused: false,
      throttle: 0,
      autopilot: false,
      panel: null,
    });
    universe.speed = 0;
    cabin.warp();
    cabin.speak('warp', true);
  },
  findBlackHole() {
    const candidates = get()
      .catalog?.objects.filter((o) => o.category === 'black_hole')
      .sort((a, b) => universe.distance(a) - universe.distance(b));
    if (candidates?.[0]) get().target(candidates[0].id);
  },
  traverse(mode) {
    const s = get(),
      source = universe.byId.get(s.targetId);
    if (s.jumping || !source || !s.catalog) return;
    if (mode === 'black_hole' && !canTraverse(source, universe.distance(source))) {
      s.notify(
        s.lang === 'zh'
          ? '靠近黑洞边缘后将自动穿越'
          : 'Transit begins automatically at the black hole boundary',
      );
      return;
    }
    const exit =
      mode === 'black_hole'
        ? portalExit(
            source,
            s.catalog.objects,
            universe.position,
            Math.random,
            universe.lastPortalExit,
          )
        : source;
    if (!exit) return;
    if (mode === 'black_hole') universe.lastPortalExit = exit.id;
    cabin.start();
    const jump: NonNullable<typeof universe.jump> = {
      mode,
      duration: TRANSIT_DURATION[mode],
      sourceId: mode === 'black_hole' ? source.id : null,
      entryDirection:
        mode === 'black_hole'
          ? relative(source.cartesian, universe.position).map(
              (n: number, _: number, a: number[]) => n / (Math.hypot(...a) || 1),
            )
          : null,
      targetId: exit.id,
      elapsed: 0,
      committed: false,
      audioReady: false,
      ...jumpDestination(exit, universe.position),
    };
    universe.jump = jump;
    universe.jumpProgress = 0;
    universe.speed = 0;
    universe.brakeRequested = true;
    s.set({
      jumping: true,
      playing: true,
      paused: false,
      panel: null,
      throttle: 0,
      autopilot: false,
    });
    cabin.transitMusic(mode).finally(() => {
      if (universe.jump === jump) jump.audioReady = true;
    });
    cabin.warp(mode);
    cabin.speak(mode, true);
  },
  nextDestination() {
    const s = get();
    if (s.jumping) return;
    const id = EXPEDITION[s.missionStep];
    if (
      id === s.targetId &&
      s.discoveries.some((d) => d.id === id) &&
      s.missionStep < EXPEDITION.length - 1
    ) {
      get().set({ missionStep: s.missionStep + 1 });
      get().target(EXPEDITION[s.missionStep + 1]);
    } else get().target(id);
  },
  async load() {
    if (get().catalog && !get().error) return;
    if (catalogueLoad) return catalogueLoad;
    set({ error: null });
    catalogueLoad = (async () => {
      try {
        const responses = await Promise.all([
          fetch('/data/universe-catalog.json'),
          fetch('/data/sources.json'),
        ]);
        if (responses.some((r) => !r.ok))
          throw Error('Local catalogue missing. Run npm run data:build.');
        const [catalog, credits] = await Promise.all(responses.map((r) => r.json()));
        universe.initialize(catalog);
        set({ catalog, sources: credits.sources, error: null });
        get().discover('earth');
      } catch (e) {
        set({ error: String(e) });
      }
    })().finally(() => {
      catalogueLoad = null;
    });
    return catalogueLoad;
  },
  discover(id) {
    const currentStep = get().missionStep;
    if (EXPEDITION[currentStep] === id) {
      const next = Math.min(currentStep + 1, EXPEDITION.length - 1);
      get().set({ missionStep: next });
    }
    if (get().discoveries.some((d) => d.id === id)) return;
    const discoveries = [...get().discoveries, { id, at: new Date().toISOString() }];
    try {
      localStorage.setItem('cosmos-log', JSON.stringify(discoveries));
    } catch {}
    set({ discoveries });
    if (get().playing)
      get().notify(
        (get().lang === 'zh' ? '已发现 · ' : 'Discovered · ') +
          (universe.byId.get(id)?.[get().lang === 'zh' ? 'nameZh' : 'nameEn'] || id),
      );
  },
  notify: (toast) => {
    set({ toast });
    setTimeout(() => {
      if (get().toast === toast) set({ toast: null });
    }, 3600);
  },
}));
export interface ScreenObject {
  id: string;
  x: number;
  y: number;
  radius: number;
  distance: number;
  visible: boolean;
}
export const universe = {
  screenObjects: [] as ScreenObject[],
  hover: null as ScreenObject | null,
  cursor: { x: 0, y: 0, inside: false },
  navigation: { x: 0, y: 0, onScreen: false, behind: false, yaw: 0, pitch: 0, angle: 0 },
  pointerLocked: false,
  dragging: false,
  alignTarget: false,
  brakeRequested: false,
  requestLook: () => {},
  jump: null as null | {
    mode: 'warp' | 'black_hole' | 'wormhole';
    duration: number;
    sourceId: string | null;
    entryDirection: number[] | null;
    audioReady: boolean;
    targetId: string;
    elapsed: number;
    committed: boolean;
    destination: ReturnType<typeof splitPosition>;
    direction: number[];
    radius: number;
  },
  jumpProgress: 0,
  lastPortalExit: null as string | null,
  headingQuaternion: [0, 0, 0, 1],
  position: splitPosition({ x: 0, y: 0, z: 0 }),
  index: null as SpatialIndex | null,
  byId: new Map<string, CosmicObject>(),
  speed: 0,
  unit: 1e-10,
  heading: [0, 0, -1],
  fps: 0,
  drawCalls: 0,
  triangles: 0,
  particleCount: 0,
  effectIntensity: 0,
  travelled: 0,
  band: 0,
  elapsed: 0,
  nearest: [] as { object: CosmicObject; distance: number }[],
  initialize(catalog: Catalog) {
    this.byId = new Map(catalog.objects.map((o) => [o.id, o]));
    this.index = new SpatialIndex(
      catalog.objects.filter((o) => o.id !== 'cosmic-web' && o.id !== 'horizon'),
    );
    this.reset();
  },
  reset() {
    const earth = this.byId.get('earth');
    if (!earth) return;
    const r = 6371 / KM_PER_LY;
    this.position = splitPosition({
      x: earth.cartesian.x + r * 0.7,
      y: -r * 0.1,
      z: earth.cartesian.z + r * 4.4,
    });
    this.speed = 0;
    this.jump = null;
    this.jumpProgress = 0;
    this.lastPortalExit = null;
    this.hover = null;
    this.brakeRequested = true;
    this.unit = r / 5;
    this.travelled = 0;
    this.elapsed = 0;
    this.band = 0;
    this.nearest = [];
  },
  distance(o: CosmicObject) {
    return Math.hypot(...relative(o.cartesian, this.position));
  },
};
