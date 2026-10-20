import { useGame, universe } from '../store';
import { formatDistance } from '../engine/navigation.mjs';
export function ExplorationHUD() {
  const s = useGame(),
    zh = s.lang === 'zh',
    target = universe.byId.get(s.targetId);
  if (!target || s.panel) return null;
  const cue = universe.navigation,
    hover = universe.hover,
    hovered = hover ? universe.byId.get(hover.id) : null,
    jump = universe.jump,
    exit = jump ? universe.byId.get(jump.targetId) : null;
  return (
    <>
      {!s.jumping && (
        <div
          className={
            'flight-beacon ' +
            (cue.onScreen
              ? 'in-view'
              : 'edge ' + (cue.x > innerWidth / 2 ? 'edge-right' : 'edge-left'))
          }
          style={{ left: cue.x, top: cue.y }}
          data-navigation-target={target.id}
        >
          {cue.onScreen ? (
            <span className="target-brackets" />
          ) : (
            <span className="edge-chevron" style={{ transform: `rotate(${cue.angle}deg)` }}>
              ›
            </span>
          )}
          <div>
            <strong>{zh ? target.nameZh : target.nameEn}</strong>
            <span>{formatDistance(universe.distance(target))}</span>
          </div>
        </div>
      )}
      {hovered && hover && !s.jumping && (
        <div
          role="tooltip"
          className="flight-tooltip"
          data-hover-id={hovered.id}
          style={{
            left: Math.max(
              12,
              Math.min(
                (universe.pointerLocked || s.keyboardMode ? innerWidth / 2 : universe.cursor.x) +
                  22,
                innerWidth - 260,
              ),
            ),
            top: Math.max(
              86,
              Math.min(
                (universe.pointerLocked || s.keyboardMode ? innerHeight / 2 : universe.cursor.y) +
                  22,
                innerHeight - 250,
              ),
            ),
          }}
        >
          <strong>{zh ? hovered.nameZh : hovered.nameEn}</strong>
          <span>{formatDistance(hover.distance)}</span>
          <small>
            {s.keyboardMode
              ? zh
                ? 'Enter 设为目的地'
                : 'Enter to target'
              : zh
                ? '双击左键设为目的地'
                : 'Double-click to set destination'}
          </small>
        </div>
      )}
      {s.jumping && jump && (
        <div className={'transit-overlay transit-' + jump.mode} aria-live="polite">
          <div
            className="transit-flash"
            style={{ opacity: Math.max(0, 1 - Math.abs(universe.jumpProgress - 0.72) / 0.045) }}
          />
          <div className="transit-status">
            <span className="transit-phase">
              {jump.mode === 'black_hole'
                ? zh
                  ? '黑洞穿越'
                  : 'BLACK HOLE TRANSIT'
                : jump.mode === 'wormhole'
                  ? zh
                    ? '虫洞穿越'
                    : 'WORMHOLE TRANSIT'
                  : zh
                    ? '曲速跃迁'
                    : 'WARP TRANSIT'}
            </span>
            <strong>{zh ? exit?.nameZh : exit?.nameEn}</strong>
            <div
              className="transit-progress"
              role="progressbar"
              aria-label={zh ? '穿越进度' : 'Transit progress'}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(universe.jumpProgress * 100)}
            >
              <i style={{ width: `${universe.jumpProgress * 100}%` }} />
            </div>
            <div className="transit-detail">
              <span>
                {Math.round(universe.jumpProgress * 100)}% ·{' '}
                {universe.jumpProgress < 0.25
                  ? zh
                    ? '建立通道'
                    : 'CONNECTING'
                  : universe.jumpProgress < 0.72
                    ? jump.audioReady
                      ? zh
                        ? '时空航行'
                        : 'IN TRANSIT'
                      : zh
                        ? '载入音乐与出口'
                        : 'LOADING AUDIO / EXIT'
                    : zh
                      ? '恢复通常空间'
                      : 'STABILIZING'}
              </span>
              <span>
                {jump.mode === 'black_hole'
                  ? zh
                    ? '已被引力捕获 · 无法中止'
                    : 'GRAVITY CAPTURE · TRANSIT LOCKED'
                  : zh
                    ? '空格中止'
                    : 'SPACE · ABORT'}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
