const Store = require('electron-store');

const DEFAULTS = Object.freeze({
  windowBounds: { width: 280, height: 360 },
  mouseThrough: false,
  selectedAvatar: 'mj-dance.gif',
  beatConfig: {
    fftSize: 1024,
    bassRange: [0, 8],
    historySize: 43,
    beatThreshold: 1.3,
    minEnergy: 40,
    beatCooldownMs: 120
  }
});

let store = null;

function getStore() {
  if (store) return store;
  store = new Store({ defaults: DEFAULTS });
  return store;
}

function clampNumber(v, { min, max }) {
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  if (typeof min === 'number' && n < min) return min;
  if (typeof max === 'number' && n > max) return max;
  return n;
}

function sanitizeBeatConfig(patch) {
  if (!patch || typeof patch !== 'object') return null;

  const next = {};

  if (patch.fftSize != null) {
    const fftSize = clampNumber(patch.fftSize, { min: 256, max: 8192 });
    if (fftSize) next.fftSize = Math.round(fftSize);
  }

  if (patch.historySize != null) {
    const historySize = clampNumber(patch.historySize, { min: 5, max: 240 });
    if (historySize) next.historySize = Math.round(historySize);
  }

  if (patch.beatThreshold != null) {
    const beatThreshold = clampNumber(patch.beatThreshold, { min: 1.0, max: 3.0 });
    if (beatThreshold) next.beatThreshold = beatThreshold;
  }

  if (patch.minEnergy != null) {
    const minEnergy = clampNumber(patch.minEnergy, { min: 0, max: 255 });
    if (minEnergy != null) next.minEnergy = minEnergy;
  }

  if (patch.beatCooldownMs != null) {
    const beatCooldownMs = clampNumber(patch.beatCooldownMs, { min: 0, max: 1000 });
    if (beatCooldownMs != null) next.beatCooldownMs = Math.round(beatCooldownMs);
  }

  if (patch.bassRange != null && Array.isArray(patch.bassRange) && patch.bassRange.length === 2) {
    const lo = clampNumber(patch.bassRange[0], { min: 0, max: 1024 });
    const hi = clampNumber(patch.bassRange[1], { min: 1, max: 1024 });
    if (lo != null && hi != null && hi > lo) next.bassRange = [Math.round(lo), Math.round(hi)];
  }

  return next;
}

function getConfig(storeInstance) {
  const storeRef = storeInstance || getStore();
  return {
    windowBounds: storeRef.get('windowBounds'),
    mouseThrough: storeRef.get('mouseThrough'),
    selectedAvatar: storeRef.get('selectedAvatar'),
    beatConfig: storeRef.get('beatConfig')
  };
}

function setConfig(storeInstance, patch) {
  const storeRef = storeInstance || getStore();
  const nextPatch = {};

  if (patch && typeof patch === 'object') {
    if (patch.windowBounds && typeof patch.windowBounds === 'object') {
      const w = patch.windowBounds;
      const width = clampNumber(w.width, { min: 120, max: 1200 });
      const height = clampNumber(w.height, { min: 120, max: 1200 });
      const x = w.x != null ? clampNumber(w.x, { min: -100000, max: 100000 }) : undefined;
      const y = w.y != null ? clampNumber(w.y, { min: -100000, max: 100000 }) : undefined;
      nextPatch.windowBounds = {
        ...(storeRef.get('windowBounds') || DEFAULTS.windowBounds),
        ...(width != null ? { width: Math.round(width) } : {}),
        ...(height != null ? { height: Math.round(height) } : {}),
        ...(x != null ? { x: Math.round(x) } : {}),
        ...(y != null ? { y: Math.round(y) } : {})
      };
    }

    if (typeof patch.mouseThrough === 'boolean') nextPatch.mouseThrough = patch.mouseThrough;

    if (typeof patch.selectedAvatar === 'string' && patch.selectedAvatar.trim()) {
      nextPatch.selectedAvatar = patch.selectedAvatar.trim();
    }

    if (patch.beatConfig && typeof patch.beatConfig === 'object') {
      const sanitized = sanitizeBeatConfig(patch.beatConfig);
      if (sanitized) nextPatch.beatConfig = { ...storeRef.get('beatConfig'), ...sanitized };
    }
  }

  Object.entries(nextPatch).forEach(([k, v]) => storeRef.set(k, v));
  return nextPatch;
}

function getDefaults() {
  return DEFAULTS;
}

module.exports = {
  getStore,
  getConfig,
  setConfig,
  getDefaults
};

