// config.js
// Global configuration and state management for Oblivn video chat application
// This file defines the core application state, configuration, and DOM element references

// =============================================
// WEBRTC CONFIGURATION
// =============================================

/**
 * ICE servers for WebRTC NAT traversal
 * Populated dynamically from server API at runtime
 */
const iceServers = []; // Will be fetched from server

// =============================================
// SUPABASE CONFIGURATION
// =============================================

/**
 * Supabase client configuration
 * ✅ REAL CREDENTIALS - Connected to live Supabase project
 * Only include public-safe values (anon key is safe for client-side use)
 */
export const SUPABASE_URL = 'https://yfiinxqzzakcvyihujyf.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmaWlueHF6emFrY3Z5aWh1anlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NzUxNTgsImV4cCI6MjA2NDU1MTE1OH0.WKkhhhmx5j1FFEfM8lbQ-XUK_Pyluatcs9XfifP4_eM';

// =============================================
// ✨ PHASE III: TRANSCRIPTION API CONFIGURATION
// =============================================

/**
 * Transcription service configuration
 * Uses server-side proxy to keep API keys secure
 */
export const transcriptionConfig = {
    // Server-side proxy endpoint (keeps OpenAI API key secure)
    TRANSCRIPTION_API_URL: '/api/transcribe', // Will hit our server proxy
    TRANSCRIPTION_MODEL: 'whisper-1', // OpenAI Whisper model
    CHUNK_DURATION: 5000, // 5 seconds per audio chunk
    MAX_RETRIES: 3,
    FALLBACK_TO_SIMULATION: true, // Graceful fallback if API fails
    
    // Rate limiting
    MIN_INTERVAL_MS: 3000, // Don't transcribe more than every 3 seconds
    MAX_CHUNKS_PER_MINUTE: 20,
};

// =============================================
// USER STATE MANAGEMENT
// =============================================

/**
 * Global user state for token billing and session management
 * Now includes Supabase Auth integration for Sprint 2.5
 */
export const userState = {
    // Authentication state
    currentUserId: null, // Will be Supabase user.id (UUID) when authenticated
    isAuthenticated: false,
    userEmail: null,
    
    // ✨ Sprint 3 Phase 1: AI Assist state (host-only)
    aiAssistEnabled: false,
    aiPrompt: '',
    isHost: false, // Track if current user is the room host
    
    // ✨ Phase III: Transcription state
    transcriptionEnabled: false,
    lastTranscriptionTime: 0,
    transcriptionChunkCount: 0,
    
    // Legacy fallback for development/testing
    // Will be replaced with real auth UUIDs in production
};

// =============================================
// DOM ELEMENT REFERENCES
// =============================================

/**
 * DOM element references
 * Populated by the application during initialization
 * All major UI elements are referenced here for easy access
 */
let welcomeScreen, roomCreatedScreen, videoChatScreen, createRoomBtn, roomLinkInput, copyLinkBtn, localVideoPreview, localVideo, remoteVideo, localVideoContainer, toggleVideoBtn, toggleAudioBtn, toggleDevicesBtn, shareScreenBtn, endCallBtn, deviceSelection, videoSource, audioSource, audioOutput, messageElement, tutorialOverlay, tutorialCloseBtn, statusMessage, statusPopup, statusPopupMessage, statusPopupClose, previewVideoSource, previewToggleVideoBtn, previewToggleAudioBtn, previewShareScreenBtn;