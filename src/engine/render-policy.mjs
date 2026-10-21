export function renderBudget(quality) {
  return quality === 'low'
    ? { shaderFps: 12, shaderPixels: 32400, dpr: 0.8, octaves: 2, swirls: 2 }
    : {
        shaderFps: 20,
        shaderPixels: 129600,
        dpr: 1.2,
        octaves: 3,
        swirls: 4,
      };
}
export function resolutionForLoad(dpr, fps, quality, recover = false) {
  const ceiling = renderBudget(quality).dpr;
  if (fps < 57) return Math.max(0.5, Math.round(dpr * 0.85 * 100) / 100);
  if (recover && fps >= 59) return Math.min(ceiling, Math.round((dpr + 0.05) * 100) / 100);
  return Math.min(ceiling, dpr);
}
export function frameSlot(timestamp, deadline) {
  const interval = 1000 / 60;
  if (timestamp + 0.5 < deadline) return { render: false, deadline };
  return {
    render: true,
    deadline:
      deadline +
      interval * (1 + Math.floor((Math.max(0, timestamp - deadline) + 0.0001) / interval)),
  };
}
export function shouldRenderContinuously({
  foreground,
  paused,
  panel,
  captured,
  jumping,
  pauseAnimations,
  motion,
}) {
  return foreground && (captured || (!paused && !panel)) && (!pauseAnimations || jumping || motion);
}
export function shaderSize(width, height, quality) {
  const area = Math.max(1, width * height),
    scale = Math.min(1, Math.sqrt(renderBudget(quality).shaderPixels / area));
  return [Math.max(1, Math.floor(width * scale)), Math.max(1, Math.floor(height * scale))];
}
