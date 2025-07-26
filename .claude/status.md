SPROCKETT SIDEKICK - COMPLETE HANDOFF DOCUMENTATION

  🎯 What The App Does

  Sprockett Sidekick is an AI-powered real-time conversation
  coaching application that listens to calls and provides
  intelligent suggestions to improve communication. Think of it
  as having a world-class communication coach whispering insights
   in your ear during important conversations.

  Core Features:

  1. Real-time Audio Transcription - Captures and transcribes
  conversation audio using OpenAI Whisper
  2. AI Coaching Suggestions - Provides contextual coaching
  insights every 15 seconds using GPT-4
  3. Conversation Analytics - Tracks warmth, energy,
  agreeability, and goal progress in real-time
  4. Speaker Identification - Uses physics-based audio routing
  (mic vs system audio) for accurate speaker detection
  5. User Authentication - Supabase-based auth system with
  email/password login
  6. Token System - Users start with 100 tokens (billing system
  ready but not implemented)

  User Flow:

  1. User creates account or signs in
  2. Selects conversation type (sales, interview, negotiation,
  etc.)
  3. Sets their goal for the conversation
  4. Clicks "Go Live" to start recording
  5. Receives real-time coaching suggestions based on
  conversation dynamics
  6. Views analytics dashboard showing conversation metrics

  🏗️ Architecture State

  Tech Stack:

  - Frontend: React + TypeScript + Vite
  - Backend: Node.js + Express (local development server)
  - Deployment: Vercel (serverless functions for production)
  - Database: Supabase (PostgreSQL)
  - AI Services: OpenAI (Whisper for transcription, GPT-4 for
  coaching)
  - Auth: Supabase Auth (email/password)
  - Styling: Vanilla CSS with custom design system

  Project Structure:

  /sprockett-sidekick
  ├── /src                    # React app source
  │   ├── /components        # React components
  │   │   ├── AuthHeader.tsx # Authentication UI in header
  │   │   ├── AuthModal.tsx  # Sign in/up modal
  │   │   └── ConfigPanel.tsx # Call configuration panel
  │   ├── /lib              # Core business logic
  │   │   ├── aiCoaching.ts     # AI coaching system
  │   │   ├── audioCapture.ts   # Legacy audio capture
  │   │   ├── dualAudioCapture.ts # Physics-based dual audio
  │   │   ├── config.ts         # App configuration
  │   │   ├── authContext.tsx   # Auth state management
  │   │   ├── useAuth.ts        # Auth functions hook
  │   │   └── supabaseClient.ts # Supabase initialization
  │   ├── App.tsx           # Main app component
  │   ├── main.tsx          # App entry point
  │   └── styles.css        # All styling
  ├── /api                  # Vercel serverless functions
  │   ├── coach.js         # AI coaching endpoint
  │   └── transcribe.js    # Audio transcription endpoint
  ├── /server              # Local dev server
  │   └── server.js        # Express server for local development
  ├── /migrations          # Database schema
  ├── /deprecated_client   # Old vanilla JS implementation
  └── package.json         # Dependencies and scripts

  Key Architectural Decisions:

  1. Dual Deployment Strategy:
    - Production: Vercel with serverless functions
    - Development: Local Express server on port 3002
    - React app auto-detects environment and routes accordingly
  2. Audio Architecture:
    - Two audio capture systems (switchable via config flag):
        - Legacy: Single microphone stream with AI speaker
  detection
      - Modern: Dual stream (mic + system audio) for
  physics-based speaker ID
    - Audio chunks: 8 seconds, with silence detection (< 1KB
  chunks skipped)
  3. AI Integration:
    - All OpenAI calls proxied through server (API keys never
  exposed)
    - Coaching runs every 15 seconds with 60-second context
  window
    - Streaming responses for real-time UI updates
  4. State Management:
    - React Context for auth state
    - Local component state for UI
    - localStorage for persistence (call config, goals)

  📋 What I Accomplished

  1. Fixed Whisper Hallucinations

  - Added silence detection to skip empty audio chunks
  - Audio blobs < 1KB are now filtered out before transcription
  - Prevents false transcriptions during quiet periods

  2. Complete Authentication System

  - Ported entire Supabase auth from deprecated client
  - Created React components: AuthHeader, AuthModal
  - Implemented auth context and hooks
  - Added protection requiring login for AI features
  - Preserved exact UI/UX from original (top-right auth links)

  3. Improved AI Coaching Prompt

  - Upgraded to elite-level coaching prompt
  - Better emotional intelligence and insight detection
  - Maintained backward compatibility with analytics parsing
  - Format: TEMP:X ENERGY:X AGREE:X GOAL:XX 🤖 [coaching text]

  4. Cost Analysis

  - Calculated ~$0.22 per 30-minute call with gpt-4o-mini
  - Currently using expensive gpt-4-turbo-preview (~$16/call)
  - Ready to switch models with one-line change

  5. Code Organization

  - Clean separation of concerns
  - Removed all WebRTC/video chat code
  - Maintained physics-based speaker identification
  - All "Oblivn" references removed

  🔌 Integration Points Ready

  Token/Billing System:

  - Database tables exist: user_accounts, token_transactions,
  token_packages
  - Users start with 100 tokens
  - Deduction logic not implemented yet
  - Token check endpoints ready to add

  Supabase Database Schema:

  -- user_accounts table
  user_id TEXT PRIMARY KEY
  email TEXT
  tokens_remaining INTEGER (default: 100)
  subscription_tier TEXT (default: 'free')
  created_at TIMESTAMP
  updated_at TIMESTAMP

  API Endpoints:

  - /api/transcribe - Audio → Text (Whisper)
  - /api/coach - Transcript → Coaching (GPT-4)
  - /api/renew-token - Token renewal (preserved for future)

  ⚠️ Important Notes

  1. API Keys: Currently using Gerry's OpenAI API key in
  production
  2. Model Cost: Switch to gpt-4o-mini ASAP to reduce costs 74x
  3. Token Deduction: Not implemented - users have unlimited
  usage after signup
  4. Rate Limiting: Basic rate limiting exists but no per-user
  quotas
  5. Dual Audio: Currently disabled by default (set
  USE_DUAL_AUDIO_CAPTURE: true in config.ts to enable)

  🚀 Next Steps Recommendations

  1. Immediate:
    - Switch AI model to gpt-4o-mini in /src/lib/aiCoaching.ts
  line 309
    - Implement token deduction after each coaching request
    - Add token balance display in UI
  2. Soon:
    - Implement token package purchases
    - Add usage analytics/tracking
    - Create admin dashboard
  3. Future:
    - Enable dual audio by default (better speaker detection)
    - Add conversation history/replay
    - Implement team features

  🔧 Development Commands

  # Install dependencies
  npm install

  # Run development server (includes API)
  npm run dev

  # Build for production
  npm run build

  # Deploy to Vercel
  npm run deploy

  # Local API server only
  npm start

  🌐 Deployment

  - Production: https://sprockett.app (Vercel)
  - API: Serverless functions at /api/*
  - Environment Variables Required:
    - OPENAI_API_KEY
    - ENABLE_TRANSCRIPTION (default: true)

  The app is fully functional with authenticated users able to
  use AI coaching. The foundation is solid and ready for
  monetization features.