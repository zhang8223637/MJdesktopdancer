const { app } = require('electron');

const { resetMainWindowPosition } = require('./ipc');

function buildMenuTemplate({ store, getMainWindow, openSettings }) {
  const mouseThrough = Boolean(store.get('mouseThrough'));

  return [
    { label: '打开设置', click: () => openSettings?.() },
    { type: 'separator' },
    {
      label: mouseThrough ? '✓ 鼠标穿透' : '鼠标穿透',
      click: () => {
        const next = !Boolean(store.get('mouseThrough'));
        store.set('mouseThrough', next);
        const win = getMainWindow?.();
        if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(next, { forward: true });
      }
    },
    {
      label: '重置位置',
      click: () => resetMainWindowPosition({ store, getMainWindow })
    },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ];
}

module.exports = { buildMenuTemplate };

