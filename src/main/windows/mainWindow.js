const { BrowserWindow, Menu } = require('electron');
const path = require('path');

const { buildMenuTemplate } = require('../uiMenu');
const { ASSETS_DIR } = require('../paths');

function createMainWindow(store, { openSettings }) {
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

  store.onDidChange('mouseThrough', applyMouseThrough);

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
    const menu = Menu.buildFromTemplate(buildMenuTemplate({ store, getMainWindow: () => win, openSettings }));
    menu.popup({ window: win });
  });

  return win;
}

module.exports = { createMainWindow, ASSETS_DIR };

