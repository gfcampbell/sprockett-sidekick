const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

// Start the Express server
function startServer() {
  serverProcess = spawn('node', ['server/server.js'], {
    env: { ...process.env, ELECTRON_MODE: 'true' }
  });
  
  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`);
  });
  
  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset', // Keeps traffic lights visible on macOS
    trafficLightPosition: { x: 20, y: 20 }, // Position traffic lights
    vibrancy: 'under-window',
    visualEffectState: 'active'
  });

  // In development, load from Vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load built files
    mainWindow.loadFile('desktop-app/dist/index.html');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startServer();
  setTimeout(createWindow, 1000); // Give server time to start
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle audio permissions for macOS
ipcMain.handle('request-media-access', async () => {
  if (process.platform === 'darwin') {
    const { systemPreferences } = require('electron');
    const status = systemPreferences.getMediaAccessStatus('microphone');
    
    if (status === 'not-determined') {
      const granted = await systemPreferences.askForMediaAccess('microphone');
      return granted;
    }
    
    return status === 'granted';
  }
  return true;
});

// Desktop capture removed - using voice print detection instead