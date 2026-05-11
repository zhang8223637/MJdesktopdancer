# MJ Desktop Dancer v0.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 v0.1 基础上完成 v0.2：托盘/菜单栏菜单、设置面板、配置持久化、多 GIF 切换，并适配 macOS（隐藏 Dock）。

**Architecture:** 主进程作为唯一配置中心（electron-store）与系统集成点（Tray/Window），渲染进程通过 preload 暴露的受限 API 读写配置并订阅变更；主窗口负责动画与节拍反馈，设置窗口负责调参与写入配置。

**Tech Stack:** Electron（>=28，当前 30）、原生 HTML/CSS/JS、Web Audio API、electron-store

---

## 文件结构（将被创建/修改）

**Create**
- `package.json`
- `src/main/main.js`
- `src/main/preload.js`
- `src/main/store.js`
- `src/main/ipc.js`
- `src/main/tray.js`
- `src/main/windows/mainWindow.js`
- `src/main/windows/settingsWindow.js`
- `src/renderer/beatDetector.js`
- `src/renderer/main/index.html`
- `src/renderer/main/styles.css`
- `src/renderer/main/renderer.js`
- `src/renderer/settings/settings.html`
- `src/renderer/settings/settings.css`
- `src/renderer/settings/settings.js`
- `assets/placeholder.svg`
- `assets/trayTemplate.png`（由你提供透明底 PNG）

**Remove/Deprecate（从 v0.1 根目录迁移后不再使用）**
- 根目录的 `main.js/preload.js/index.html/renderer.js/styles.css`（若现存则迁移并删除）

---

### Task 1: 初始化项目与目录（入口迁移到 src/）

**Files:**
- Create: `package.json`
- Create: `src/main/main.js`

- [ ] **Step 1: 写入 package.json（入口指向 src/main/main.js，并加入 electron-store）**

```json
{
  "name": "mj-desktop-dancer",
  "version": "0.2.0",
  "description": "Desktop Michael Jackson that dances to your music's beat",
  "main": "src/main/main.js",
  "scripts": {
    "start": "electron .",
    "dev": "electron . --enable-logging"
  },
  "keywords": ["electron", "desktop-pet", "music", "beat-detection"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "electron-store": "^9.0.0"
  },
  "devDependencies": {
    "electron": "^30.0.0"
  }
}
```

- [ ] **Step 2: 写入主进程入口 src/main/main.js（只做启动编排）**

```js
const { app, globalShortcut } = require('electron');
const path = require('path');

const { createMainWindow } = require('./windows/mainWindow');
const { registerIpc } = require('./ipc');
const { createTray } = require('./tray');
const { getStore } = require('./store');
const { ensureAssetsReady } = require('./windows/mainWindow');

let mainWindow = null;
let tray = null;

function applyMacOSBehavior() {
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
}

app.whenReady().then(async () => {
  applyMacOSBehavior();

  const store = getStore();
  await ensureAssetsReady();

  mainWindow = createMainWindow(store);
  registerIpc({ store, getMainWindow: () => mainWindow });
  tray = createTray({ store, getMainWindow: () => mainWindow });

  globalShortcut.register('CommandOrControl+Shift+M', () => app.quit());
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
```

- [ ] **Step 3: 安装依赖并验证 Electron 可启动**

Run:
```bash
npm install
```

Expected:
- `electron` 与 `electron-store` 依赖安装成功

---

### Task 2: 配置中心（electron-store）与默认配置

**Files:**
- Create: `src/main/store.js`

- [ ] **Step 1: 写入 store.js（默认值 + get/set + 校验）**

```js
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
    const lo = clampNumber(patch.bassRange[0], { min: 0, max: 512 });
    const hi = clampNumber(patch.bassRange[1], { min: 1, max: 512 });
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
      const x = w.x != null ? clampNumber(w.x, { min: -10000, max: 10000 }) : undefined;
      const y = w.y != null ? clampNumber(w.y, { min: -10000, max: 10000 }) : undefined;
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
```

