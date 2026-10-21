import { memo, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as T from 'three';
import { useGame, universe, type ScreenObject } from '../store';
import {
  absolute,
  relative,
  translate,
  MAX_SPEED,
  speedAtLevel,
  flightSpeedLimit,
  wheelSpeedLevel,
  flightEffects,
  bandForDistance,
  stopRadius,
  autopilotStep,
  KM_PER_LY,
  HORIZON,
} from '../engine/navigation.mjs';
import {
  jumpEnvelope,
  smoothValue,
  pickScreenObject,
  navigationCue,
  capturedBlackHole,
} from '../engine/flight.mjs';
import {
  animateMaterials,
  createSlot,
  setSlot,
  makeMilkyWay,
  makeShip,
  makeCosmicWeb,
  random,
  starColor,
  pointTexture,
} from '../engine/visuals';
import { cabin } from '../engine/audio';
import { starlight } from '../engine/starlight.mjs';
import { createPaperBackground } from '../engine/paper-background';
import { isPageActive, usePageActive } from '../engine/page-activity';
import { renderBudget } from '../engine/render-policy.mjs';
import { RenderController } from './RenderController';
const sphereShared = new T.SphereGeometry(1, 48, 32),
  lowSphereShared = new T.SphereGeometry(1, 16, 10);
const forward = new T.Vector3(),
  right = new T.Vector3(),
  movement = new T.Vector3(),
  desiredVelocity = new T.Vector3(),
  q = new T.Quaternion(),
  axis = new T.Vector3(),
  desired = new T.Quaternion(),
  matrix = new T.Matrix4(),
  look = new T.Vector3(),
  screen = new T.Vector3(),
  zero = new T.Vector3(),
  up = new T.Vector3(0, 1, 0),
  inverse = new T.Quaternion();
function World() {
  const { camera, gl, size } = useThree();
  const quality = useGame((s) => s.quality),
    catalog = useGame((s) => s.catalog);
  const orientation = useRef(new T.Quaternion()),
    command = useRef(new T.Quaternion()),
    velocity = useRef(new T.Vector3()),
    keys = useRef(new Set<string>()),
    mouse = useRef({ x: 0, y: 0 }),
    rates = useRef({ yaw: 0, pitch: 0, roll: 0, strafe: 0 }),
    drag = useRef(false),
    clock = useRef(0),
    accum = useRef(0),
    fps = useRef({ time: 0, frames: 0 }),
    particlePhase = useRef(0);
  const world = useMemo(() => {
    const root = new T.Group(),
      slots = Array.from({ length: 64 }, () => createSlot());
    const paper = createPaperBackground();
    root.add(paper.mesh);
    slots.forEach((s) => root.add(s.group));
    const objects = (catalog?.objects || []).filter(
      (o) => o.id !== 'horizon' && o.id !== 'cosmic-web',
    );
    const positions = new Float32Array(objects.length * 3),
      colors = new Float32Array(objects.length * 3),
      brightness = new Float32Array(objects.length);
    objects.forEach((o, i) => {
      const color = new T.Color(
        o.category === 'star'
          ? starColor(String(o.physical.spectralType || 'G'))
          : o.category === 'galaxy'
            ? '#aacbdf'
            : o.category === 'black_hole'
              ? '#eabb8c'
              : '#b5dacf',
      );
      colors.set(color.toArray(), i * 3);
    });
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      'position',
      new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage),
    );
    geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
    geometry.setAttribute(
      'brightness',
      new T.BufferAttribute(brightness, 1).setUsage(T.DynamicDrawUsage),
    );
    const points = new T.Points(
      geometry,
      new T.ShaderMaterial({
        uniforms: { map: { value: pointTexture }, pixelRatio: { value: gl.getPixelRatio() } },
        vertexShader: `attribute vec3 color;attribute float brightness;uniform float pixelRatio;varying vec3 tint;varying float glow;
        void main(){tint=color;glow=brightness;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(3.+brightness*4.,3.,17.)*pixelRatio;}`,
        fragmentShader: `uniform sampler2D map;varying vec3 tint;varying float glow;void main(){float a=texture2D(map,gl_PointCoord).a;if(a<.015)discard;gl_FragColor=vec4(tint*(.8+glow*1.8),a*min(1.,glow));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
        blending: T.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    points.frustumCulled = false;
    points.userData.catalogueIds = objects.map((o) => o.id);
    root.add(points);
    const milky = makeMilkyWay(quality === 'low'),
      ship = makeShip(),
      web = makeCosmicWeb();
    // The nebular/dust layers remain continuous. Every luminous point is a real catalogue entry.
    milky.children
      .filter((o) => o instanceof T.Points)
      .forEach((o) => {
        o.visible = false;
      });
    web.children
      .filter((o) => o instanceof T.Points)
      .forEach((o) => {
        o.visible = false;
      });
    root.add(milky, ship, web);
    const rng = random(944),
      maxParticles = quality === 'low' ? 450 : 900,
      p = new Float32Array(maxParticles * 6),
      particleSeeds = new Float32Array(maxParticles * 3);
    for (let i = 0; i < maxParticles; i++) {
      const a = rng() * Math.PI * 2,
        r = 1.5 + rng() * 42,
        z = rng() * 120;
      particleSeeds.set([Math.cos(a) * r, Math.sin(a) * r, z], i * 3);
      p.set(
        [Math.cos(a) * r, Math.sin(a) * r, -z, Math.cos(a) * r, Math.sin(a) * r, -z + 1],
        i * 6,
      );
    }
    const streaks = new T.LineSegments(
      new T.BufferGeometry().setAttribute(
        'position',
        new T.BufferAttribute(p, 3).setUsage(T.DynamicDrawUsage),
      ),
      new T.LineBasicMaterial({
        color: '#c7eaff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    streaks.frustumCulled = false;
    root.add(streaks);
    const horizon = new T.Mesh(
      new T.SphereGeometry(2200, 32, 16),
      new T.ShaderMaterial({
        side: T.BackSide,
        transparent: true,
        depthWrite: false,
        uniforms: { opacity: { value: 0 } },
        vertexShader:
          'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:
          'varying vec3 p;uniform float opacity;void main(){float n=sin(p.x*.023+sin(p.y*.017)*5.)*sin(p.z*.013)+sin(p.y*.034+p.z*.026)*.4;vec3 c=mix(vec3(.06,.13,.22),vec3(.65,.28,.13),n*.5+.5);gl_FragColor=vec4(c,opacity);}',
      }),
    );
    root.add(horizon);
    const portal = new T.Mesh(
      new T.TorusGeometry(3.2, 0.09, 12, 100),
      new T.MeshBasicMaterial({
        color: '#8feaff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    root.add(portal);
    const transitRings = new T.Group(),
      ringGeometry = new T.TorusGeometry(3, 0.018, 6, 96),
      ringMaterial = new T.MeshBasicMaterial({
        color: '#b6b5ff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        blending: T.AdditiveBlending,
      });
    for (let i = 0; i < 16; i++) {
      const ring = new T.Mesh(ringGeometry, ringMaterial);
      ring.renderOrder = 9;
      transitRings.add(ring);
    }
    root.add(transitRings);
    return {
      root,
      paper,
      blackHoles: objects.filter((object) => object.category === 'black_hole'),
      slots,
      milky,
      ship,
      web,
      streaks,
      particleSeeds,
      maxParticles,
      horizon,
      points,
      objects,
      positions,
      brightness,
      portal,
      transitRings,
      ringGeometry,
      ringMaterial,
    };
  }, [quality, catalog]);
  useEffect(() => {
    camera.near = 0.015;
    camera.far = 5000;
    camera.updateProjectionMatrix();
    const canvas = gl.domElement;
    const requestLook = () => {
      if (useGame.getState().panel) return;
      cabin.start();
      canvas
        .requestPointerLock()
        ?.catch(() =>
          useGame
            .getState()
            .notify(
              useGame.getState().lang === 'zh'
                ? '也可按住鼠标右键拖动转向'
                : 'Hold right mouse and drag to steer',
            ),
        );
    };
    universe.requestLook = requestLook;
    const keydown = (e: KeyboardEvent) => {
      const s = useGame.getState(),
        k = e.code;
      if (universe.jump?.mode === 'black_hole') {
        if (['Space', 'KeyM', 'KeyI', 'KeyP'].includes(k)) e.preventDefault();
        return;
      }
      if (k === 'Escape') {
        s.set({ panel: null });
        drag.current = false;
        universe.dragging = false;
        return;
      }
      const typing = (e.target as HTMLElement)?.matches('input,textarea,select');
      if (!typing && (k === 'KeyM' || k === 'KeyI')) {
        e.preventDefault();
        if (e.repeat || s.jumping) return;
        const panel = k === 'KeyM' ? 'map' : 'info';
        keys.current.clear();
        mouse.current = { x: 0, y: 0 };
        s.set({ panel: s.panel === panel ? null : panel, keyboardMode: true, playing: true });
        cabin.start();
        return;
      }
      if (typing && k !== 'Space') return;
      if (s.panel) return;
      if (!s.keyboardMode) s.set({ keyboardMode: true });
      if (
        [
          'Tab',
          'Space',
          'KeyQ',
          'KeyE',
          'KeyM',
          'KeyI',
          'KeyF',
          'KeyJ',
          'KeyG',
          'KeyR',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
        ].includes(k)
      )
        e.preventDefault();
      keys.current.add(k);
      if (e.repeat) return;
      cabin.start();
      if (k === 'Space') {
        s.brake();
        velocity.current.set(0, 0, 0);
        keys.current.delete('KeyW');
        keys.current.delete('KeyS');
        return;
      }
      if (s.jumping) return;
      if (k === 'Enter') {
        const hit = pickScreenObject(
          universe.screenObjects,
          canvas.clientWidth / 2,
          canvas.clientHeight / 2,
        );
        if (hit) s.target(hit.id);
      }
      if (k === 'KeyF') {
        s.set({ autopilot: !s.autopilot, playing: true });
        cabin.ping();
      }
      if (k === 'KeyJ') s.jump();
      if (k === 'KeyO') s.traverse('wormhole');
      if (k === 'KeyB') s.findBlackHole();
      if (k === 'KeyR') s.nextDestination();
      if (k === 'KeyG') universe.alignTarget = true;
      if (k === 'KeyL') requestLook();
      if (k === 'KeyV') s.set({ cockpit: !s.cockpit });
      if (k === 'KeyP') s.set({ paused: !s.paused });
      if (k === 'BracketRight' || k === 'Equal' || k === 'NumpadAdd')
        s.set({ level: wheelSpeedLevel(s.level, -12, 0, canvas.clientHeight, e.altKey) });
      if (k === 'BracketLeft' || k === 'Minus' || k === 'NumpadSubtract')
        s.set({ level: wheelSpeedLevel(s.level, 12, 0, canvas.clientHeight, e.altKey) });
      if (k === 'Tab') {
        const nearby = universe.nearest;
        const i = nearby.findIndex((n) => n.object.id === s.targetId);
        if (nearby.length)
          s.target(nearby[(i + (e.shiftKey ? -1 : 1) + nearby.length) % nearby.length].object.id);
      }
    };
    const keyup = (e: KeyboardEvent) => keys.current.delete(e.code);
    const move = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      universe.cursor = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        inside: e.target === canvas,
      };
      const s = useGame.getState();
      if (s.keyboardMode && !document.pointerLockElement && (e.movementX || e.movementY))
        s.set({ keyboardMode: false });
      if (!drag.current && document.pointerLockElement !== canvas) return;
      if (s.panel || s.paused || s.jumping) return;
      mouse.current.x += Math.max(-150, Math.min(150, e.movementX)) * s.sensitivity;
      mouse.current.y += Math.max(-150, Math.min(150, e.movementY)) * s.sensitivity;
      universe.alignTarget = false;
      if (s.autopilot) s.set({ autopilot: false });
    };
    const down = (e: MouseEvent) => {
      if (e.button === 2 && !useGame.getState().panel) {
        drag.current = true;
        universe.dragging = true;
        useGame.getState().set({ playing: true });
        cabin.start();
        e.preventDefault();
      }
    };
    const release = () => {
      drag.current = false;
      universe.dragging = false;
    };
    const click = (e: MouseEvent) => {
      const s = useGame.getState();
      if (s.panel || s.jumping || e.button !== 0) return;
      cabin.start();
      s.set({ playing: true });
    };
    const dblclick = (e: MouseEvent) => {
      const s = useGame.getState();
      if (s.panel || s.jumping || e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      const hit = pickScreenObject(
        universe.screenObjects,
        universe.pointerLocked ? rect.width / 2 : e.clientX - rect.left,
        universe.pointerLocked ? rect.height / 2 : e.clientY - rect.top,
      );
      if (hit) s.target(hit.id);
    };
    const scroll = (e: WheelEvent) => {
      const s = useGame.getState();
      if (s.panel || s.paused || s.jumping || e.ctrlKey) return;
      e.preventDefault();
      s.set({
        level: wheelSpeedLevel(s.level, e.deltaY, e.deltaMode, canvas.clientHeight, e.altKey),
      });
    };
    const blur = () => {
      keys.current.clear();
      mouse.current = { x: 0, y: 0 };
      release();
      if (!useGame.getState().jumping) {
        universe.brakeRequested = true;
        useGame.getState().set({ throttle: 0, autopilot: false });
      }
    };
    const leave = () => {
      universe.cursor.inside = false;
      universe.hover = null;
    };
    const context = (e: Event) => e.preventDefault();
    const locked = () => {
      universe.pointerLocked = document.pointerLockElement === canvas;
      mouse.current = { x: 0, y: 0 };
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', release);
    window.addEventListener('blur', blur);
    document.addEventListener('pointerlockchange', locked);
    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('click', click);
    canvas.addEventListener('dblclick', dblclick);
    canvas.addEventListener('wheel', scroll, { passive: false });
    canvas.addEventListener('mouseleave', leave);
    canvas.addEventListener('contextmenu', context);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', release);
      window.removeEventListener('blur', blur);
      document.removeEventListener('pointerlockchange', locked);
      canvas.removeEventListener('mousedown', down);
      canvas.removeEventListener('click', click);
      canvas.removeEventListener('dblclick', dblclick);
      canvas.removeEventListener('wheel', scroll);
      canvas.removeEventListener('mouseleave', leave);
      canvas.removeEventListener('contextmenu', context);
      universe.requestLook = () => {};
    };
  }, [camera, gl]);
  useEffect(
    () => () => {
      world.paper.dispose();
      world.points.geometry.dispose();
      world.points.material.dispose();
      world.streaks.geometry.dispose();
      world.streaks.material.dispose();
      world.horizon.geometry.dispose();
      world.horizon.material.dispose();
      world.portal.geometry.dispose();
      world.portal.material.dispose();
      world.ringGeometry.dispose();
      world.ringMaterial.dispose();
      world.slots.forEach((slot) => {
        slot.halo.material.dispose();
        slot.galaxy.material.dispose();
        slot.volume.material.dispose();
      });
      const geometries = new Set<T.BufferGeometry>(),
        materials = new Set<T.Material>();
      for (const group of [world.ship, world.milky, world.web])
        group.traverse((object) => {
          const mesh = object as T.Mesh;
          if (mesh.geometry) geometries.add(mesh.geometry);
          if (mesh.material)
            for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
              materials.add(material);
          if (object instanceof T.InstancedMesh) object.dispose();
        });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
    },
    [world],
  );
  useFrame((_, frameDt) => {
    if (!catalog || !universe.index || !isPageActive()) return;
    const dt = Math.min(frameDt, 0.05);
    let s = useGame.getState();
    if (!s.pauseAnimations && !s.paused && !s.panel) clock.current += Math.min(frameDt, 0.2);
    universe.renderFrames++;
    const active = universe.jump?.mode === 'black_hole' || (!s.paused && !s.panel);
    const wasJumping = s.jumping;
    const previousPosition = active && !s.jumping ? structuredClone(universe.position) : null;
    const target = universe.byId.get(s.targetId),
      o = orientation.current,
      cmd = command.current,
      held = keys.current;
    if (universe.brakeRequested) {
      velocity.current.set(0, 0, 0);
      rates.current.strafe = 0;
      for (const key of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) keys.current.delete(key);
      universe.brakeRequested = false;
    }
    if (active) {
      universe.elapsed += dt;
      if (universe.jump && s.jumping) {
        const jump = universe.jump;
        jump.elapsed = Math.min(
          jump.elapsed + dt,
          jump.audioReady ? jump.duration : jump.duration * 0.68,
        );
        const progress = Math.min(1, jump.elapsed / jump.duration);
        universe.jumpProgress = progress;
        look.set(
          ...((progress < 0.7 && jump.entryDirection ? jump.entryDirection : jump.direction) as [
            number,
            number,
            number,
          ]),
        );
        matrix.lookAt(zero, look, up);
        desired.setFromRotationMatrix(matrix);
        cmd.slerp(desired, 1 - Math.exp(-dt * 5));
        if (progress >= 0.72 && !jump.committed) {
          const destination = universe.byId.get(jump.targetId)!;
          const length = universe.distance(destination);
          universe.position = structuredClone(jump.destination);
          jump.committed = true;
          universe.travelled += length;
          velocity.current.set(0, 0, 0);
          universe.speed = 0;
          const radius =
            Number(destination.physical.radiusKm || destination.physical.renderRadiusKm || 0) /
            KM_PER_LY;
          universe.unit = Math.max(6371 / KM_PER_LY / 5, radius / 5, jump.radius / 32);
          accum.current = 1;
        }
        if (progress >= 1) {
          const id = jump.targetId;
          universe.jump = null;
          universe.jumpProgress = 0;
          s.set({ jumping: false, throttle: 0, autopilot: false, targetId: id });
          s.discover(id);
          s.notify(
            (s.lang === 'zh' ? '跃迁抵达 · ' : 'Jump arrival · ') +
              (universe.byId.get(id)?.[s.lang === 'zh' ? 'nameZh' : 'nameEn'] || id),
          );
          cabin.ping('arrive');
          cabin.endTransit(universe.byId.get(id));
          cabin.speak(jump.mode === 'warp' ? 'arrive' : 'stabilize', true);
        }
      } else {
        const yaw = (held.has('ArrowLeft') ? 1 : 0) - (held.has('ArrowRight') ? 1 : 0),
          pitch = (held.has('ArrowUp') ? 1 : 0) - (held.has('ArrowDown') ? 1 : 0),
          roll = (held.has('KeyQ') ? 1 : 0) - (held.has('KeyE') ? 1 : 0);
        rates.current.yaw = smoothValue(rates.current.yaw, yaw * 0.9, 9, dt);
        rates.current.pitch = smoothValue(rates.current.pitch, pitch * 0.9, 9, dt);
        rates.current.roll = smoothValue(rates.current.roll, roll * 0.95, 8, dt);
        rates.current.strafe = smoothValue(
          rates.current.strafe,
          (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0),
          7,
          dt,
        );
        const portion = 1 - Math.exp(-dt * 22),
          mx = mouse.current.x * portion,
          my = mouse.current.y * portion;
        mouse.current.x -= mx;
        mouse.current.y -= my;
        q.setFromAxisAngle(axis.set(0, 1, 0), rates.current.yaw * dt - mx * 0.002);
        cmd.multiply(q);
        q.setFromAxisAngle(axis.set(1, 0, 0), rates.current.pitch * dt - my * 0.002);
        cmd.multiply(q);
        q.setFromAxisAngle(axis.set(0, 0, 1), rates.current.roll * dt);
        cmd.multiply(q).normalize();
        if (yaw || pitch || roll) universe.alignTarget = false;
        if (held.has('KeyW') || held.has('KeyS')) {
          const throttle = T.MathUtils.clamp(
            s.throttle + ((held.has('KeyW') ? 1 : 0) - (held.has('KeyS') ? 1 : 0)) * dt * 0.7,
            -1,
            1,
          );
          if (throttle !== s.throttle || !s.playing || s.autopilot)
            s.set({
              playing: true,
              autopilot: false,
              throttle,
            });
        }
        const max = flightSpeedLimit(s.level, held.has('ShiftLeft') || held.has('ShiftRight'));
        if ((s.autopilot || universe.alignTarget) && target) {
          const r = relative(target.cartesian, universe.position);
          look.set(...(r as [number, number, number])).normalize();
          matrix.lookAt(zero, look, up);
          desired.setFromRotationMatrix(matrix);
          cmd.slerp(desired, 1 - Math.exp(-dt * 4));
          if (cmd.angleTo(desired) < 0.005) universe.alignTarget = false;
        }
        if (s.autopilot && target) {
          const r = relative(target.cartesian, universe.position),
            d = Math.hypot(...r),
            flight = autopilotStep(d, stopRadius(target), max, dt);
          if (d > 0)
            translate(
              universe.position,
              r.map((n: number) => (n / d) * flight.step),
            );
          universe.speed = flight.speed;
          universe.travelled += flight.step;
          velocity.current.set(0, 0, 0);
          if (flight.arrived) {
            s.set({ autopilot: false, throttle: 0 });
            universe.speed = 0;
            s.discover(target.id);
            s.notify(
              (s.lang === 'zh' ? '已抵达 ' : 'Arrived at ') +
                (s.lang === 'zh' ? target.nameZh : target.nameEn),
            );
            cabin.ping('arrive');
            cabin.enterRegion(target);
            cabin.speak('arrive');
          }
        } else if (!held.has('Space')) {
          const throttle = useGame.getState().throttle;
          forward.set(0, 0, -1).applyQuaternion(o);
          right.set(1, 0, 0).applyQuaternion(o);
          desiredVelocity
            .copy(forward)
            .multiplyScalar(max * throttle)
            .addScaledVector(right, rates.current.strafe * max * 0.4);
          velocity.current.lerp(desiredVelocity, 1 - Math.exp(-dt * 3.5));
          velocity.current.clampLength(0, MAX_SPEED);
          movement.copy(velocity.current).multiplyScalar(dt);
          translate(universe.position, movement.toArray());
          universe.speed = velocity.current.length() * (throttle < 0 ? -1 : 1);
          universe.travelled += movement.length();
        }
      }
    }
    if (active && !universe.jump && s.playing) {
      const capture = capturedBlackHole(
        world.blackHoles,
        wasJumping ? universe.position : previousPosition || universe.position,
        universe.position,
      );
      if (capture) {
        if (previousPosition && !wasJumping) {
          const segment = relative(universe.position, previousPosition);
          universe.position = previousPosition;
          translate(
            universe.position,
            segment.map((n: number) => n * capture.fraction),
          );
        }
        s.set({ targetId: capture.object.id });
        useGame.getState().traverse('black_hole');
        s = useGame.getState();
      }
    }
    o.slerp(cmd, 1 - Math.exp(-dt * 15)).normalize();
    forward.set(0, 0, -1).applyQuaternion(o);
    universe.heading = forward.toArray();
    universe.headingQuaternion = o.toArray();
    camera.position.set(0, 0, 0);
    camera.quaternion.copy(o);
    const power = s.jumping ? jumpEnvelope(universe.jumpProgress) : 0;
    const effects = flightEffects(universe.speed);
    if (camera instanceof T.PerspectiveCamera) {
      camera.fov = smoothValue(
        camera.fov,
        55 + effects.intensity ** 3 * 12 + power * (universe.jump?.mode === 'black_hole' ? 40 : 27),
        7,
        dt,
      );
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    inverse.copy(o).invert();
    accum.current += dt;
    if (accum.current > 0.16 || !universe.nearest.length) {
      accum.current = 0;
      universe.nearest = universe.index.nearest(universe.position, 42);
      universe.band = bandForDistance(universe.distance(universe.byId.get('earth')!));
      if (!s.jumping)
        for (const n of universe.nearest.slice(0, 8)) {
          if (n.distance < stopRadius(n.object) * 1.3) s.discover(n.object.id);
        }
    }
    const solid = universe.nearest.find((n) =>
      ['planet', 'moon', 'star', 'exoplanet', 'dwarf_planet'].includes(n.object.category),
    );
    let desiredUnit = Math.max(
      6371 / KM_PER_LY / 5,
      Math.abs(universe.speed) / 55,
      (solid?.distance ?? 1) / 32,
    );
    const gal = universe.nearest.find((n) => n.object.category === 'galaxy');
    if (universe.band >= 3 && gal)
      desiredUnit = Math.min(desiredUnit, Math.max(gal.distance / 35, gal.object.scaleLy / 200));
    universe.unit = Math.exp(smoothValue(Math.log(universe.unit), Math.log(desiredUnit), 3.8, dt));
    const unit = universe.unit;
    const candidates = universe.nearest.map((n) => n.object);
    if (target && !candidates.includes(target)) candidates.unshift(target);
    const used = new Set<string>(),
      screens: ScreenObject[] = [];
    let slotIndex = 0;
    const projectBody = (
      id: string,
      x: number,
      y: number,
      z: number,
      radius: number,
      distance: number,
    ) => {
      screen.set(x, y, z).applyQuaternion(inverse);
      if (screen.z >= -0.015) return;
      const depth = -screen.z;
      screen.set(x, y, z).project(camera);
      const px = (screen.x * 0.5 + 0.5) * size.width,
        py = (-screen.y * 0.5 + 0.5) * size.height;
      const pixels = Math.min(
        size.width,
        ((radius / depth) * size.height) /
          (2 * Math.tan(((camera as T.PerspectiveCamera).fov * Math.PI) / 360)),
      );
      if (
        px + pixels < 0 ||
        py + pixels < 0 ||
        px - pixels > size.width ||
        py - pixels > size.height
      )
        return;
      screens.push({ id, x: px, y: py, radius: Math.max(8, pixels), distance, visible: true });
    };
    for (const obj of candidates) {
      if (slotIndex >= world.slots.length) break;
      if (used.has(obj.id) || obj.id === 'horizon' || obj.id === 'cosmic-web') continue;
      const r = relative(obj.cartesian, universe.position),
        d = Math.hypot(...r);
      if (!Number.isFinite(d) || d <= 0) continue;
      if (
        obj.category === 'black_hole' &&
        obj.id !== s.targetId &&
        d > Math.max(obj.scaleLy * 1e4, 0.01)
      )
        continue;
      const linear = d / unit,
        renderD = linear < 700 ? linear : 700 + Math.log1p((linear - 700) / 700) * 90;
      if (renderD > 4400) continue;
      const slot = world.slots[slotIndex++];
      if (slot.id !== obj.id) setSlot(slot, obj);
      used.add(obj.id);
      slot.group.visible = true;
      slot.group.position.set((r[0] / d) * renderD, (r[1] / d) * renderD, (r[2] / d) * renderD);
      let radius =
        ((obj.physical.radiusKm ? Number(obj.physical.radiusKm) / KM_PER_LY : obj.scaleLy / 2) /
          d) *
        renderD;
      if (obj.category === 'star') radius = Math.max(renderD * 0.0018, Math.min(radius, 150));
      else if (obj.category === 'galaxy') radius = Math.max(1.3, Math.min(radius, 900));
      else if (obj.category === 'black_hole') radius = Math.max(0.3, Math.min(radius, 5));
      else if (
        ['wall', 'filament', 'supercluster', 'galaxy_cluster', 'galaxy_group', 'void'].includes(
          obj.category,
        )
      )
        radius = Math.max(0.8, Math.min(radius, 650));
      else radius = Math.max(renderD * 0.0015, Math.min(radius, 250));
      slot.group.scale.setScalar(radius);
      if (obj.category === 'star') {
        const light = starlight(obj, d);
        slot.halo.scale.setScalar(9 + light.brightness * 2.5);
        slot.halo.material.opacity = Math.min(1, 0.45 + light.brightness * 0.2);
      }
      if (
        universe.jump?.mode === 'black_hole' &&
        obj.id === universe.jump.sourceId &&
        !universe.jump.committed
      ) {
        const capture = T.MathUtils.smoothstep(universe.jumpProgress, 0, 0.24);
        slot.group.scale.multiplyScalar(1 + capture * 5);
        slot.group.position.multiplyScalar(1 - capture * 0.55);
      }
      slot.mesh.geometry = linear > 220 ? lowSphereShared : sphereShared;
      slot.mesh.rotation.y = clock.current * (obj.id === 'earth' ? 0.008 : 0.025);
      slot.galaxy.material.rotation = (obj.id.charCodeAt(0) % 10) * 0.3;
      slot.galaxy.material.opacity = obj.id === s.targetId ? 0.8 : 0.5;
      slot.cloud.visible = false;
      projectBody(
        obj.id,
        slot.group.position.x,
        slot.group.position.y,
        slot.group.position.z,
        radius,
        d,
      );
    }
    for (let i = slotIndex; i < world.slots.length; i++) world.slots[i].group.visible = false;
    world.objects.forEach((obj, i) => {
      if (used.has(obj.id)) {
        world.positions.set([1e7, 1e7, 1e7], i * 3);
        return;
      }
      const r = relative(obj.cartesian, universe.position),
        d = Math.hypot(...r);
      if (!d) {
        world.positions.set([1e7, 1e7, 1e7], i * 3);
        return;
      }
      const linear = d / unit,
        rd = Math.min(4300, linear < 700 ? linear : 700 + Math.log1p((linear - 700) / 700) * 90),
        x = (r[0] / d) * rd,
        y = (r[1] / d) * rd,
        z = (r[2] / d) * rd;
      world.positions.set([x, y, z], i * 3);
      world.brightness[i] = starlight(obj, d).brightness;
      projectBody(obj.id, x, y, z, 0, d);
    });
    world.points.geometry.attributes.position.needsUpdate = true;
    world.points.geometry.attributes.brightness.needsUpdate = true;
    universe.screenObjects = screens;
    if (target) {
      const r = relative(target.cartesian, universe.position);
      look.set(...(r as [number, number, number])).applyQuaternion(inverse);
      universe.navigation = navigationCue(look.toArray(), size.width, size.height);
    }
    const pointer =
      universe.pointerLocked || s.keyboardMode
        ? { x: size.width / 2, y: size.height / 2 }
        : universe.cursor;
    const hit =
      active && !s.jumping && (universe.pointerLocked || s.keyboardMode || universe.cursor.inside)
        ? pickScreenObject(screens, pointer.x, pointer.y)
        : null;
    if (hit?.id !== universe.hover?.id && hit) cabin.ping('hover');
    universe.hover = hit;
    const mw = universe.byId.get('milky-way');
    if (mw) {
      const r = relative(mw.cartesian, universe.position);
      world.milky.visible = unit > 20 && unit < 1e8;
      world.milky.position.set(r[0] / unit, r[1] / unit, r[2] / unit);
      world.milky.scale.setScalar(1 / unit);
      world.milky.quaternion.setFromUnitVectors(
        up,
        new T.Vector3(-0.4838, 0.45598, -0.74698).normalize(),
      );
    }
    world.ship.visible =
      !s.cockpit &&
      !(
        s.jumping &&
        universe.jump?.mode !== 'warp' &&
        universe.jumpProgress > 0.16 &&
        universe.jumpProgress < 0.85
      );
    world.ship.quaternion.copy(o);
    world.ship.position.set(0.1, -0.6, -3.8).applyQuaternion(o);
    world.ship.scale.setScalar(0.28);
    world.ship.children
      .filter((c) => c.name === 'plume')
      .forEach((c) => {
        c.scale.y =
          0.4 + Math.min(2, Math.abs(universe.speed) / speedAtLevel(s.level)) * 1.2 + power * 2;
      });
    world.streaks.quaternion.copy(o);
    world.streaks.material.opacity = active ? Math.max(power * 0.94, effects.opacity) : 0;
    const particleCount = Math.min(
      world.maxParticles,
      Math.max(
        Math.round(world.maxParticles * power),
        Math.round((effects.count * world.maxParticles) / 900),
      ),
    );
    if (active && !s.pauseAnimations)
      particlePhase.current += (effects.rate + power * 300) * dt * (universe.speed < 0 ? -1 : 1);
    const positions = world.streaks.geometry.attributes.position as T.BufferAttribute;
    const streakLength = Math.max(effects.length, 1 + power * 55);
    for (let i = 0; i < particleCount; i++) {
      const x = world.particleSeeds[i * 3],
        y = world.particleSeeds[i * 3 + 1],
        z = -120 + ((((world.particleSeeds[i * 3 + 2] + particlePhase.current) % 120) + 120) % 120);
      positions.setXYZ(i * 2, x, y, z);
      positions.setXYZ(i * 2 + 1, x, y, Math.min(-0.1, z + streakLength));
    }
    positions.needsUpdate = true;
    world.streaks.geometry.setDrawRange(0, particleCount * 2);
    universe.particleCount = active ? particleCount : 0;
    universe.effectIntensity = active ? effects.intensity : 0;
    const portalTransit = universe.jump?.mode !== 'warp' && !!universe.jump;
    const tunnelPower = portalTransit
      ? T.MathUtils.smoothstep(universe.jumpProgress, 0.06, 0.24) *
        (1 - T.MathUtils.smoothstep(universe.jumpProgress, 0.81, 1))
      : 0;
    world.portal.visible = portalTransit && universe.jumpProgress < 0.75;
    world.portal.quaternion.copy(o);
    world.portal.position.copy(forward).multiplyScalar(12 - universe.jumpProgress * 14);
    world.portal.scale.setScalar(1 + universe.jumpProgress * 4);
    world.portal.material.opacity = portalTransit ? Math.min(1, universe.jumpProgress * 5) : 0;
    world.portal.material.color.set(universe.jump?.mode === 'black_hole' ? '#ffd9a8' : '#8feaff');
    world.transitRings.visible = portalTransit;
    world.transitRings.quaternion.copy(o);
    world.ringMaterial.opacity = tunnelPower * 0.24;
    world.ringMaterial.color.set(
      universe.jump?.mode === 'black_hole' && universe.jumpProgress < 0.35 ? '#ffc18b' : '#a7bbff',
    );
    world.transitRings.children.forEach((ring, i) => {
      ring.position.set(
        Math.sin(i * 0.8 + clock.current) * 0.3,
        Math.cos(i * 0.9 + clock.current) * 0.3,
        -((((i * 9 - clock.current * 75) % 144) + 144) % 144) - 2,
      );
      ring.rotation.z = i * 0.21 + clock.current * 0.35;
      ring.scale.set(
        1 + Math.sin(i + clock.current) * 0.18,
        1 + Math.cos(i + clock.current) * 0.18,
        1,
      );
    });
    world.streaks.material.color.set(
      universe.jump?.mode === 'black_hole' ? '#f4b087' : portalTransit ? '#b8a5ff' : '#c7eaff',
    );
    world.streaks.position.set(0, 0, 0);
    const origin = absolute(universe.position),
      cosmicD = Math.hypot(origin.x, origin.y, origin.z);
    world.web.visible = universe.band >= 6;
    world.web.scale.setScalar(1e9 / unit);
    world.web.position.set(-origin.x / unit, -origin.y / unit, -origin.z / unit);
    world.horizon.material.uniforms.opacity.value =
      T.MathUtils.smoothstep(cosmicD, 15e9, HORIZON) * 0.9;
    cabin.update(universe.speed, s, active, power);
    if (!s.jumping && active) {
      const black = universe.nearest.find(
        (n) => n.object.category === 'black_hole' && n.distance < stopRadius(n.object) * 2,
      )?.object;
      const galaxy =
        universe.band >= 3
          ? universe.nearest.find(
              (n) => n.object.category === 'galaxy' && n.distance < n.object.scaleLy * 0.8,
            )?.object
          : undefined;
      if (black) cabin.enterRegion(black);
      else if (galaxy) cabin.enterRegion(galaxy);
      else cabin.enterAmbient(universe.band < 2 ? 'solar' : universe.band < 4 ? 'stellar' : 'deep');
    }
    animateMaterials(clock.current);
    world.paper.update(
      gl,
      size.width,
      size.height,
      universe.effectsReduced ? 'low' : s.quality,
      clock.current,
      !!universe.jump,
      universe.heading,
    );
    universe.shaderFrames = world.paper.frames;
    universe.shaderPixels = world.paper.pixels;
    universe.motionActive =
      velocity.current.lengthSq() > 1e-50 ||
      keys.current.size > 0 ||
      Math.abs(rates.current.yaw) +
        Math.abs(rates.current.pitch) +
        Math.abs(rates.current.roll) +
        Math.abs(rates.current.strafe) >
        1e-4 ||
      Math.abs(mouse.current.x) + Math.abs(mouse.current.y) > 1e-3 ||
      cmd.angleTo(o) > 1e-4;
    fps.current.frames++;
    fps.current.time += frameDt;
    if (fps.current.time > 0.7) {
      universe.fps = Math.round(fps.current.frames / fps.current.time);
      fps.current = { time: 0, frames: 0 };
      universe.drawCalls = gl.info.render.calls;
      universe.triangles = gl.info.render.triangles;
    }
  });
  return (
    <>
      <ambientLight intensity={1.4} />
      <directionalLight position={[-2, 4, 6]} intensity={3} />
      <primitive object={world.root} />
    </>
  );
}
export const UniverseScene = memo(function UniverseScene() {
  const quality = useGame((s) => s.quality);
  const foreground = usePageActive();
  return (
    <Canvas
      className="universe"
      tabIndex={0}
      frameloop="never"
      dpr={renderBudget(quality).dpr}
      camera={{ fov: 55, near: 0.015, far: 5000 }}
      gl={{ antialias: false, alpha: false, powerPreference: 'low-power' }}
      onCreated={({ gl }) => {
        gl.setClearColor('#060a12');
        gl.toneMapping = T.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.35;
      }}
    >
      <World />
      <RenderController foreground={foreground} />
    </Canvas>
  );
});
