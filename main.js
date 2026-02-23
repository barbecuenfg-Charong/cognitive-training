const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false // For simple HTML/JS apps without a preload script, this is easier, though less secure. Since this is a local app, it's acceptable.
    },
    icon: path.join(__dirname, 'icon.png') // Optional: add an icon if available, but for now we'll skip or use default
  });

  win.loadFile('index.html');
  
  // Remove menu bar for a cleaner look
  win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