### Task 3: 主窗口（透明置顶 + 位置持久化 + 右键菜单入口）

**Files:**
- Create: `src/main/windows/mainWindow.js`
- Create: `src/main/preload.js`

- [ ] **Step 1: 写入 preload.js（受限 API，不暴露 ipcRenderer）**

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mjAPI', {
  quit: () => ipcRenderer.send('app:quit'),

  getConfig: (keys) => ipcRenderer.invoke('config:get', { keys }),
  setConfig: (patch) => ipcRenderer.invoke('config:set', { patch }),
  getDefaults: () => ipcRenderer.invoke('config:defaults'),

  listAvatars: () => ipcRenderer.invoke('avatar:list'),

  resetPosition: () => ipcRenderer.send('window:resetPosition'),

  onConfigChanged: (handler) => {
    ipcRenderer.removeAllListeners('config:changed');
    ipcRenderer.on('config:changed', (_evt, payload) => handler(payload));
  }
});
```

- [ ] **Step 2: 写入 mainWindow.js（读取 store 的 windowBounds / mouseThrough）**

```js
const { BrowserWindow, Menu, app } = require('electron');
const path = require('path');
const fs = require('fs');

const ASSETS_DIR = path.resolve(__dirname, '../../../assets');

function ensureAssetsReady() {
  if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
  const placeholderPath = path.join(ASSETS_DIR, 'placeholder.svg');
  if (!fs.existsSync(placeholderPath)) {
    fs.writeFileSync(
      placeholderPath,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300">
  <ellipse cx="100" cy="55" rx="45" ry="10" fill="#111"/>
  <rect x="70" y="25" width="60" height="35" fill="#111"/>
  <ellipse cx="100" cy="80" rx="22" ry="26" fill="#e8c4a0"/>
  <rect x="70" y="110" width="60" height="80" fill="#fff" stroke="#000" stroke-width="2"/>
  <polygon points="70,110 50,200 70,200" fill="#111"/>
  <polygon points="130,110 150,200 130,200" fill="#111"/>
  <rect x="75" y="190" width="22" height="80" fill="#222"/>
  <rect x="103" y="190" width="22" height="80" fill="#222"/>
  <rect x="75" y="265" width="22" height="10" fill="#fff"/>
  <rect x="103" y="265" width="22" height="10" fill="#fff"/>
  <ellipse cx="86" cy="280" rx="14" ry="6" fill="#000"/>
  <ellipse cx="114" cy="280" rx="14" ry="6" fill="#000"/>
  <ellipse cx="55" cy="180" rx="8" ry="10" fill="#fff" stroke="#ccc"/>
</svg>\n`,
      'utf8'
    );
  }
}

function buildContextMenuTemplate({ store, getMainWindow, openSettings }) {
  const mouseThrough = Boolean(store.get('mouseThrough'));
  return [
    {
      label: '打开设置',
      click: () => openSettings()
    },
    { type: 'separator' },
    {
      label: mouseThrough ? '✓ 鼠标穿透' : '鼠标穿透',
      click: () => {
        const next = !Boolean(store.get('mouseThrough'));
        store.set('mouseThrough', next);
        const win = getMainWindow();
        if (win) win.setIgnoreMouseEvents(next, { forward: true });
      }
    },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ];
}

function createMainWindow(store, { openSettings } = {}) {
  const bounds = store.get('windowBounds') || { width: 280, height: 360 };

  const win = new BrowserWindow({
    width: bounds.width || 280,
    height: bounds.height || 360,
    x: bounds.x,
    y: bounds.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.resolve(__dirname, '../preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadFile(path.resolve(__dirname, '../../renderer/main/index.html'));
  win.setAlwaysOnTop(true, 'screen-saver');

  const applyMouseThrough = () => {
    const mouseThrough = Boolean(store.get('mouseThrough'));
    win.setIgnoreMouseEvents(mouseThrough, { forward: true });
  };
  applyMouseThrough();

  let boundsTimer = null;
  const saveBoundsDebounced = () => {
    if (boundsTimer) clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      const b = win.getBounds();
      store.set('windowBounds', { x: b.x, y: b.y, width: b.width, height: b.height });
    }, 250);
  };
  win.on('move', saveBoundsDebounced);
  win.on('resize', saveBoundsDebounced);

  win.webContents.on('context-menu', () => {
    const { createSettingsWindow } = require('./settingsWindow');
    const settingsOpen = () => createSettingsWindow(store);
    const menu = Menu.buildFromTemplate(
      buildContextMenuTemplate({ store, getMainWindow: () => win, openSettings: openSettings || settingsOpen })
    );
    menu.popup({ window: win });
  });

  return win;
}

module.exports = {
  createMainWindow,
  buildContextMenuTemplate,
  ensureAssetsReady,
  ASSETS_DIR
};
```

- [ ] **Step 3: 写入占位渲染文件（保证主窗口能 loadFile 成功）**

Create: `src/renderer/main/index.html`

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>MJ Dancer</title>
  </head>
  <body style="background:transparent;margin:0;font-family:monospace;color:#fff">
    <div style="padding:10px;opacity:.6">MJ Desktop Dancer loading...</div>
  </body>
</html>
```

- [ ] **Step 4: 启动验证**

Run:
```bash
npm start
```

Expected:
- 出现透明无边框窗口（页面显示 “loading...”）
- 右键能弹出菜单项

---

### Task 4: IPC（配置读写 + 默认值 + 资源扫描 + 重置位置）

**Files:**
- Create: `src/main/ipc.js`
- Modify: `src/main/main.js`（让 createMainWindow 的 openSettings 来自 settingsWindow 单例）

- [ ] **Step 1: 写入 ipc.js**

```js
const { ipcMain, screen, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const { getConfig, setConfig, getDefaults } = require('./store');
const { ASSETS_DIR } = require('./windows/mainWindow');
const { createSettingsWindow } = require('./windows/settingsWindow');

function listAvatars() {
  if (!fs.existsSync(ASSETS_DIR)) return [];
  const entries = fs.readdirSync(ASSETS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.gif'))
    .map((e) => ({
      fileName: e.name,
      displayName: e.name.replace(/\.gif$/i, '')
    }))
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

function broadcastToAllWindows(channel, payload) {
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) w.webContents.send(channel, payload);
  });
}

function registerIpc({ store, getMainWindow }) {
  ipcMain.on('app:quit', () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.close();
  });

  ipcMain.on('window:resetPosition', () => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;
    const display = screen.getPrimaryDisplay();
    const targetX = Math.round(display.workArea.x + (display.workArea.width - win.getBounds().width) / 2);
    const targetY = Math.round(display.workArea.y + (display.workArea.height - win.getBounds().height) / 2);
    win.setPosition(targetX, targetY, false);
    const b = win.getBounds();
    store.set('windowBounds', { x: b.x, y: b.y, width: b.width, height: b.height });
    broadcastToAllWindows('config:changed', { patch: { windowBounds: store.get('windowBounds') } });
  });

  ipcMain.on('settings:open', () => {
    createSettingsWindow(store);
  });

  ipcMain.handle('config:get', (_evt, { keys } = {}) => {
    const full = getConfig(store);
    if (!Array.isArray(keys) || keys.length === 0) return full;
    const subset = {};
    keys.forEach((k) => {
      if (k in full) subset[k] = full[k];
    });
    return subset;
  });

  ipcMain.handle('config:defaults', () => getDefaults());

  ipcMain.handle('config:set', (_evt, { patch } = {}) => {
    const nextPatch = setConfig(store, patch || {});
    if (Object.keys(nextPatch).length > 0) {
      broadcastToAllWindows('config:changed', { patch: nextPatch });
    }
    return { ok: true, patch: nextPatch };
  });

  ipcMain.handle('avatar:list', () => ({ avatars: listAvatars() }));

  ipcMain.handle('path:assets', () => ({ assetsDir: ASSETS_DIR }));
}

module.exports = { registerIpc };
```

- [ ] **Step 2: 调整 main.js，让 mainWindow 的“打开设置”走 settingsWindow 单例**

将 `src/main/main.js` 中 createMainWindow 调用替换为：

```js
const { createSettingsWindow } = require('./windows/settingsWindow');
// ...
mainWindow = createMainWindow(store, { openSettings: () => createSettingsWindow(store) });
```

- [ ] **Step 3: 启动验证**

Run:
```bash
npm start
```

Expected:
- IPC 注册成功，应用启动无报错（设置窗口在 Task 7 实装后再验收打开）

---

### Task 5: 托盘/菜单栏（Tray）与菜单联动

**Files:**
- Create: `src/main/tray.js`
- Modify: `src/main/main.js`

- [ ] **Step 1: 写入 tray.js（菜单模板复用 + 形象 radio 子菜单）**

```js
const { Tray, Menu, nativeImage, BrowserWindow, screen, app } = require('electron');
const path = require('path');
const fs = require('fs');

const { buildContextMenuTemplate, ASSETS_DIR } = require('./windows/mainWindow');
const { createSettingsWindow } = require('./windows/settingsWindow');

function listAvatars() {
  if (!fs.existsSync(ASSETS_DIR)) return [];
  return fs
    .readdirSync(ASSETS_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.gif'))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

function broadcastConfigChanged(patch) {
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) w.webContents.send('config:changed', { patch });
  });
}

