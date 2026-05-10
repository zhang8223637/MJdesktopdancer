const els = {
  fftSize: document.getElementById('fftSize'),
  bassLo: document.getElementById('bassLo'),
  bassHi: document.getElementById('bassHi'),
  beatThreshold: document.getElementById('beatThreshold'),
  minEnergy: document.getElementById('minEnergy'),
  beatCooldownMs: document.getElementById('beatCooldownMs'),
  historySize: document.getElementById('historySize'),
  reset: document.getElementById('reset')
};

let defaults = null;

function readUiBeatConfig() {
  return {
    fftSize: Number(els.fftSize.value),
    bassRange: [Number(els.bassLo.value), Number(els.bassHi.value)],
    beatThreshold: Number(els.beatThreshold.value),
    minEnergy: Number(els.minEnergy.value),
    beatCooldownMs: Number(els.beatCooldownMs.value),
    historySize: Number(els.historySize.value)
  };
}

function applyToUi(cfg) {
  els.fftSize.value = String(cfg.fftSize);
  els.bassLo.value = String(cfg.bassRange[0]);
  els.bassHi.value = String(cfg.bassRange[1]);
  els.beatThreshold.value = String(cfg.beatThreshold);
  els.minEnergy.value = String(cfg.minEnergy);
  els.beatCooldownMs.value = String(cfg.beatCooldownMs);
  els.historySize.value = String(cfg.historySize);
}

async function pushUpdate() {
  const next = readUiBeatConfig();
  await window.mjAPI.setConfig({ beatConfig: next });
}

async function bootstrap() {
  const cfg = await window.mjAPI.getConfig();
  defaults = await window.mjAPI.getDefaults();
  applyToUi(cfg.beatConfig);

  window.mjAPI.onConfigChanged(({ patch }) => {
    if (patch.beatConfig) applyToUi(patch.beatConfig);
  });

  Object.values(els).forEach((el) => {
    if (!el || el === els.reset) return;
    el.addEventListener('change', pushUpdate);
    el.addEventListener('input', () => {
      clearTimeout(el.__t);
      el.__t = setTimeout(pushUpdate, 120);
    });
  });

  els.reset.addEventListener('click', async () => {
    await window.mjAPI.setConfig({ beatConfig: defaults.beatConfig });
  });
}

bootstrap();

