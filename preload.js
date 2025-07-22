const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  requestMediaAccess: () => ipcRenderer.invoke('request-media-access'),
  
  // Desktop capture for system audio
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  
  // Audio capture methods
  startAudioCapture: () => ipcRenderer.invoke('start-audio-capture'),
  stopAudioCapture: () => ipcRenderer.invoke('stop-audio-capture'),
  
  // Server communication
  transcribeAudio: (audioData) => ipcRenderer.invoke('transcribe-audio', audioData),
  getCoachingSuggestions: (context) => ipcRenderer.invoke('get-coaching-suggestions', context),
});