function resetMainWindowPosition({ store, getMainWindow }) {
  const win = getMainWindow();
  if (!win || win.isDestroyed()) return;
  const display = screen.getPrimaryDisplay();
  const b = win.getBounds();
  const x = Math.round(display.workArea.x + (display.workArea.width - b.width) / 2);
  const y = Math.round(display.workArea.y + (display.workArea.height - b.height) / 2);
  win.setPosition(x, y, false);
  const next = win.getBounds();
  store.set('windowBounds', { x: next.x, y: next.y, width: next.width, height: next.height });
  broadcastConfigChanged({ windowBounds: store.get('windowBounds') });
}

function resolveTrayIconPath() {
  return path.join(ASSETS_DIR, 'trayTemplate.png');
}

function createTray({ store, getMainWindow }) {
  const iconPath = resolveTrayIconPath();
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  if (process.platform === 'darwin') icon.setTemplateImage(true);

  const tray = new Tray(icon);
  tray.setToolTip('MJ Desktop Dancer');

  const rebuild = () => {
    const avatars = listAvatars();
    const selected = store.get('selectedAvatar');

    const avatarSubmenu = avatars.length
      ? avatars.map((fileName) => ({
          label: fileName,
          type: 'radio',
          checked: fileName === selected,
          click: () => {
            store.set('selectedAvatar', fileName);
            broadcastConfigChanged({ selectedAvatar: fileName });
            tray.setContextMenu(rebuild());
          }
        }))
      : [{ label: '未找到 GIF（assets/*.gif）', enabled: false }];

    const menu = Menu.buildFromTemplate([
      { label: 'MJ Desktop Dancer', enabled: false },
      { type: 'separator' },
      { label: '打开设置', click: () => createSettingsWindow(store) },
      { label: '形象', submenu: avatarSubmenu },
      { type: 'separator' },
      ...buildContextMenuTemplate({
        store,
        getMainWindow,
        openSettings: () => createSettingsWindow(store)
      }).filter((i) => i.label !== '打开设置' && i.label !== '退出'),
      { label: '重置位置', click: () => resetMainWindowPosition({ store, getMainWindow }) },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ]);

    return menu;
  };

  tray.setContextMenu(rebuild());

  store.onDidChange('mouseThrough', () => tray.setContextMenu(rebuild()));
  store.onDidChange('selectedAvatar', () => tray.setContextMenu(rebuild()));

  tray.on('click', () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.show();
  });

  return tray;
}

