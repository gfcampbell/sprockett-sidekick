# 🎤 Sprockett Phase III: Real-Time Transcription Setup

## ✅ Phase III Implementation Complete!

Phase III adds real-time transcription via OpenAI Whisper API with the following features:

- ✅ Real transcription for both Host and Visitor audio streams
- ✅ Server-side proxy to keep API keys secure  
- ✅ Graceful fallback to simulation when API unavailable
- ✅ Rate limiting and error handling
- ✅ Enhanced UI with speaker labels and timestamps

---

## 🔧 Environment Variables

Add these to your server environment (`.env` file or deployment platform):

```bash
# ✨ Phase III: Transcription Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
ENABLE_TRANSCRIPTION=true

# Existing variables (if any)
TOKEN_SECRET=your-secure-token-secret
PORT=3000
```

### Required Variables:

- **`OPENAI_API_KEY`**: Your OpenAI API key for Whisper transcription
- **`ENABLE_TRANSCRIPTION`**: Set to `true` to enable real transcription

### How to get OpenAI API Key:

1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy and add to your environment variables

---

## 🚀 Deployment Steps

### 1. Install New Dependencies

```bash
cd server
npm install multer form-data node-fetch
```

### 2. Set Environment Variables

**On Render.com:**
1. Go to your service dashboard
2. Environment → Add Environment Variable
3. Add `OPENAI_API_KEY` and `ENABLE_TRANSCRIPTION=true`

**Local Development:**
```bash
# Create .env file in root directory
echo "OPENAI_API_KEY=sk-your-key-here" >> .env
echo "ENABLE_TRANSCRIPTION=true" >> .env
```

### 3. Deploy

The server will automatically:
- ✅ Check transcription availability at `/api/transcribe/health`
- ✅ Use real transcription if configured
- ✅ Fall back to simulation if not configured

---

## 🎯 How It Works

### Client-Side (Browser):
1. **Audio Capture**: MediaRecorder captures 5-second chunks
2. **Smart Upload**: Only sends audio chunks > 1KB (skips silence)
3. **Rate Limiting**: Max 20 requests per minute per user
4. **Fallback**: Automatically switches to simulation if API fails

### Server-Side (Node.js):
1. **Proxy Endpoint**: `/api/transcribe` receives audio files
2. **Security**: API keys never exposed to browser
3. **Validation**: Checks file types and size limits
4. **OpenAI Integration**: Forwards to Whisper API securely

### Real-Time Flow:
```
Host Audio ──┐
             ├─→ MediaRecorder ─→ Server Proxy ─→ OpenAI Whisper ─→ Display
Visitor Audio ┘
```

---

## 🧪 Testing

### Test Transcription Service:
```bash
curl https://your-app.com/api/transcribe/health
```

**Expected Response (Service Available):**
```json
{
  "status": "available",
  "service": "openai-whisper",
  "timestamp": "2024-01-20T12:00:00.000Z"
}
```

**Expected Response (Service Unavailable):**
```json
{
  "status": "unavailable", 
  "reason": "Transcription service not configured",
  "timestamp": "2024-01-20T12:00:00.000Z"
}
```

### Verify in Browser:
1. Create a room as Host
2. Enable AI Assist toggle
3. Speak into microphone
4. Look for transcription messages like:
   - `🎙️ Host: "Hello, this is a test"`
   - `👤 Visitor: "I can hear you clearly"`

---

## 🛡️ Security & Privacy

- ✅ **API Keys**: Stored server-side only, never exposed to browser
- ✅ **Rate Limiting**: 20 transcription requests per minute per IP
- ✅ **File Validation**: Only audio files accepted, 10MB limit
- ✅ **No Storage**: Audio files processed in memory, not stored
- ✅ **Graceful Fallback**: Simulation mode if real transcription fails

---

## 🔄 Fallback Behavior

If transcription fails or is unavailable:
1. **Automatic Detection**: Health check on app start
2. **Graceful Degradation**: Switches to simulation mode
3. **User Notification**: Shows "(simulated)" in transcript messages
4. **No Interruption**: AI Assist continues to work normally

---

## 🚀 Next Steps: Phase IV

Phase III is complete! Ready for **Phase IV: Prompt-Driven AI Suggestions**:

- Feed rolling transcripts to AI models
- Generate contextual coaching suggestions
- Real-time conversation analysis
- Custom prompt-driven insights

---

## 🐛 Troubleshooting

### "Transcription service unavailable"
- Check `OPENAI_API_KEY` is set correctly
- Verify `ENABLE_TRANSCRIPTION=true`
- Test API key with curl: `curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models`

### No transcription messages appearing
- Check browser console for errors
- Verify microphone permissions granted
- Test with `/api/transcribe/health` endpoint

### Rate limiting errors
- Default: 20 requests per minute per IP
- Adjust in `server.js` transcriptionLimiter if needed
- Consider upgrading OpenAI plan for higher limits 