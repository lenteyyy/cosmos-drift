import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGame, universe } from '../store';
import { cabin } from '../engine/audio';
import { isPageActive } from '../engine/page-activity';
import {
  frameSlot,
  resolutionForLoad,
  shouldRenderContinuously,
} from '../engine/render-policy.mjs';
function needsFrames() {
  const s = useGame.getState();
  return shouldRenderContinuously({
    foreground: isPageActive(),
    paused: s.paused,
    panel: !!s.panel,
    captured: universe.jump?.mode === 'black_hole',
    jumping: s.jumping,
    pauseAnimations: s.pauseAnimations,
    motion:
      universe.motionActive || Math.abs(s.throttle) > 0 || s.autopilot || universe.alignTarget,
  });
}
export function RenderController({ foreground }: { foreground: boolean }) {
  const advance = useThree((state) => state.advance);
  const setDpr = useThree((state) => state.setDpr);
  const get = useThree((state) => state.get);
  const quality = useGame((s) => s.quality);
  const catalog = useGame((s) => s.catalog);
  const load = useRef({ frames: 0, time: 0, recovery: 0, continuous: false });
  useEffect(() => {
    load.current = { frames: 0, time: 0, recovery: 0, continuous: false };
    if (!foreground) return;
    let raf: number | null = null;
    let requested = false;
    let deadline = performance.now();
    const schedule = () => {
      if (raf === null && isPageActive()) raf = requestAnimationFrame(tick);
    };
    const tick = (timestamp: number) => {
      raf = null;
      if (!isPageActive()) return;
      const slot = frameSlot(timestamp, deadline);
      if (slot.render && (requested || needsFrames())) {
        deadline = slot.deadline;
        requested = false;
        // R3F's manual clock takes seconds; RAF supplies milliseconds.
        advance(timestamp / 1000, false);
      }
      if (requested || needsFrames()) schedule();
    };
    const wake = () => {
      requested = true;
      schedule();
    };
    const pointer = (event: MouseEvent) => {
      if ((event.target as HTMLElement)?.tagName === 'CANVAS' || document.pointerLockElement)
        wake();
    };
    const unsubscribe = useGame.subscribe(wake);
    window.addEventListener('keydown', wake);
    window.addEventListener('keyup', wake);
    window.addEventListener('pointerdown', wake);
    window.addEventListener('pointerup', wake);
    window.addEventListener('mousemove', pointer);
    window.addEventListener('resize', wake);
    window.addEventListener('cosmos-audio-change', wake);
    window.addEventListener('cosmos-assets-change', wake);
    wake();
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      unsubscribe();
      window.removeEventListener('keydown', wake);
      window.removeEventListener('keyup', wake);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('pointerup', wake);
      window.removeEventListener('mousemove', pointer);
      window.removeEventListener('resize', wake);
      window.removeEventListener('cosmos-audio-change', wake);
      window.removeEventListener('cosmos-assets-change', wake);
    };
  }, [foreground, quality, catalog, advance]);
  useEffect(() => {
    cabin.setBackgroundSuspended(!foreground);
  }, [foreground]);
  useFrame((_, delta) => {
    if (!needsFrames()) {
      load.current = { frames: 0, time: 0, recovery: 0, continuous: false };
      return;
    }
    const sample = load.current;
    if (sample.continuous) {
      sample.frames++;
      sample.time += Math.min(delta, 0.25);
      if (sample.time >= 1.5) {
        const fps = sample.frames / sample.time;
        sample.recovery = fps >= 59 ? sample.recovery + sample.time : 0;
        const dpr = get().viewport.dpr;
        const next = resolutionForLoad(dpr, fps, useGame.getState().quality, sample.recovery >= 10);
        if (next !== dpr) {
          setDpr(next);
          sample.recovery = 0;
        }
        universe.adaptiveDpr = next;
        universe.effectsReduced = next < 0.85;
        sample.frames = sample.time = 0;
      }
    }
    sample.continuous = true;
  });
  return null;
}
