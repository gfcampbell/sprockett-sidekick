# 🤖 Sprint 4.1: Real-Time AI Coaching System

## Overview
Sprint 4.1 transforms Sprockett from reactive AI assistance to **intelligent, context-aware conversation coaching** powered by OpenAI's GPT models.

## 🎯 What's New

### **Real-Time Conversation Analysis**
- Captures rolling 60-second transcript from both Host and Visitor
- Combines conversation context with user's goals and use case
- Sends intelligent coaching requests every 15 seconds
- Streams AI suggestions directly to host's coaching panel

### **Intelligent Prompt Engineering**
- Uses Sprint 4.0's call configuration (goal, use case, context)
- Builds enhanced system prompts for specialized coaching
- Formats conversation with speaker labels for AI analysis
- Requests specific, actionable coaching suggestions

### **Secure Server Integration**
- New `/api/coach` endpoint on existing Express server
- Proxies OpenAI Chat Completion API with API key protection
- Streams responses back to client for real-time display
- Rate-limited to prevent abuse

## 🏗️ Architecture

### **Client-Side Components**

#### `aiCoach.js` - Core Coaching Engine
- `startAICoaching()` - Initiates periodic coaching requests
- `buildCoachingPrompt()` - Combines context + transcript into AI prompt
- `sendToCoachAPI()` - Streams suggestions from server
- `addToTranscriptBuffer()` - Captures conversation for analysis

#### `aiAssist.js` - Integration Layer
- Updated to start/stop real AI coaching instead of mock suggestions
- Integrates transcript buffer with existing transcription system
- Enhanced cleanup and state management

#### `connection.js` - State Management
- Added `transcriptBuffer` array to global state
- Stores conversation with speaker labels and timestamps
- Automatically managed (keeps last 100 entries)

### **Server-Side Components**

#### `server.js` - API Endpoint
- `POST /api/coach` - Handles coaching requests
- Validates OpenAI API key configuration
- Streams OpenAI Chat Completion responses
- Comprehensive error handling

## 🚀 Setup Instructions

### **1. Environment Configuration**
Add to your server `.env` file:
```env
OPENAI_API_KEY=sk-your-openai-api-key-here
ENABLE_TRANSCRIPTION=true
```

### **2. Server Requirements**
- Node.js server with existing dependencies (already configured)
- `node-fetch` for OpenAI API calls (already installed)
- Express rate limiting (already configured)

### **3. Usage Flow**
1. Host creates room and configures call (goal, use case, context)
2. Host enables AI coaching in waiting room
3. Visitor joins call
4. Real-time transcription populates transcript buffer
5. AI coaching system sends periodic requests to OpenAI
6. Coaching suggestions stream back to host's panel

## 🧪 Testing

### **Development Testing**
```javascript
// In browser console (when AI assist is enabled):
testTranscriptBuffer()
```

This populates the transcript buffer with sample conversation data to test the AI coaching system without needing real conversation.

### **Production Testing**
1. Configure OpenAI API key in server environment
2. Create room with AI coaching enabled
3. Set a specific goal (e.g., "Close this sales deal")
4. Select appropriate use case (e.g., "Close More Deals")
5. Start conversation with another participant
6. Watch for AI coaching suggestions in the coaching panel

## 🎨 UI Components

### **Coaching Suggestions**
- Green gradient background with coaching icon
- Timestamp for each suggestion
- Clear distinction from transcript messages
- Auto-scrolling and message limit (10 recent suggestions)

### **Error Handling**
- Red error messages for API failures
- Inline display in AI output panel
- No fallback to simulation (clean error states)

## 🔧 Configuration

### **Coaching Parameters** (in `aiCoach.js`)
```javascript
const COACHING_CONFIG = {
    INTERVAL_MS: 15000,           // Request frequency
    TRANSCRIPT_WINDOW_MS: 60000,  // Conversation context window
    MAX_TRANSCRIPT_CHARS: 2000    // Character limit for API efficiency
};
```

### **AI Model Settings**
- **Model**: `gpt-4-turbo-preview` (configurable)
- **Max Tokens**: 150 (concise suggestions)
- **Temperature**: 0.7 (balanced creativity/consistency)
- **Streaming**: Enabled for real-time display

## 🛡️ Security & Performance

### **Rate Limiting**
- Reuses existing transcription rate limiter
- 20 requests per minute per IP
- Prevents API abuse

### **API Key Protection**
- Server-side proxy prevents client exposure
- Environment-based configuration
- Graceful degradation when unconfigured

### **Error Handling**
- Comprehensive error states for all failure modes
- Clear user messaging for configuration issues
- No fallback to mock data (maintains trust)

## 🎉 Result

Sprockett now provides **intelligent, real-time conversation coaching** that:
- ✅ Understands conversation context and user goals
- ✅ Provides actionable, specific coaching suggestions
- ✅ Adapts to different conversation types (sales, interviews, negotiations)
- ✅ Maintains privacy and security
- ✅ Streams suggestions in real-time without interrupting flow

This transforms Sprockett from a video calling tool into a true **AI-powered conversation intelligence platform**. 