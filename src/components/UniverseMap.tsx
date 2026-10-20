import { memo, useEffect, useRef, useState, useMemo } from 'react';
import { Search, ArrowUpRight, SlidersHorizontal, Minus, Plus, Crosshair } from 'lucide-react';
import { useGame, universe } from '../store';
import { absolute, formatDistance } from '../engine/navigation.mjs';
import type { CosmicObject } from '../types';
import { categoryNames } from '../catalog-ui';

const levels = [
  {
    zh: '太阳系',
    en: 'Solar System',
    span: 0.001,
    cats: ['planet', 'moon', 'dwarf_planet', 'star'],
  },
  { zh: '邻近恒星', en: 'Nearby Stars', span: 1200, cats: ['star', 'exoplanet', 'black_hole'] },
  {
    zh: '银河系',
    en: 'Milky Way',
    span: 140000,
    cats: ['star', 'black_hole', 'filament', 'galaxy'],
  },
  { zh: '本星系群', en: 'Local Group', span: 1.2e7, cats: ['galaxy', 'galaxy_group'] },
  {
    zh: '近邻宇宙',
    en: 'Nearby Universe',
    span: 1e9,
    cats: ['galaxy', 'galaxy_cluster', 'supercluster', 'void', 'wall'],
  },
  {
    zh: '宇宙网',
    en: 'Cosmic Web',
    span: 50e9,
    cats: ['supercluster', 'galaxy_cluster', 'wall', 'filament', 'void', 'cosmic_boundary'],
  },
];
const color = (o: CosmicObject) =>
  o.category === 'black_hole'
    ? '#e9a46e'
    : o.category === 'planet' || o.category === 'moon'
      ? '#aacdc6'
      : o.category === 'star'
        ? '#e5d4ad'
        : o.category === 'void'
          ? '#aa91c1'
          : '#8cadbf';
