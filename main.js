const { app, BrowserWindow, ipcMain, session, desktopCapturer } = require('electron');
const path = require('path');

let mainWindow;

// Start the Express server directly in packaged app
function startServer() {
  console.log('🚀 Starting server...', { isPackaged: app.isPackaged, isDev: process.env.NODE_ENV === 'development' });
  
  // Always run server in main process for packaged app
  const shouldRunInMainProcess = app.isPackaged || process.env.NODE_ENV !== 'development';
  
  if (shouldRunInMainProcess) {
    console.log('📦 Running server in main process (packaged mode)');
    // In packaged app, run server directly in main process
    process.env.ELECTRON_MODE = 'true';
    
    // Load environment variables for packaged app
    process.env.TOKEN_SECRET = 'dev_secret_for_testing_phase_iii';
    process.env.ENABLE_TRANSCRIPTION = 'true';
    process.env.PORT = '3002';
    process.env.OPENAI_API_KEY = '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';
    process.env.SUPABASE_URL = 'https://yfiinxqzzakcvyihujyf.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmaWlueHF6emFrY3Z5aWh1anlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NzUxNTgsImV4cCI6MjA2NDU1MTE1OH0.WKkhhhmx5j1FFEfM8lbQ-XUK_Pyluatcs9XfifP4_eM';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmaWlueHF6emFrY3Z5aWh1anlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODk3NTE1OCwiZXhwIjoyMDY0NTUxMTU4fQ.1ibR36ur9wYgUk8h-iXmhHYtm0-wuoTdXeOI-heJcnM';
    process.env.TURN_USERNAME = '8338b02f31fdf7e396cb02e1';
    process.env.TURN_CREDENTIAL = 'rDrG6uOD6FHaAqBH';
    
    try {
      require('./server/server.js');
      console.log('✅ Server started successfully in main process');
    } catch (error) {
      console.error('❌ Failed to start server in main process:', error);
    }
  } else {
    console.log('🔧 Running server in separate process (development mode)');
    // In development, spawn separate process  
    const { spawn } = require('child_process');
    const serverProcess = spawn('node', ['server/server.js'], {
      env: { ...process.env, ELECTRON_MODE: 'true' }
    });
    
    serverProcess.stdout.on('data', (data) => {
      console.log(`Server: ${data}`);
    });
    
    serverProcess.stderr.on('data', (data) => {
      console.error(`Server Error: ${data}`);
    });
    
    app.on('window-all-closed', () => {
      if (serverProcess) {
        serverProcess.kill();
      }
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
  }
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
    mainWindow.loadFile('dist/index.html');
    
    // Enable DevTools with Cmd+Option+I
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.meta && input.alt && input.key.toLowerCase() === 'i') {
        mainWindow.webContents.openDevTools();
      }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Set up permission handler for system audio capture
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      // Allow media permissions - user will be prompted by system
      callback(true);
    } else {
      callback(false);
    }
  });

  startServer();
  setTimeout(createWindow, 1000); // Give server time to start
});

app.on('window-all-closed', () => {
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

// Handle desktop sources for system audio capture
ipcMain.handle('get-desktop-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({ 
      types: ['screen', 'window'],
      fetchWindowIcons: false 
    });
    return sources;
  } catch (error) {
    console.error('Failed to get desktop sources:', error);
    return [];
  }
});

// Handle system audio permission request
ipcMain.handle('request-system-audio-permission', async () => {
  if (process.platform === 'darwin') {
    const { systemPreferences } = require('electron');
    
    // Check screen recording permission (required for system audio)
    const screenStatus = systemPreferences.getMediaAccessStatus('screen');
    
    if (screenStatus === 'not-determined') {
      // macOS will automatically prompt when getDisplayMedia is called
      return 'prompt-required';
    }
    
    return screenStatus === 'granted' ? 'granted' : 'denied';
  }
  return 'granted';
});