# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sprockett is an AI-powered peer-to-peer video chat platform with real-time conversation coaching. It uses WebRTC for video/audio, Socket.io for signaling, and integrates OpenAI APIs for transcription and coaching features.

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (auto-restarts on changes)
npm run dev

# Run production server
npm start
```

## Architecture Overview

### Technology Stack
- **Frontend**: Vanilla JavaScript (no frameworks)
- **Backend**: Node.js + Express
- **Real-time**: Socket.io + WebRTC
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI (Whisper + GPT-4)

### Key Architectural Patterns

1. **Server Proxy for AI**: All OpenAI API calls go through server endpoints to keep API keys secure
2. **Modular Client Architecture**: Each feature is in its own module (connection.js, auth.js, aiCoach.js, etc.)
3. **Progressive Enhancement**: Core video chat works without AI; AI features layer on top
4. **No Build Process**: Direct serving of static files, no bundling or transpilation

### Project Structure

```
/client/           # Frontend JavaScript modules
  config.js        # Global state and configuration
  connection.js    # WebRTC connection management
  ui.js           # UI interactions and media controls
  auth.js         # Supabase authentication
  aiCoach.js      # Real-time conversation coaching
  transcription.js # Audio capture and transcription
  
/server/          
  server.js       # Express server with Socket.io and API endpoints

/migrations/      # Supabase database migrations
```

## Critical Development Guidelines

1. **No TypeScript/Build Tools**: This is vanilla JS. Don't add webpack, vite, or TypeScript.
2. **Server Proxy Pattern**: Never expose API keys to client. Always proxy through server.
3. **Existing Code First**: Check if functionality exists before creating new files/endpoints.
4. **Minimal Changes**: This is production code. Make surgical fixes, not rewrites.
5. **No Framework Migration**: Keep it vanilla JavaScript. Don't add React/Vue/etc.

## Key API Endpoints

- `POST /api/transcribe` - Proxy for OpenAI Whisper transcription
- `POST /api/coach` - Proxy for GPT-4 coaching suggestions
- Socket.io events: `offer`, `answer`, `ice-candidate` for WebRTC signaling

## AI Integration Flow

1. **Transcription**: Client records 5-second chunks → Server proxy → OpenAI Whisper → Client display
2. **Coaching**: Transcription buffer → Every 15 seconds → GPT-4 analysis → Streaming suggestions

## Database Tables (Supabase)

- `users` - User accounts and tokens
- `call_sessions` - Call history and analytics
- `user_presence` - Online status tracking

## Common Tasks

### Adding New AI Features
1. Create client module in `/client/`
2. Add server proxy endpoint in `server.js` if needed
3. Follow existing patterns from `aiCoach.js` or `transcription.js`

### Debugging WebRTC Issues
- Check browser console for ICE connection states
- Verify STUN/TURN servers in `connection.js`
- Test with `config.simulationMode = true` to bypass real connections

### Working with Supabase
- Client initialization in `supabaseClient.js`
- Auth flows in `auth.js`
- Database migrations in `/migrations/`

## Testing Approach

Currently no automated tests. Manual testing process:
1. Run `npm run dev`
2. Open two browser tabs
3. Test core video chat functionality
4. Enable AI features and verify transcription/coaching

## Security Considerations

- All API keys in `.env` (never commit)
- HTTPS required for WebRTC
- Rate limiting on AI endpoints
- No permanent storage of conversation data