/**
 * Desktop App Configuration
 * Adapted from original Sprockett config.js
 */

export const transcriptionConfig = {
  // Server proxy endpoint (running on localhost:3002)
  transcriptionApiUrl: 'http://localhost:3002/api/transcribe',
  transcriptionModel: 'whisper-1',
  chunkDuration: 8000, // 8 seconds per audio chunk (longer to avoid cutting sentences)
  minInterval: 1000, // Minimum 1 second between transcriptions
  maxChunksPerMinute: 1000, // Effectively unlimited
  maxRetries: 3,
  fallbackToSimulation: true,
};

export const coachingConfig = {
  // Server proxy endpoint for AI coaching
  COACHING_API_URL: 'http://localhost:3002/api/coach',
  COACHING_INTERVAL: 15000, // 15 seconds between coaching suggestions
  CONTEXT_WINDOW_DURATION: 60000, // 60 seconds of context
  MAX_TRANSCRIPT_ENTRIES: 100, // Keep last 100 transcript entries
};

export const appConfig = {
  SERVER_URL: 'http://localhost:3002',
  DEFAULT_USE_CASE: 'general_conversation',
  AUTO_SCROLL_TRANSCRIPT: true,
  MAX_SUGGESTIONS: 5,
};