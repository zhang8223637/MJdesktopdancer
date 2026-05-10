const { BrowserWindow } = require('electron');
const path = require('path');

let settingsWindow = null;

function createSettingsWindow() {
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

