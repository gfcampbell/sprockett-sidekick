/**
 * Desktop App Configuration
 * Adapted from original Sprockett config.js
 */

// Determine if we're in development or production
const isDevelopment = typeof window !== 'undefined' ? 
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' :
  false;

// In Electron app, always use localhost for API calls
const isElectron = typeof window !== 'undefined' && window.location.protocol === 'file:';
const baseUrl = (isDevelopment || isElectron) ? 'http://localhost:3002' : '';

export const transcriptionConfig = {
  // Server proxy endpoint
  transcriptionApiUrl: `${baseUrl}/api/transcribe`,
  transcriptionModel: 'whisper-1',
  chunkDuration: 8000, // 8 seconds per audio chunk (longer to avoid cutting sentences)
  minInterval: 1000, // Minimum 1 second between transcriptions
  maxChunksPerMinute: 1000, // Effectively unlimited
  maxRetries: 3,
  fallbackToSimulation: true,
};

export const coachingConfig = {
  // Server proxy endpoint for AI coaching
  COACHING_API_URL: `${baseUrl}/api/coach`,
  COACHING_INTERVAL: 15000, // 15 seconds between coaching suggestions
  CONTEXT_WINDOW_DURATION: 60000, // 60 seconds of context
  MAX_TRANSCRIPT_ENTRIES: 100, // Keep last 100 transcript entries
};

export const appConfig = {
  SERVER_URL: baseUrl,
  DEFAULT_USE_CASE: 'general_conversation',
  AUTO_SCROLL_TRANSCRIPT: true,
  MAX_SUGGESTIONS: 5,
};

// 🏥 SURGICAL FLAG: Audio Source Truth Operation
export const surgicalFlags = {
  // Phase 3: HEART TRANSPLANT - Keep dual audio system available but default to single stream
  USE_DUAL_AUDIO_CAPTURE: false, // Default to single stream for easier UX
  
  // Development helpers
  ENABLE_AUDIO_DEBUG_LOGS: isDevelopment,
  // Enable fallback - allows app to work immediately without permissions
  ALLOW_FALLBACK_TO_SINGLE_STREAM: true,
};