export const UniverseMap = memo(function UniverseMap() {
  const { catalog, lang, targetId, target, set } = useGame(),
    zh = lang === 'zh';
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [level, setLevel] = useState(Math.min(5, universe.band)),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, z: 0 }),
    [axis, setAxis] = useState<'xz' | 'xy'>('xz');
  const [browseId, setBrowseId] = useState(targetId);
  const searchInput = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null),
    hits = useRef<{ x: number; y: number; o: CosmicObject }[]>([]),
    drag = useRef<{ x: number; y: number; p: { x: number; z: number } } | null>(null);
  const visible = useMemo(
    () =>
      (catalog?.objects || []).filter(
        (o) =>
          (!search ||
            [o.nameEn, o.nameZh, ...o.aliases].some((n) =>
              n.toLowerCase().includes(search.toLowerCase()),
            )) &&
          (filter === 'all' || o.category === filter),
      ),
    [catalog, search, filter],
  );
  const span = levels[level].span / zoom;
  useEffect(() => {
    list.current
      ?.querySelector('[data-browse-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [browseId]);
  useEffect(() => {
    function keyboard(e: KeyboardEvent) {
      const typing = (e.target as HTMLElement)?.matches('input,textarea,select');
      if (typing && e.code !== 'Enter') return;
      const current = Math.max(
        0,
        visible.findIndex((o) => o.id === browseId),
      );
      if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.code)) {
        e.preventDefault();
        const next =
          e.code === 'Home'
            ? 0
            : e.code === 'End'
              ? visible.length - 1
              : Math.max(
                  0,
                  Math.min(visible.length - 1, current + (e.code === 'ArrowDown' ? 1 : -1)),
                );
        if (visible[next]) setBrowseId(visible[next].id);
      } else if (e.code === 'Slash') {
        e.preventDefault();
        searchInput.current?.focus();
      } else if (['Enter', 'KeyJ', 'KeyO', 'KeyF'].includes(e.code) && !e.repeat) {
        e.preventDefault();
        const chosen = visible.find((o) => o.id === browseId) || visible[0];
        if (!chosen) return;
        target(chosen.id);
        set({ panel: null, playing: true });
        if (e.code === 'KeyJ') useGame.getState().jump();
        if (e.code === 'KeyO') useGame.getState().traverse('wormhole');
        if (e.code === 'KeyF') set({ autopilot: true });
      } else if (e.code === 'Equal' || e.code === 'Minus') {
        e.preventDefault();
        setZoom((z) => Math.max(0.1, Math.min(100, z * (e.code === 'Equal' ? 1.15 : 1 / 1.15))));
      } else if (e.code === 'PageUp' || e.code === 'PageDown') {
        e.preventDefault();
        switchLevel(
          Math.max(0, Math.min(levels.length - 1, level + (e.code === 'PageDown' ? 1 : -1))),
        );
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        setPan((p) => ({ ...p, x: p.x + (e.code === 'ArrowRight' ? 1 : -1) * span * 0.08 }));
      }
    }
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [visible, browseId, level, span, target, set]);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    function draw() {
      if (!c) return;
      const box = c.getBoundingClientRect(),
        dpr = Math.min(window.devicePixelRatio, 2);
      if (c.width !== Math.round(box.width * dpr)) c.width = Math.round(box.width * dpr);
      if (c.height !== Math.round(box.height * dpr)) c.height = Math.round(box.height * dpr);
      const ctx = c.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = box.width,
        h = box.height,
        scale = Math.min(w, h) / span;
      ctx.fillStyle = '#080e15';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#18232d';
      ctx.lineWidth = 0.5;
      const grid = Math.pow(10, Math.floor(Math.log10(span / 5)));
      const sx = (v: number) => w / 2 + (v - pan.x) * scale,
        sy = (v: number) => h / 2 + (v - pan.z) * scale;
      for (let n = -30; n <= 30; n++) {
        const x = sx(n * grid),
          y = sy(n * grid);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.strokeStyle = '#223944';
      ctx.beginPath();
      ctx.moveTo(sx(0), 0);
      ctx.lineTo(sx(0), h);
      ctx.moveTo(0, sy(0));
      ctx.lineTo(w, sy(0));
      ctx.stroke();
      hits.current = [];
      const objects = search
        ? visible
        : visible.filter((o) => levels[level].cats.includes(o.category));
      for (const o of objects) {
        if (o.id === 'cosmic-web') continue;
        const x = sx(o.cartesian.x),
          y = sy(axis === 'xz' ? o.cartesian.z : o.cartesian.y);
        if (x < 12 || y < 18 || x > w - 12 || y > h - 18) continue;
        const selected = o.id === browseId;
        ctx.fillStyle = color(o);
        ctx.globalAlpha = selected ? 1 : 0.65;
        ctx.beginPath();
        ctx.arc(x, y, selected ? 4 : o.category === 'galaxy' ? 2 : 2.6, 0, Math.PI * 2);
        ctx.fill();
        if (selected) {
          ctx.strokeStyle = '#c2e4d9';
          ctx.beginPath();
          ctx.arc(x, y, 11, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (selected || objects.length < 50) {
          ctx.font = '10px monospace';
          ctx.fillStyle = selected ? '#e0f3ee' : '#8fa1af';
          ctx.fillText(zh ? o.nameZh : o.nameEn, x + 9, y - 8);
        }
        hits.current.push({ x, y, o });
      }
      ctx.globalAlpha = 1;
      const p = absolute(universe.position),
        px = sx(p.x),
        py = sy(axis === 'xz' ? p.z : p.y);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(
        Math.atan2(
          universe.heading[0],
          -(axis === 'xz' ? universe.heading[2] : universe.heading[1]),
        ),
      );
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(-4, 5);
      ctx.lineTo(0, 2);
      ctx.lineTo(4, 5);
      ctx.closePath();
      ctx.fillStyle = '#edf9f4';
      ctx.fill();
      ctx.restore();
      ctx.font = '10px monospace';
      ctx.fillStyle = '#647482';
      ctx.fillText(`${formatDistance(grid)} / grid`, 20, h - 20);
    }
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(c);
    return () => observer.disconnect();
  }, [visible, browseId, span, pan, axis, zh, level, search]);
  function switchLevel(i: number) {
    setLevel(i);
    setZoom(1);
    setPan({ x: 0, z: 0 });
  }
  return (
    <div className="map-layout">
      <div className="map-catalog">
        <label className="search">
          <Search size={16} />
          <input
            ref={searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={zh ? '搜索名称、目录编号…' : 'Search names or catalogue IDs…'}
            aria-label={zh ? '搜索天体' : 'Search objects'}
          />
          <kbd>⌕</kbd>
        </label>
        <div className="filter-row">
          <SlidersHorizontal size={13} />
          <select
            aria-label="Filter category"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">{zh ? '所有天体' : 'All objects'}</option>
            {Object.entries(categoryNames).map(([k, n]) => (
              <option key={k} value={k}>
                {n[zh ? 0 : 1]}
              </option>
            ))}
          </select>
          <span>{visible.length}</span>
        </div>
        <div className="object-list" ref={list}>
          {visible.map((o) => (
            <button
              key={o.id}
              className={'object-row ' + (o.id === browseId ? 'selected' : '')}
              data-browse-active={o.id === browseId}
              aria-current={o.id === targetId ? 'true' : undefined}
              onClick={() => {
                setBrowseId(o.id);
                target(o.id);
              }}
            >
              <span className="object-dot" style={{ background: color(o) }} />
              <div>
                <strong>{zh ? o.nameZh : o.nameEn}</strong>
                <small>
                  {o.nameEn} · {categoryNames[o.category][zh ? 0 : 1]}
                </small>
              </div>
              <ArrowUpRight size={14} />
            </button>
          ))}
          {!visible.length && (
            <p className="empty">{zh ? '没有匹配的天体' : 'No matching objects'}</p>
          )}
        </div>
      </div>
      <div className="map-plot">
        <div className="map-levels">
          {levels.map((l, i) => (
            <button
              key={l.en}
              className={level === i ? 'active' : ''}
              onClick={() => switchLevel(i)}
            >
              {zh ? l.zh : l.en}
            </button>
          ))}
        </div>
        <canvas
          ref={canvas}
          aria-label={zh ? '可拖动和缩放的宇宙地图' : 'Interactive universe map'}
          onWheel={(e) => {
            e.preventDefault();
            setZoom((z) => Math.max(0.1, Math.min(100, z * (e.deltaY < 0 ? 1.15 : 0.87))));
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, p: { ...pan } };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const b = e.currentTarget.getBoundingClientRect(),
              scale = Math.min(b.width, b.height) / span;
            setPan({
              x: drag.current.p.x - (e.clientX - drag.current.x) / scale,
              z: drag.current.p.z - (e.clientY - drag.current.y) / scale,
            });
          }}
          onPointerUp={(e) => {
            if (
              drag.current &&
              Math.hypot(e.clientX - drag.current.x, e.clientY - drag.current.y) < 5
            ) {
              const b = e.currentTarget.getBoundingClientRect(),
                hit = hits.current.find(
                  (h) => Math.hypot(e.clientX - b.left - h.x, e.clientY - b.top - h.y) < 13,
                );
              if (hit) target(hit.o.id);
            }
            drag.current = null;
          }}
        />
        <div className="map-tools">
          <button title="Zoom out" onClick={() => setZoom((z) => Math.max(0.1, z / 1.5))}>
            <Minus size={16} />
          </button>
          <button title="Zoom in" onClick={() => setZoom((z) => Math.min(100, z * 1.5))}>
            <Plus size={16} />
          </button>
          <button
            title="Centre on ship"
            onClick={() => {
              const p = absolute(universe.position);
              setPan({ x: p.x, z: axis === 'xz' ? p.z : p.y });
            }}
          >
            <Crosshair size={16} />
          </button>
          <button
            title="Change projection"
            onClick={() => setAxis((a) => (a === 'xz' ? 'xy' : 'xz'))}
          >
            {axis.toUpperCase()}
          </button>
        </div>
        <p className="map-note">
          {zh
            ? '↑↓ 选点 · Enter 确认 · / 搜索 · +/- 缩放 · PgUp/PgDn 尺度 · M 关闭'
            : '↑↓ browse · Enter select · / search · +/- zoom · PgUp/PgDn scale · M close'}
        </p>
      </div>
      <div className="map-footer">
        <span>
          {zh
            ? '选点不会瞬移；使用自动驾驶前往。'
            : 'Selecting a target does not teleport. Engage autopilot to travel.'}
        </span>
        <button className="primary map-jump" onClick={() => useGame.getState().jump()}>
          {zh ? '曲速跃迁 / 传送' : 'Warp jump'} <kbd>J</kbd>
        </button>
        <button
          className="primary"
          onClick={() => set({ panel: null, autopilot: true, playing: true })}
        >
          {zh ? '自动驾驶前往' : 'Engage autopilot'} <ArrowUpRight size={15} />
        </button>
      </div>
    </div>
  );
});
