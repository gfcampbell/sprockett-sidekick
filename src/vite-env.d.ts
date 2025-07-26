/// <reference types="vite/client" />

declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.jpg' {
  const value: string;
  export default value;
}

declare module '*.jpeg' {
  const value: string;
  export default value;
}

declare module '*.gif' {
  const value: string;
  export default value;
}

declare module '*.svg' {
  const value: string;
  export default value;
}

// Electron API types
interface ElectronAPI {
  requestMediaAccess: () => Promise<boolean>;
  requestSystemAudioPermission: () => Promise<'granted' | 'denied' | 'prompt-required'>;
  getDesktopSources: () => Promise<any[]>;
  startAudioCapture: () => Promise<void>;
  stopAudioCapture: () => Promise<void>;
  transcribeAudio: (audioData: any) => Promise<any>;
  getCoachingSuggestions: (context: any) => Promise<any>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}