module.exports = { createTray };
```

- [ ] **Step 2: 启动验证**

Expected:
- 菜单栏/托盘出现图标（你提供透明版 `assets/trayTemplate.png` 后应显示正常）
- 菜单项可点击且不会崩溃

---

### Task 6: 渲染主窗口（GIF + 音频 + 节拍检测模块化 + 配置联动）

**Files:**
- Create: `src/renderer/beatDetector.js`
- Create: `src/renderer/main/index.html`
- Create: `src/renderer/main/styles.css`
- Create: `src/renderer/main/renderer.js`
- Modify: `src/main/windows/mainWindow.js`（loadFile 指向新路径已在 Task 3 覆盖）

- [ ] **Step 1: 写入 beatDetector.js（把 v0.1 算法抽成模块）**

```js
function computeBassEnergy(freqData, bassRange) {
  const lo = Math.max(0, bassRange[0] | 0);
  const hi = Math.min(freqData.length, bassRange[1] | 0);
  if (hi <= lo) return 0;
  let sum = 0;
  for (let i = lo; i < hi; i++) sum += freqData[i];
  return sum / (hi - lo);
}

function computeAverage(arr) {
  if (!arr.length) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

function createBeatDetector({ getConfig, onBeat, onError, onStatus }) {
  let audioCtx = null;
  let analyser = null;
  let source = null;
  let stream = null;
  let freqData = null;
  let rafId = null;
  let energyHistory = [];
  let lastBeatTime = 0;

  async function start() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      audioCtx = new AudioContext();
      source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();

      const cfg = getConfig();
      analyser.fftSize = cfg.fftSize;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);

      freqData = new Uint8Array(analyser.frequencyBinCount);
      energyHistory = [];
      lastBeatTime = 0;

      if (onStatus) onStatus('🎵 监听中');

      const tick = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(freqData);

        const c = getConfig();
        if (analyser.fftSize !== c.fftSize) {
          analyser.fftSize = c.fftSize;
          freqData = new Uint8Array(analyser.frequencyBinCount);
          energyHistory = [];
        }

        const bass = computeBassEnergy(freqData, c.bassRange);

        energyHistory.push(bass);
        if (energyHistory.length > c.historySize) energyHistory.shift();
        const avg = computeAverage(energyHistory);

        const now = performance.now();
        const isBeat =
          bass > avg * c.beatThreshold && bass > c.minEnergy && now - lastBeatTime > c.beatCooldownMs;

        if (isBeat) {
          lastBeatTime = now;
          if (onBeat) onBeat({ energy: bass, avg });
        }

        rafId = requestAnimationFrame(tick);
      };

      rafId = requestAnimationFrame(tick);
    } catch (e) {
      if (onStatus) onStatus(`❌ ${e.message}`);
      if (onError) onError(e);
    }
  }

  async function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (audioCtx) await audioCtx.close().catch(() => {});
    audioCtx = null;
    analyser = null;
    source = null;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  return { start, stop };
}

