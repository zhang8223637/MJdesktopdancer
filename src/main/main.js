const { app, globalShortcut } = require('electron');

const { createMainWindow } = require('./windows/mainWindow');
const { createSettingsWindow } = require('./windows/settingsWindow');
const { registerIpc } = require('./ipc');
const { createTray } = require('./tray');
const { getStore } = require('./store');

let mainWindow = null;
let tray = null;

function applyMacOSBehavior() {
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
}

app.whenReady().then(() => {
  applyMacOSBehavior();

  const store = getStore();

  const openSettings = () => createSettingsWindow(store);

  mainWindow = createMainWindow(store, { openSettings });
  registerIpc({ store, getMainWindow: () => mainWindow, openSettings });
  tray = createTray({ store, getMainWindow: () => mainWindow, openSettings });

  globalShortcut.register('CommandOrControl+Shift+M', () => app.quit());
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  tray?.destroy();
});

