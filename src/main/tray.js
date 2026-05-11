const { Menu, Tray, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const { ASSETS_DIR } = require('./paths');
const { broadcastConfigChanged, resetMainWindowPosition } = require('./ipc');

function listAvatarFileNames() {
  if (!fs.existsSync(ASSETS_DIR)) return [];
  return fs
    .readdirSync(ASSETS_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.gif'))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

function resolveTrayIcon() {
  const iconPath = path.join(ASSETS_DIR, 'trayTemplate.png');
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  if (process.platform === 'darwin') icon.setTemplateImage(true);
  return icon;
}

function createTray({ store, getMainWindow, openSettings }) {
  const tray = new Tray(resolveTrayIcon());
  tray.setToolTip('MJ Desktop Dancer');

  const rebuildMenu = () => {
    const selected = store.get('selectedAvatar');
    const avatars = listAvatarFileNames();

    const avatarSubmenu = avatars.length
      ? avatars.map((fileName) => ({
          label: fileName,
          type: 'radio',
          checked: fileName === selected,
          click: () => {
            store.set('selectedAvatar', fileName);
            broadcastConfigChanged({ selectedAvatar: fileName });
            tray.setContextMenu(rebuildMenu());
          }
        }))
      : [{ label: '未找到 GIF（assets/*.gif）', enabled: false }];

    const mouseThrough = Boolean(store.get('mouseThrough'));

    return Menu.buildFromTemplate([
      { label: 'MJ Desktop Dancer', enabled: false },
      { type: 'separator' },
      { label: '打开设置', click: () => openSettings?.() },
      { label: '形象', submenu: avatarSubmenu },
      { type: 'separator' },
      {
        label: mouseThrough ? '✓ 鼠标穿透' : '鼠标穿透',
        click: () => {
          const next = !Boolean(store.get('mouseThrough'));
          store.set('mouseThrough', next);
          const win = getMainWindow?.();
          if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(next, { forward: true });
          tray.setContextMenu(rebuildMenu());
        }
      },
      { label: '重置位置', click: () => resetMainWindowPosition({ store, getMainWindow }) },
      { type: 'separator' },
      { label: '退出', click: () => require('electron').app.quit() }
    ]);
  };

  tray.setContextMenu(rebuildMenu());

  store.onDidChange('mouseThrough', () => tray.setContextMenu(rebuildMenu()));
  store.onDidChange('selectedAvatar', () => tray.setContextMenu(rebuildMenu()));

  tray.on('click', () => {
    const win = getMainWindow?.();
    if (win && !win.isDestroyed()) win.show();
  });

  return tray;
}

module.exports = { createTray };