window.mjBeatDetector = { createBeatDetector };
```

- [ ] **Step 2: 写入主窗口 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>MJ Dancer</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <div id="container">
      <img id="mj" src="../../../assets/mj-dance.gif" onerror="this.src='../../../assets/placeholder.svg'" alt="MJ" draggable="false" />
      <div id="status">等待音频...</div>
    </div>
    <script src="../beatDetector.js"></script>
    <script src="renderer.js"></script>
  </body>
</html>
```

- [ ] **Step 3: 写入 styles.css（沿用 v0.1）**

```css
* { margin: 0; padding: 0; box-sizing: border-box; user-select: none; }

html, body {
  width: 100%;
  height: 100%;
  background: transparent;
  overflow: hidden;
}

#container {
  width: 100%;
  height: 100%;
  -webkit-app-region: drag;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

#mj {
  width: 90%;
  height: 90%;
  object-fit: contain;
  -webkit-app-region: no-drag;
  pointer-events: none;
  transition: transform 0.08s ease-out, filter 0.08s ease-out;
  will-change: transform, filter;
}

#mj.beat {
  transform: scale(1.12);
  filter: brightness(1.4) drop-shadow(0 0 12px gold);
}

#status {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255,255,255,0.6);
  font-size: 10px;
  font-family: monospace;
  text-shadow: 0 0 3px black;
  pointer-events: none;
}
```

