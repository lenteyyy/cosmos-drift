import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import {
  ArrowUpRight,
  Orbit,
  Map,
  BookOpen,
  Settings2,
  Volume2,
  VolumeX,
  HelpCircle,
  X,
  Navigation,
  Pause,
  Crosshair,
  RotateCcw,
  ExternalLink,
  Compass,
  Info,
  Check,
} from 'lucide-react';
import { UniverseScene } from './components/UniverseScene';
import { UniverseMap } from './components/UniverseMap';
import { ExplorationHUD } from './components/ExplorationHUD';
import { categoryNames } from './catalog-ui';
import { useGame, universe } from './store';
import {
  BANDS,
  SPEEDS,
  SPEED_LABELS,
  speedAtLevel,
  wheelSpeedLevel,
  formatDistance,
  formatSpeed,
  absolute,
  HORIZON,
} from './engine/navigation.mjs';
import { cabin } from './engine/audio';
import { TRACKS } from './engine/music.mjs';
import type { CosmicObject } from './types';
import { usePageActive, claimPage } from './engine/page-activity';
function useTelemetry() {
  const [, tick] = useState(0);
  const foreground = usePageActive();
  useEffect(() => {
    if (!foreground) return;
    const i = setInterval(() => tick((x) => x + 1), 250);
    return () => clearInterval(i);
  }, [foreground]);
}
function engage() {
  const s = useGame.getState();
  if (s.jumping) return;
  s.set({ autopilot: !s.autopilot, playing: true });
  cabin.start();
  if (!s.muted) cabin.ping();
}
class SceneBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  componentDidCatch(e: Error, i: ErrorInfo) {
    console.error(e, i);
  }
  render() {
    return this.state.error ? (
      <div className="fatal">
        <Orbit />
        <h2>WebGL scene unavailable</h2>
        <p>{this.state.error}</p>
        <p>请使用启用硬件加速的现代浏览器。</p>
        <button onClick={() => location.reload()}>重新加载</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Information({ object: o }: { object: CosmicObject }) {
  const { lang, sources } = useGame(),
    zh = lang === 'zh';
  const d = universe.distance(o),
    props = o.physical;
  return (
    <div className="information">
      <div className={'info-orb orb-' + o.category}>
        <Orbit size={52} strokeWidth={0.6} />
      </div>
      <p className="eyebrow">CATALOGUE / {o.id.toUpperCase()}</p>
      <h2>{zh ? o.nameZh : o.nameEn}</h2>
      <p className="info-en">{o.nameEn}</p>
      <div className="info-badges">
        <span>{categoryNames[o.category][zh ? 0 : 1]}</span>
        <span
          className={
            o.scienceStatus === 'debated' || o.scienceStatus === 'candidate' ? 'warning' : ''
          }
        >
          {
            {
              confirmed: zh ? '已确认' : 'Confirmed',
              catalogued: zh ? '已编目' : 'Catalogued',
              candidate: zh ? '候选体' : 'Candidate',
              reported: zh ? '已报告' : 'Reported',
              debated: zh ? '报告 / 有争议' : 'Reported / debated',
            }[o.scienceStatus]
          }
        </span>
      </div>
      <dl className="data-grid">
        <div>
          <dt>{zh ? '距飞船' : 'FROM SHIP'}</dt>
          <dd>{formatDistance(d)}</dd>
        </div>
        <div>
          <dt>{zh ? '距太阳系 / 锚点' : 'SOLAR DISTANCE / ANCHOR'}</dt>
          <dd>{formatDistance(o.distanceLy)}</dd>
        </div>
        <div>
          <dt>RA / DEC {props.skyDirectionSchematic ? (zh ? '（示意）' : '(schematic)') : ''}</dt>
          <dd>{o.id === 'earth' ? '—' : `${o.raDeg.toFixed(3)}° / ${o.decDeg.toFixed(3)}°`}</dd>
        </div>
        {props.radiusKm && (
          <div>
            <dt>{zh ? '物理半径' : 'PHYSICAL RADIUS'}</dt>
            <dd>≈ {Number(props.radiusKm).toLocaleString()} km</dd>
          </div>
        )}
        {props.spectralType && (
          <div>
            <dt>{zh ? '光谱型' : 'SPECTRUM'}</dt>
            <dd>{String(props.spectralType)}</dd>
          </div>
        )}
        {props.hubbleType && (
          <div>
            <dt>{zh ? '哈勃类型' : 'HUBBLE TYPE'}</dt>
            <dd>{String(props.hubbleType)}</dd>
          </div>
        )}
        {o.redshift !== undefined && (
          <div>
            <dt>REDSHIFT</dt>
            <dd>≈ {o.redshift}</dd>
          </div>
        )}
        {props.pl_orbper && (
          <div>
            <dt>{zh ? '公转周期' : 'ORBITAL PERIOD'}</dt>
            <dd>≈ {Number(props.pl_orbper).toFixed(2)} d</dd>
          </div>
        )}
        {props.discoverymethod && (
          <div>
            <dt>{zh ? '发现方式' : 'DETECTION'}</dt>
            <dd>{String(props.discoverymethod)}</dd>
          </div>
        )}
        {props.disc_year && (
          <div>
            <dt>{zh ? '发现年份' : 'DISCOVERY YEAR'}</dt>
            <dd>{String(props.disc_year)}</dd>
          </div>
        )}
      </dl>
      <div className="description">
        <p lang="zh">{o.descriptionZh}</p>
        <p lang="en">{o.descriptionEn}</p>
      </div>
      {o.category === 'star' && !props.radiusKm && (
        <p className="science-note">
          {zh
            ? '目录未提供恒星半径；球体大小为显示示意，并非半径测量。'
            : 'No stellar radius is supplied by this catalogue; the sphere size is schematic.'}
        </p>
      )}
      {o.distanceMethod === 'redshift-derived' && (
        <p className="science-note">≈ approximate cosmological distance · Flat ΛCDM / H₀ 67.4</p>
      )}
      {o.category === 'black_hole' && (
        <p className="science-note">
          {zh
            ? '吸积盘和光环为视觉示意，并非完整广义相对论光线追踪。'
            : 'Accretion disk and light ring are schematic, not a full GR ray trace.'}
        </p>
      )}
      <div className="source-block">
        <span className="eyebrow">DATA PROVENANCE</span>
        {o.sourceIds.map((id) => {
          const source = sources.find((s) => s.id === id);
          return source ? (
            <a href={source.url} key={id} target="_blank" rel="noreferrer">
              {source.name}
              <ExternalLink size={12} />
            </a>
          ) : null;
        })}
      </div>
    </div>
  );
}
function Modal() {
  const s = useGame(),
    { panel, lang, catalog } = s,
    zh = lang === 'zh';
  const object = universe.byId.get(s.targetId);
  const modal = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!s.keyboardMode) return;
    if (panel) modal.current?.focus({ preventScroll: true });
    else
      document.querySelector<HTMLCanvasElement>('.universe canvas')?.focus({ preventScroll: true });
  }, [panel, s.keyboardMode]);
  if (!panel) return null;
  const titles = {
    map: ['宇宙地图', 'Universe map'],
    info: ['天体档案', 'Object information'],
    log: ['探索日志', 'Discovery log'],
    settings: ['飞行设置', 'Flight settings'],
    help: ['飞行手册', 'Flight manual'],
  };
  return (
    <div
      className={'modal-backdrop ' + (panel === 'info' ? 'info-backdrop' : '')}
      onClick={() => s.set({ panel: null })}
    >
      <section
        ref={modal}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={titles[panel][zh ? 0 : 1]}
        className={'modal modal-' + panel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (panel === 'info' && ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.code)) {
            e.preventDefault();
            modal.current?.querySelector('.modal-scroll')?.scrollBy({
              top: (e.code.endsWith('Up') ? -1 : 1) * (e.code.startsWith('Page') ? 320 : 60),
            });
          }
        }}
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">COSMOS DRIFT / {panel.toUpperCase()}</p>
            <h2>{titles[panel][zh ? 0 : 1]}</h2>
          </div>
          <button className="icon-button" aria-label="Close" onClick={() => s.set({ panel: null })}>
            <X size={20} />
          </button>
        </header>
        {panel === 'map' ? (
          <UniverseMap />
        ) : panel === 'info' && object ? (
          <div className="modal-scroll">
            <Information object={object} />
          </div>
        ) : panel === 'log' ? (
          <div className="modal-scroll log-content">
            <div className="log-summary">
              <Compass size={28} />
              <div>
                <h3>
                  {s.discoveries.length} {zh ? '个已发现天体' : 'discoveries'}
                </h3>
                <p>
                  {zh
                    ? '记录保存在当前浏览器。选择任何方向，写下你的航程。'
                    : 'Your journey is saved in this browser.'}
                </p>
              </div>
              <span>{formatDistance(universe.travelled)}</span>
            </div>
            <div className="discovery-list">
              {s.discoveries.map((d, i) => {
                const o = universe.byId.get(d.id);
                return o ? (
                  <button
                    key={d.id}
                    onClick={() => {
                      s.target(o.id);
                      s.set({ panel: 'info' });
                    }}
                  >
                    <span className="log-number">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <strong>{zh ? o.nameZh : o.nameEn}</strong>
                      <small>
                        {categoryNames[o.category][zh ? 0 : 1]} ·{' '}
                        {new Date(d.at).toLocaleString(zh ? 'zh-CN' : 'en-US')}
                      </small>
                    </div>
                    <Check size={16} />
                  </button>
                ) : null;
              })}
            </div>
          </div>
        ) : panel === 'settings' ? (
          <div className="modal-scroll settings-content">
            <div className="setting-row">
              <div>
                <h3>{zh ? '渲染质量' : 'Rendering quality'}</h3>
                <p>
                  {zh
                    ? '优先60 FPS；负载升高时自动降低分辨率。低画质减少粒子与背景开销。'
                    : 'Prioritize 60 FPS with adaptive resolution. Low reduces particles and background cost.'}
                </p>
              </div>
              <select
                aria-label="Rendering quality"
                value={s.quality}
                onChange={(e) => s.set({ quality: e.target.value as 'high' | 'low' })}
              >
                <option value="high">{zh ? '标准' : 'Standard'}</option>
                <option value="low">{zh ? '低画质 · 流畅优先' : 'Low · Performance'}</option>
              </select>
            </div>
            <div className="setting-row">
              <div>
                <h3>{zh ? '暂停背景动画' : 'Pause background animations'}</h3>
                <p>
                  {zh
                    ? '冻结星云与装饰效果，仍可驾驶；静止时停止渲染。'
                    : 'Freeze nebulae and decorative effects; flying remains available. Idle rendering stops.'}
                </p>
              </div>
              <button
                className="pill"
                role="switch"
                aria-label={zh ? '暂停背景动画' : 'Pause background animations'}
                aria-checked={s.pauseAnimations}
                onClick={() => s.set({ pauseAnimations: !s.pauseAnimations })}
              >
                {s.pauseAnimations ? (zh ? '已暂停' : 'Paused') : zh ? '播放中' : 'Playing'}
              </button>
            </div>
            <div className="setting-row">
              <div>
                <h3>{zh ? '全部声音' : 'Master audio'}</h3>
                <p>{zh ? '内部引擎声与界面提示音。' : 'Internal engine and interface tones.'}</p>
              </div>
              <button
                className="pill"
                onClick={() => {
                  cabin.start();
                  s.set({ muted: !s.muted });
                }}
              >
                {s.muted ? (zh ? '关闭' : 'Off') : zh ? '开启' : 'On'}
              </button>
            </div>
            <div className="setting-row">
              <div>
                <h3>{zh ? '背景音乐' : 'Ambient music'}</h3>
                <p>
                  {cabin.trackStatus === 'loading'
                    ? zh
                      ? '正在载入音乐…'
                      : 'Loading music…'
                    : cabin.musicPlaying
                      ? zh
                        ? `${cabin.track?.title || ''} · ${TRACKS.length}首轮播`
                        : `${cabin.track?.title || ''} · ${TRACKS.length}-track rotation`
                      : zh
                        ? '首次点击后开始播放，可独立关闭'
                        : 'Begins after your first interaction'}
                </p>
              </div>
              <button
                className="pill"
                aria-pressed={s.musicEnabled}
                onClick={() => {
                  cabin.start();
                  s.set({ musicEnabled: !s.musicEnabled });
                }}
              >
                {s.musicEnabled ? (zh ? '已开启' : 'On') : zh ? '已关闭' : 'Off'}
              </button>
            </div>
            <div className="soundtrack-player">
              <button onClick={() => cabin.nextTrack(-1)} aria-label="Previous track">
                ‹
              </button>
              <span>
                {cabin.track?.title || (zh ? '等待播放' : 'Ready to play')}
                <small>
                  {cabin.trackStatus === 'loading'
                    ? zh
                      ? '载入中…'
                      : 'Loading…'
                    : cabin.trackStatus === 'error'
                      ? zh
                        ? '音乐载入失败，点击重试'
                        : 'Audio unavailable; retry'
                      : zh
                        ? `${TRACKS.length}首配乐 · 换区自动切歌`
                        : `${TRACKS.length} tracks · Region-aware playback`}
                </small>
              </span>
              <button onClick={() => cabin.nextTrack()} aria-label="Next track">
                ›
              </button>
            </div>
            <div className="soundtrack-list" aria-label={zh ? '音乐列表' : 'Soundtrack'}>
              {TRACKS.map((track, index) => (
                <button
                  key={track.id}
                  className={cabin.trackIndex === index ? 'selected' : ''}
                  onClick={() => {
                    cabin.start();
                    void cabin.playTrack(index);
                  }}
                  aria-pressed={cabin.trackIndex === index}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{track.title}</strong>
                  <small>
                    {track.supplied ? (zh ? '已加入' : 'ADDED') : zh ? '原创' : 'ORIGINAL'}
                  </small>
                </button>
              ))}
            </div>
            <div className="setting-row">
              <div>
                <h3>{zh ? '英文导航语音' : 'English navigator'}</h3>
                <p>
                  {cabin.voiceStatus === 'unavailable'
                    ? zh
                      ? '英文语音暂不可用；音乐照常播放'
                      : 'English voice unavailable'
                    : cabin.voiceStatus === 'loading'
                      ? zh
                        ? '点击试听英文语音'
                        : 'Test the English navigator'
                      : cabin.voiceStatus}
                </p>
              </div>
              <button className="pill" onClick={() => s.set({ voiceEnabled: !s.voiceEnabled })}>
                {s.voiceEnabled ? (zh ? '开启' : 'On') : zh ? '关闭' : 'Off'}
              </button>
              <button
                className="pill"
                onClick={() => {
                  cabin.start();
                  cabin.update(0, { ...s, voiceEnabled: true });
                  cabin.speak('stabilize', true);
                }}
              >
                {zh ? '试听' : 'Test'}
              </button>
            </div>
            <div className="setting-row volume-setting">
              <label htmlFor="voice-volume">{zh ? '语音音量' : 'Voice volume'}</label>
              <input
                id="voice-volume"
                type="range"
                min="0"
                max="100"
                value={Math.round(s.voiceVolume * 100)}
                onChange={(e) => s.set({ voiceVolume: +e.target.value / 100 })}
              />
              <strong>{Math.round(s.voiceVolume * 100)}%</strong>
            </div>
            <div className="setting-row">
              <div>
                <h3>{zh ? '界面语言' : 'Interface language'}</h3>
              </div>
              <select
                aria-label="Language"
                value={s.lang}
                onChange={(e) => s.set({ lang: e.target.value as 'zh' | 'en' })}
              >
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="setting-row volume-setting">
              <label htmlFor="music-volume">{zh ? '音乐音量' : 'Music volume'}</label>
              <input
                id="music-volume"
                aria-label="Music volume"
                type="range"
                min="0"
                max="100"
                value={Math.round(s.musicVolume * 100)}
                onChange={(e) => s.set({ musicVolume: +e.target.value / 100 })}
              />
              <strong>{Math.round(s.musicVolume * 100)}%</strong>
            </div>
            <div className="setting-row volume-setting">
              <label htmlFor="sound-volume">{zh ? '引擎与音效' : 'Engine and effects'}</label>
              <input
                id="sound-volume"
                aria-label="Effects volume"
                type="range"
                min="0"
                max="100"
                value={Math.round(s.soundVolume * 100)}
                onChange={(e) => s.set({ soundVolume: +e.target.value / 100 })}
              />
              <strong>{Math.round(s.soundVolume * 100)}%</strong>
            </div>
            <div className="setting-row">
              <div>
                <h3>{zh ? '界面字号' : 'Interface size'}</h3>
                <p>
                  {zh ? '默认已放大，可继续增加。' : 'Large by default; adjustable for comfort.'}
                </p>
              </div>
              <select
                aria-label="Interface size"
                value={s.uiScale}
                onChange={(e) => s.set({ uiScale: +e.target.value })}
              >
                <option value="1">{zh ? '大字号' : 'Large'} · 100%</option>
                <option value="1.15">{zh ? '更大' : 'Larger'} · 115%</option>
                <option value="1.3">{zh ? '超大' : 'Extra large'} · 130%</option>
              </select>
            </div>
            <div className="setting-row volume-setting">
              <label htmlFor="mouse-sensitivity">{zh ? '鼠标灵敏度' : 'Mouse sensitivity'}</label>
              <input
                id="mouse-sensitivity"
                aria-label="Mouse sensitivity"
                type="range"
                min="40"
                max="180"
                value={Math.round(s.sensitivity * 100)}
                onChange={(e) => s.set({ sensitivity: +e.target.value / 100 })}
              />
              <strong>{s.sensitivity.toFixed(2)}×</strong>
            </div>
            <div className="setting-row">
              <div>
                <h3>{zh ? '返回地球' : 'Return to Earth'}</h3>
                <p>
                  {zh
                    ? '重新开始本次航程；保留发现日志。'
                    : 'Restart this flight; discoveries are retained.'}
                </p>
              </div>
              <button
                className="pill"
                onClick={() => {
                  universe.reset();
                  s.brake();
                  s.set({ targetId: 'moon', missionStep: 1, panel: null });
                  location.hash = '';
                  location.reload();
                }}
              >
                <RotateCcw size={14} />
                {zh ? '重启' : 'Restart'}
              </button>
            </div>
            <div className="credits">
              <h3>Astronomical Data & Credits</h3>
              <p>
                {catalog?.objects.length}{' '}
                {zh
                  ? '个本地交互对象。运行时不请求外部天文 API。'
                  : 'local interactive objects. No live astronomical APIs.'}
              </p>
              <p>
                HYG / OpenNGC: CC BY-SA 4.0.{' '}
                {zh
                  ? '保留署名，派生目录遵循相同许可。'
                  : 'Attribution retained; derived catalogue portions share the same licence.'}
              </p>
              {s.sources.map((source) => (
                <article key={source.id}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.name}
                    <ExternalLink size={12} />
                  </a>
                  <p>{source.attribution}</p>
                  <small>
                    {source.license}
                    {source.retrievedAt ? ' · ' + source.retrievedAt.slice(0, 10) : ''}
                  </small>
                </article>
              ))}
              <a className="download-link" href="/data/sources.json" target="_blank">
                {zh ? '查看完整来源记录' : 'View full source manifest'} <ArrowUpRight size={13} />
              </a>
            </div>
          </div>
        ) : panel === 'help' ? (
          <div className="modal-scroll help-content compact-help">
            <p className="intro">{zh ? '选目的地，出发。' : 'Pick a destination. Go explore.'}</p>
            <div className="key-grid">
              {[
                ['双击 / Double-click', '选择目的地', 'Set destination'],
                ['右键 / Right-drag', '转向；W/S 油门', 'Steer; W/S throttle'],
                ['滚轮 / Scroll', '连续调速；Alt 精调', 'Continuous speed; Alt for fine control'],
                ['J / O', '跃迁 / 虫洞', 'Warp / wormhole'],
                [
                  'B → J',
                  '找黑洞 → 抵达边缘自动穿越',
                  'Find black hole → automatic capture at the edge',
                ],
                ['Space', '刹车；黑洞穿越不可中止', 'Brake; black hole transit cannot be aborted'],
                ['M / I', '打开 / 关闭星图或资料', 'Toggle map / information'],
                ['Esc', '关闭面板 / 释放鼠标', 'Close / release mouse'],
              ].map(([key, cn, en]) => (
                <div key={key}>
                  <kbd>{key}</kbd>
                  <span>{zh ? cn : en}</span>
                </div>
              ))}
            </div>
            <details className="advanced-controls">
              <summary>{zh ? '更多按键' : 'More controls'}</summary>
              <p>
                {zh
                  ? '方向键转向 · Enter 选择准星天体 · A/D 平移 · Q/E 滚转 · +/- 调速 · G 对准 · F 自动驾驶 · Shift 加速 · Tab 切换目标 · V 视角 · P 暂停'
                  : 'Arrows steer · Enter targets reticle · A/D strafe · Q/E roll · +/- speed · G align · F autopilot · Shift boost · Tab cycles targets · V camera · P pause'}
              </p>
            </details>
            <p className="help-note">
              {zh
                ? '穿越为科幻玩法；天体来自真实目录，尺寸与边界为示意。打开面板时飞行暂停。'
                : 'Transit is fictional. Objects use real catalogues; sizes and boundaries are schematic. Menus pause flight.'}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
function TargetCard() {
  const s = useGame(),
    zh = s.lang === 'zh',
    o = universe.byId.get(s.targetId);
  if (!o || s.panel || s.jumping) return null;
  const black = o.category === 'black_hole';
  return (
    <aside className="destination-hud">
      <div className="destination-caption">{zh ? '目的地' : 'DESTINATION'}</div>
      <button
        className="destination-title"
        onClick={() => s.set({ panel: 'info' })}
        title={zh ? '查看天体资料' : 'Object information'}
      >
        {zh ? o.nameZh : o.nameEn}
        <Info size={16} />
      </button>
      <div className="destination-distance">{formatDistance(universe.distance(o))}</div>
      <div className="destination-controls">
        <button
          onClick={() => {
            universe.alignTarget = true;
          }}
          title={zh ? '对准目标' : 'Align target'}
        >
          <Crosshair size={16} />
          <kbd>G</kbd>
        </button>
        <button
          className={s.autopilot ? 'engaged' : ''}
          onClick={engage}
          title={zh ? '自动驾驶' : 'Autopilot'}
        >
          <Navigation size={16} />
          <kbd>F</kbd>
        </button>
        <button onClick={s.jump}>
          {zh ? '跃迁' : 'WARP'}
          <kbd>J</kbd>
        </button>
        {!black && (
          <button onClick={() => s.traverse('wormhole')}>
            {zh ? '虫洞' : 'WORMHOLE'}
            <kbd>O</kbd>
          </button>
        )}
      </div>
      {black && (
        <small>
          {zh ? '接近边缘自动穿越 · 无法中止' : 'Automatic capture at the edge · Cannot abort'}
        </small>
      )}
    </aside>
  );
}
function SpeedConsole() {
  const s = useGame(),
    zh = s.lang === 'zh';
  return (
    <section
      className="flight-console"
      aria-label={zh ? '航行控制' : 'Flight controls'}
      data-particle-count={universe.particleCount}
      data-effect-intensity={universe.effectIntensity}
      data-engine-mode={cabin.engineProfile.mode}
      data-engine-frequency={cabin.engineProfile.fundamental}
    >
      <div className="flight-velocity">
        <span>
          {s.paused
            ? zh
              ? '已暂停'
              : 'PAUSED'
            : s.autopilot
              ? 'AUTOPILOT'
              : s.throttle < 0
                ? 'REVERSE'
                : 'VELOCITY'}
        </span>
        <strong data-current-speed={Math.abs(universe.speed)}>
          {formatSpeed(Math.abs(universe.speed))}
        </strong>
      </div>
      <div className="flight-speed">
        <label htmlFor="flight-speed">
          {SPEED_LABELS[Math.floor(s.level)]}
          <span data-speed-limit={speedAtLevel(s.level)}>{formatSpeed(speedAtLevel(s.level))}</span>
        </label>
        <div className="flight-range">
          <button
            aria-label={zh ? '降低航速' : 'Decrease speed'}
            onClick={() => s.set({ level: wheelSpeedLevel(s.level, 12) })}
          >
            −
          </button>
          <input
            id="flight-speed"
            aria-label={zh ? '速度档位' : 'Speed level'}
            type="range"
            min="0"
            max={SPEEDS.length - 1}
            step="0.0001"
            value={s.level}
            aria-valuetext={formatSpeed(speedAtLevel(s.level))}
            title={zh ? '滚轮微调 · Alt 更细' : 'Scroll to adjust · Alt for fine control'}
            onChange={(e) => s.set({ level: +e.target.value })}
          />
          <button
            aria-label={zh ? '提高航速' : 'Increase speed'}
            onClick={() => s.set({ level: wheelSpeedLevel(s.level, -12) })}
          >
            +
          </button>
        </div>
      </div>
      <div className="flight-throttle">
        <label htmlFor="flight-throttle">
          {zh ? '油门' : 'THROTTLE'}
          <span>{Math.round(s.throttle * 100)}%</span>
        </label>
        <input
          id="flight-throttle"
          aria-label={zh ? '油门' : 'Throttle'}
          type="range"
          min="-100"
          max="100"
          value={Math.round(s.throttle * 100)}
          onChange={(e) =>
            s.set({ throttle: +e.target.value / 100, autopilot: false, playing: true })
          }
        />
      </div>
      <button className="flight-brake" onClick={s.brake}>
        {zh ? '刹车' : 'BRAKE'}
        <kbd>SPACE</kbd>
      </button>
    </section>
  );
}
export default function App() {
  const s = useGame(),
    zh = s.lang === 'zh';
  const foreground = usePageActive();
  useTelemetry();
  useEffect(() => {
    s.load();
  }, []);
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * s.uiScale}px`;
  }, [s.uiScale]);
  const band = BANDS[universe.band],
    p = absolute(universe.position),
    cosmicD = Math.hypot(p.x, p.y, p.z);
  return (
    <main
      data-render-active={foreground}
      data-render-frames={universe.renderFrames}
      data-shader-frames={universe.shaderFrames}
      data-shader-pixels={universe.shaderPixels}
      data-background-paused={s.pauseAnimations}
      data-fps={universe.fps}
      data-adaptive-dpr={universe.adaptiveDpr}
      data-effects-reduced={universe.effectsReduced}
      className={
        'app ' +
        (s.keyboardMode ? 'keyboard-mode ' : '') +
        (s.cockpit ? 'cockpit-mode ' : '') +
        (s.jumping ? 'jumping' : '')
      }
      onPointerDownCapture={() => {
        cabin.start();
        if (s.keyboardMode) s.set({ keyboardMode: false });
      }}
    >
      <div className="scene-layer">
        {s.catalog && (
          <SceneBoundary>
            <UniverseScene />
          </SceneBoundary>
        )}
      </div>
      <div className="vignette" />
      {!foreground && (
        <button className="standby-banner" onClick={claimPage}>
          {zh ? '窗口已待机 · 点击继续' : 'Window on standby · Click to resume'}
        </button>
      )}
      <div className="screen-grain" />
      <header className="flight-topbar">
        <div className="flight-identity">
          <img className="flight-logo" src="/branding/lenteyyy-logo.png" alt="Lenteyyy" />
          <span>
            <b>COSMOS DRIFT</b>
            <small>{zh ? band.zh : band.name}</small>
          </span>
        </div>
        <nav aria-label={zh ? '航行菜单' : 'Flight menu'}>
          <button onClick={() => s.set({ panel: 'map' })} title={zh ? '星图 M' : 'Map M'}>
            <Map size={19} />
            <span>{zh ? '星图' : 'MAP'}</span>
          </button>
          <button onClick={() => s.set({ panel: 'log' })} title={zh ? '发现日志' : 'Discoveries'}>
            <BookOpen size={19} />
          </button>
          <button
            onClick={() => {
              cabin.start();
              s.set({ muted: !s.muted });
            }}
            title={zh ? '声音' : 'Sound'}
          >
            {s.muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>
          <button onClick={() => s.set({ panel: 'help' })} title={zh ? '操作手册' : 'Controls'}>
            <HelpCircle size={19} />
          </button>
          <button onClick={() => s.set({ panel: 'settings' })} title={zh ? '设置' : 'Settings'}>
            <Settings2 size={19} />
          </button>
        </nav>
      </header>
      <TargetCard />
      <ExplorationHUD />
      <div className="view-heading">
        <span className="heading-tick" />
        <span>
          {(((Math.atan2(universe.heading[0], -universe.heading[2]) * 180) / Math.PI + 360) % 360)
            .toFixed(0)
            .padStart(3, '0')}
          °
        </span>
        <span className="heading-tick" />
      </div>
      <div className="reticle">
        <span />
        <i />
        <small>{s.autopilot ? 'AUTO' : '+'}</small>
      </div>
      {!s.playing && s.catalog && !s.panel && (
        <div className="flight-welcome">
          {zh ? '双击选目的地 · J 跃迁' : 'Double-click a body · J to warp'}
          <span>
            {zh
              ? '右键转向 · W/S 油门 · 滚轮调速'
              : 'Right-drag to steer · W/S throttle · Scroll speed'}
          </span>
        </div>
      )}
      {s.paused && (
        <div className="pause-banner">
          <Pause size={17} />
          {zh ? '航程已暂停' : 'FLIGHT PAUSED'}
          <button onClick={() => s.set({ paused: false })}>{zh ? '继续' : 'Resume'}</button>
        </div>
      )}
      {!s.panel && !s.jumping && (
        <div className="flight-bottom">
          <SpeedConsole />
          <div className="flight-shortcuts">
            <span>
              <kbd>W / S</kbd>
              {zh ? '油门' : 'Throttle'}
            </span>
            <span>
              <kbd>右键</kbd>
              {zh ? '转向' : 'Steer'}
            </span>
            <span>
              <kbd>B</kbd>
              {zh ? '寻找黑洞' : 'Find black hole'}
            </span>
            <span>
              <kbd>O</kbd>
              {zh ? '虫洞' : 'Wormhole'}
            </span>
            <button onClick={() => s.set({ panel: 'help' })}>{zh ? '操作手册' : 'Controls'}</button>
          </div>
        </div>
      )}
      {s.cockpit && (
        <div className="cockpit-frame">
          <div />
          <div />
        </div>
      )}
      {cosmicD >= HORIZON * 0.98 && (
        <div className="horizon-banner">
          <Orbit size={24} />
          <h2>{zh ? '可观测宇宙视界' : 'THE OBSERVABLE HORIZON'}</h2>
          <p>
            {zh
              ? '这里代表我们的宇宙观测视界，而非整个宇宙的实体边缘。'
              : 'The limit of our observable region, not a physical edge of the Universe.'}
          </p>
        </div>
      )}
      {s.toast && (
        <div className="toast">
          <Check size={15} />
          {s.toast}
        </div>
      )}
      {s.error && (
        <div className="fatal">
          <h2>Catalogue unavailable</h2>
          <p>{s.error}</p>
          <button onClick={() => s.load()}>Retry</button>
        </div>
      )}
      {!s.catalog && !s.error && (
        <div className="loading">
          <Orbit size={38} />
          <span>CHARTING THE COSMOS</span>
          <p>{zh ? '载入本地宇宙目录…' : 'Loading the local universe…'}</p>
        </div>
      )}
      <Modal />
    </main>
  );
}
