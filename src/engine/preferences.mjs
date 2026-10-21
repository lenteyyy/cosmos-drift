const defaults = {
  lang: 'zh',
  quality: 'high',
  pauseAnimations: false,
  muted: false,
  musicEnabled: true,
  musicVolume: 0.45,
  soundVolume: 0.65,
  voiceEnabled: true,
  voiceVolume: 0.8,
  uiScale: 1,
  sensitivity: 1,
  missionStep: 1,
  discoveries: [],
};
const keys = {
  lang: 'lang',
  quality: 'quality',
  pauseAnimations: 'pause-animations',
  muted: 'muted',
  musicEnabled: 'music',
  musicVolume: 'music-volume',
  soundVolume: 'sound-volume',
  voiceEnabled: 'voice',
  voiceVolume: 'voice-volume',
  uiScale: 'ui-scale',
  sensitivity: 'sensitivity',
  missionStep: 'mission-step',
  discoveries: 'log',
};
/** Browser storage is untrusted and may be disabled or left behind by older versions. */
export function restorePreferences(read, routeLength) {
  const result = { ...defaults, discoveries: [] };
  for (const [name, key] of Object.entries(keys)) {
    let value;
    try {
      value = JSON.parse(read('cosmos-' + key) || 'null');
    } catch {
      continue;
    }
    if (name === 'lang' && ['zh', 'en'].includes(value)) result[name] = value;
    else if (name === 'quality' && ['high', 'low'].includes(value)) result.quality = value;
    else if (typeof defaults[name] === 'boolean' && typeof value === 'boolean')
      result[name] = value;
    else if (
      ['musicVolume', 'soundVolume', 'voiceVolume', 'sensitivity'].includes(name) &&
      typeof value === 'number' &&
      Number.isFinite(value)
    )
      result[name] = Math.max(
        name === 'sensitivity' ? 0.25 : 0,
        Math.min(name === 'sensitivity' ? 3 : 1, value),
      );
    else if (name === 'uiScale' && [1, 1.15, 1.3].includes(value)) result.uiScale = value;
    else if (name === 'missionStep' && Number.isInteger(value))
      result.missionStep = Math.max(0, Math.min(routeLength - 1, value));
    else if (name === 'discoveries' && Array.isArray(value)) {
      const seen = new Set();
      result.discoveries = value
        .filter((item) => {
          if (
            !item ||
            typeof item.id !== 'string' ||
            !/^[\w.-]{1,100}$/.test(item.id) ||
            typeof item.at !== 'string' ||
            !Number.isFinite(Date.parse(item.at)) ||
            seen.has(item.id)
          )
            return false;
          seen.add(item.id);
          return true;
        })
        .slice(-4000)
        .map(({ id, at }) => ({ id, at }));
    }
  }
  return result;
}