- [ ] **Step 4: 写入 renderer.js（读取 config + 切换 avatar + 初始化 beatDetector）**

```js
const mj = document.getElementById('mj');
const statusEl = document.getElementById('status');

let beatConfig = null;
let selectedAvatar = null;

function setStatus(text) {
  statusEl.textContent = text;
}

function setAvatar(fileName) {
  selectedAvatar = fileName;
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
  selectedAvatar = cfg.selectedAvatar;
  setAvatar(selectedAvatar || 'mj-dance.gif');

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
  if (window.mjAPI) window.mjAPI.quit();
});

bootstrap();
```

- [ ] **Step 5: 启动验证（需要 assets/mj-dance.gif 存在，否则走 placeholder）**

Expected:
- 主窗口能显示 GIF 或 placeholder
- 允许麦克风权限后，状态变为“监听中”
- 音乐/鼓点时触发缩放与亮度变化

---

### Task 7: 设置窗口（分组区块 UI + 实时写入配置 + 恢复默认）

**Files:**
- Create: `src/main/windows/settingsWindow.js`
- Create: `src/renderer/settings/settings.html`
- Create: `src/renderer/settings/settings.css`
- Create: `src/renderer/settings/settings.js`
- Modify: `src/main/ipc.js`（settings:open 已注册，确保可用）

- [ ] **Step 1: 写入 settingsWindow.js（单例窗口）**

```js
const { BrowserWindow } = require('electron');
const path = require('path');

let settingsWindow = null;

function createSettingsWindow(store) {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 420,
    height: 520,
    resizable: true,
    minimizable: false,
    maximizable: false,
    title: 'MJ 设置',
    webPreferences: {
      preload: path.resolve(__dirname, '../preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  settingsWindow.loadFile(path.resolve(__dirname, '../../renderer/settings/settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

module.exports = { createSettingsWindow };
```

- [ ] **Step 2: 写入 settings.html（分组区块 B）**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>MJ 设置</title>
    <link rel="stylesheet" href="settings.css" />
  </head>
  <body>
    <div class="wrap">
      <h1>MJ 设置</h1>

      <section class="card">
        <h2>音频</h2>
        <label class="row">
          <span>fftSize</span>
          <select id="fftSize">
            <option value="512">512</option>
            <option value="1024">1024</option>
            <option value="2048">2048</option>
          </select>
        </label>
        <label class="row">
          <span>bassRange lo</span>
          <input id="bassLo" type="number" min="0" max="256" step="1" />
        </label>
        <label class="row">
          <span>bassRange hi</span>
          <input id="bassHi" type="number" min="1" max="256" step="1" />
        </label>
      </section>

      <section class="card">
        <h2>节拍</h2>
        <label class="row">
          <span>beatThreshold</span>
          <input id="beatThreshold" type="number" min="1" max="3" step="0.05" />
        </label>
        <label class="row">
          <span>minEnergy</span>
          <input id="minEnergy" type="number" min="0" max="255" step="1" />
        </label>
        <label class="row">
          <span>beatCooldownMs</span>
          <input id="beatCooldownMs" type="number" min="0" max="1000" step="10" />
        </label>
        <label class="row">
          <span>historySize</span>
          <input id="historySize" type="number" min="5" max="240" step="1" />
        </label>
      </section>

      <section class="card">
        <h2>高级</h2>
        <button id="reset">恢复默认</button>
      </section>

      <p class="hint">调参默认实时生效；重启应用会保持你的设置。</p>
    </div>
    <script src="settings.js"></script>
  </body>
