const mj = document.getElementById('mj');
const statusEl = document.getElementById('status');

let beatConfig = null;

function setStatus(text) {
  statusEl.textContent = text;
}

function setAvatar(fileName) {
  const src = `../../../assets/${fileName}?t=${Date.now()}`;
  mj.src = src;
}

function applyBeat() {
  mj.classList.add('beat');
  setTimeout(() => mj.classList.remove('beat'), 100);
}

async function bootstrap() {
  const cfg = await window.mjAPI.getConfig();
  beatConfig = cfg.beatConfig;
  setAvatar(cfg.selectedAvatar || 'mj-dance.gif');

  window.mjAPI.onConfigChanged(({ patch }) => {
    if (patch.beatConfig) beatConfig = patch.beatConfig;
    if (patch.selectedAvatar) setAvatar(patch.selectedAvatar);
  });

  const detector = window.mjBeatDetector.createBeatDetector({
    getConfig: () => beatConfig,
    onBeat: ({ energy }) => {
      applyBeat();
      setStatus(`🎵 BEAT! (${energy.toFixed(0)})`);
    },
    onStatus: setStatus,
    onError: (e) => console.error(e)
  });

  await detector.start();
}

document.addEventListener('dblclick', () => {
  window.mjAPI.quit();
});

bootstrap();

