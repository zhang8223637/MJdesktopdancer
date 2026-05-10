const { BrowserWindow, ipcMain, screen } = require('electron');
const fs = require('fs');
const path = require('path');

const { getConfig, getDefaults, setConfig } = require('./store');
const { ASSETS_DIR } = require('./paths');

function broadcastConfigChanged(patch) {
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) w.webContents.send('config:changed', { patch });
  });
}

function listAvatars() {
  if (!fs.existsSync(ASSETS_DIR)) return [];
  return fs
    .readdirSync(ASSETS_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.gif'))
    .map((e) => ({ fileName: e.name, displayName: e.name.replace(/\.gif$/i, '') }))
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
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

function registerIpc({ store, getMainWindow, openSettings }) {
  ipcMain.on('app:quit', () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.close();
  });

  ipcMain.on('settings:open', () => {
    openSettings?.();
  });

  ipcMain.on('window:resetPosition', () => {
    resetMainWindowPosition({ store, getMainWindow });
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
    if (Object.keys(nextPatch).length > 0) broadcastConfigChanged(nextPatch);
    return { ok: true, patch: nextPatch };
  });

  ipcMain.handle('avatar:list', () => ({ avatars: listAvatars() }));

  ipcMain.handle('path:assets', () => ({ assetsDir: ASSETS_DIR }));
}

module.exports = { registerIpc, resetMainWindowPosition, broadcastConfigChanged };