</html>
```

- [ ] **Step 3: 写入 settings.css**

```css
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; margin: 0; background: #0b0d12; color: #e8ecf3; }
.wrap { padding: 16px; }
h1 { font-size: 18px; margin: 0 0 12px; }
.card { background: #121624; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px; margin-bottom: 12px; }
h2 { font-size: 14px; margin: 0 0 10px; color: rgba(255,255,255,0.9); }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 8px 0; }
.row span { font-size: 12px; color: rgba(255,255,255,0.75); }
input, select, button { background: #0b0d12; color: #e8ecf3; border: 1px solid rgba(255,255,255,0.14); border-radius: 8px; padding: 8px 10px; }
input, select { width: 180px; }
button { cursor: pointer; }
.hint { font-size: 12px; color: rgba(255,255,255,0.55); margin: 8px 0 0; }
```

- [ ] **Step 4: 写入 settings.js（加载配置 + 变更即 setConfig + 恢复默认）**

```js
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

let beatConfig = null;
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
  beatConfig = cfg.beatConfig;
  applyToUi(beatConfig);

  window.mjAPI.onConfigChanged(({ patch }) => {
    if (patch.beatConfig) {
      beatConfig = patch.beatConfig;
      applyToUi(beatConfig);
    }
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
```

- [ ] **Step 5: 启动验证**

Expected:
- 托盘/右键“打开设置”能打开设置窗口
- 修改参数后，主窗口节拍触发灵敏度明显变化
- 点击“恢复默认”后参数回到默认值

---

### Task 8: 多 GIF 扫描与菜单切换的完整闭环（持久化 + 即时生效）

**Files:**
- Modify: `src/main/tray.js`
- Modify: `src/main/ipc.js`
- Modify: `src/renderer/main/renderer.js`

- [ ] **Step 1: 主窗口在收到 selectedAvatar 变化时立即切换 GIF**

确认 `renderer.js` 已对 `patch.selectedAvatar` 调用 `setAvatar`，且附带 `?t=` 避免缓存。

- [ ] **Step 2: 重启验证**

Expected:
- 选择某个 `assets/*.gif` 后，重启应用仍保持该形象

---

### Task 9: macOS 行为与收尾校验

**Files:**
- Modify: `src/main/main.js`
- Add: `assets/trayTemplate.png`（你提供透明版 PNG）

- [ ] **Step 1: 放置托盘图标**

把你提供的透明底 PNG 放到：
`assets/trayTemplate.png`

- [ ] **Step 2: macOS 验收点**

Expected（macOS）：
- 启动后 Dock 不显示图标（已调用 `app.dock.hide()`）
- 菜单栏图标显示正常（透明背景，图标随系统主题表现合理）

- [ ] **Step 3: 全平台验收点**

Expected（Windows/macOS/Linux）：
- `npm start` 启动无报错
- 托盘/右键菜单可用：打开设置 / 鼠标穿透 / 重置位置 / 退出
- 配置持久化：位置、穿透、形象、节拍参数重启后仍生效

---

## 执行方式

Plan complete and saved to `docs/superpowers/plans/2026-05-10-mj-desktop-dancer-v0.2-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** - 我按任务逐个派发子执行单元，实现一段、验收一段
2. **Inline Execution** - 我在当前会话按计划逐步实现并在关键点停下来让你验收

请选择 1 或 2。
