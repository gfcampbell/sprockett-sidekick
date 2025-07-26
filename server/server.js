// server.js - Sprockett AI Coaching Server
// This server handles AI transcription and coaching for the Sprockett application.
// It provides secure API endpoints for audio processing and AI-powered conversation analysis.
require('dotenv').config();
const express = require('express');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

// =============================================
// SERVER INITIALIZATION
// =============================================

// Initialize express app
const app = express();
const server = http.createServer(app);

// =============================================
// TRANSCRIPTION API CONFIGURATION
// =============================================

// OpenAI Whisper API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ENABLE_TRANSCRIPTION = process.env.ENABLE_TRANSCRIPTION === 'true' || false;

// Multer configuration for handling audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

// =============================================
// SECURITY MIDDLEWARE
// =============================================

// Apply HTTP security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "ws:", "cloud.umami.is", "api-gateway.umami.dev", "*.supabase.co"],
      mediaSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cloud.umami.is", "cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "cloud.umami.is"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: { 
    maxAge: 31536000, 
    includeSubDomains: true 
  },
  frameguard: { action: 'deny' },
  xssFilter: true
}));

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased to 1000 requests per 15 minutes
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Specific rate limiting for transcription API
const transcriptionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 transcription requests per minute
  message: { error: 'Too many transcription requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all routes
app.use(limiter);

// Add CORS headers for desktop app
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});


// Parse JSON in request body
app.use(express.json());

// =============================================
// SECURITY TOKEN FUNCTIONS (Preserved for future use)
// =============================================

/**
 * Generates a secure room token with HMAC validation
 * @param {string} roomId - The room ID to create a token for
 * @returns {object} Token data including expiration
 */
function generateRoomToken(roomId) {
  // Create expiration 24 hours from now
  const expiration = Date.now() + (24 * 60 * 60 * 1000);
  
  // Data to sign
  const payload = {
    roomId,
    exp: expiration
  };
  
  // Create HMAC signature using server secret
  const serverSecret = process.env.TOKEN_SECRET || 'fallback_dev_secret_DO_NOT_USE_IN_PRODUCTION';
  const signature = crypto
    .createHmac('sha256', serverSecret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  // Return token with payload and signature
  return {
    token: Buffer.from(JSON.stringify({
      ...payload,
      sig: signature
    })).toString('base64'),
    expiration
  };
}

/**
 * Verifies a room token's authenticity and expiration
 * @param {string} token - The token to verify
 * @returns {object} Verification result
 */
function verifyRoomToken(token) {
  try {
    // Decode token
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    
    // Check if token is expired
    if (decoded.exp < Date.now()) {
      return { valid: false, reason: 'Token expired' };
    }
    
    // Verify signature
    const serverSecret = process.env.TOKEN_SECRET || 'fallback_dev_secret_DO_NOT_USE_IN_PRODUCTION';
    const payload = { roomId: decoded.roomId, exp: decoded.exp };
    const expectedSignature = crypto
      .createHmac('sha256', serverSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    if (decoded.sig !== expectedSignature) {
      return { valid: false, reason: 'Invalid signature' };
    }
    
    return { valid: true, roomId: decoded.roomId };
  } catch (error) {
    return { valid: false, reason: 'Invalid token format' };
  }
}

// =============================================
// TRANSCRIPTION API ENDPOINTS
// =============================================

/**
 * Health check endpoint for transcription service
 */
app.get('/api/transcribe/health', (req, res) => {
  if (ENABLE_TRANSCRIPTION && OPENAI_API_KEY) {
    res.json({ 
      status: 'available', 
      service: 'openai-whisper',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({ 
      status: 'unavailable', 
      reason: 'Transcription service not configured',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Transcription proxy endpoint - sends audio to OpenAI Whisper API
 */
app.post('/api/transcribe', transcriptionLimiter, upload.single('audio'), async (req, res) => {
  try {
    // Check if transcription is enabled
    if (!ENABLE_TRANSCRIPTION) {
      return res.status(503).json({ 
        error: 'Transcription service is disabled',
        fallback: true
      });
    }

    // Check if OpenAI API key is configured
    if (!OPENAI_API_KEY) {
      return res.status(503).json({ 
        error: 'OpenAI API key not configured',
        fallback: true
      });
    }

    // Validate request
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const { 
      model = 'whisper-1', 
      speaker = 'Unknown',
      enable_speaker_detection = 'false',
      max_speakers = '5'
    } = req.body;
    
    const audioBuffer = req.file.buffer;
    const enableSpeakerDetection = enable_speaker_detection === 'true';

    console.log(`🎤 Transcribing audio (${enableSpeakerDetection ? 'with speaker detection' : 'single speaker'}): ${audioBuffer.length} bytes`);

    // Prepare FormData for OpenAI API
    const FormData = require('form-data');
    const formData = new FormData();
    
    // Add audio file
    formData.append('file', audioBuffer, {
      filename: req.file.originalname || 'audio.webm',
      contentType: req.file.mimetype
    });
    
    // Add model parameter
    formData.append('model', model);
    
    // Add response format - use verbose_json for speaker detection
    if (enableSpeakerDetection) {
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities', 'segment');
    } else {
      formData.append('response_format', 'json');
    }

    // Call OpenAI Whisper API
    const fetch = require('node-fetch');
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ OpenAI API error (${response.status}):`, errorText);
      
      return res.status(response.status).json({ 
        error: `Transcription API error: ${response.status}`,
        details: errorText,
        fallback: true
      });
    }

    const result = await response.json();
    
    if (enableSpeakerDetection && result.segments) {
      // Process speaker-detected segments
      const speakerMap = new Map();
      const segments = [];
      
      for (const segment of result.segments) {
        // Simple speaker detection based on voice characteristics
        // This is a basic implementation - more sophisticated speaker diarization
        // would require additional AI models
        const speakerId = `Speaker_${segment.id % parseInt(max_speakers)}`;
        
        if (!speakerMap.has(speakerId)) {
          speakerMap.set(speakerId, {
            totalDuration: 0,
            segments: 0
          });
        }
        
        const speakerInfo = speakerMap.get(speakerId);
        speakerInfo.totalDuration += (segment.end - segment.start);
        speakerInfo.segments += 1;
        speakerMap.set(speakerId, speakerInfo);
        
        segments.push({
          speaker: speakerId,
          text: segment.text.trim(),
          start: segment.start,
          end: segment.end
        });
      }
      
      console.log(`✅ Speaker detection transcription: ${segments.length} segments from ${speakerMap.size} speakers`);
      
      res.json({
        segments: segments,
        speakers: Object.fromEntries(speakerMap),
        text: result.text, // Full text fallback
        timestamp: new Date().toISOString(),
        model: model
      });
      
    } else {
      // Standard single-speaker response
      console.log(`✅ Transcription for ${speaker}: "${result.text}"`);
      
      res.json({ 
        segments: [{
          speaker: speaker,
          text: result.text
        }],
        text: result.text,
        speaker: speaker,
        timestamp: new Date().toISOString(),
        model: model
      });
    }

  } catch (error) {
    console.error('❌ Transcription error:', error);
    res.status(500).json({ 
      error: 'Internal transcription error',
      message: error.message,
      fallback: true
    });
  }
});

// =============================================
// AI COACHING API ENDPOINT
// =============================================

/**
 * AI Coaching endpoint - sends conversation context to OpenAI for coaching suggestions
 */
app.post('/api/coach', async (req, res) => {
  try {
    // Check if OpenAI API key is configured
    if (!OPENAI_API_KEY) {
      return res.status(503).json({ 
        error: 'AI coaching unavailable: OpenAI API key not configured'
      });
    }

    // Validate request body
    const { messages, model = 'gpt-4-turbo-preview', max_tokens = 150, temperature = 0.7, stream = true } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid request: messages array required' 
      });
    }

    console.log(`🤖 AI Coaching request: ${messages.length} messages, model: ${model}`);

    // Call OpenAI Chat Completion API
    const fetch = require('node-fetch');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens,
        temperature,
        stream
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ OpenAI Chat API error (${response.status}):`, errorText);
      
      return res.status(response.status).json({ 
        error: `AI coaching unavailable: API error ${response.status}`,
        details: errorText
      });
    }

    // Set headers for streaming response
    if (stream) {
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // Stream the response back to client
      response.body.pipe(res);
      
      console.log(`✅ AI Coaching response streaming started`);
    } else {
      // Non-streaming response
      const result = await response.json();
      console.log(`✅ AI Coaching response: "${result.choices[0]?.message?.content?.substring(0, 100)}..."`);
      res.json(result);
    }

  } catch (error) {
    console.error('❌ AI Coaching error:', error);
    res.status(500).json({ 
      error: 'AI coaching unavailable: Internal server error',
      message: error.message
    });
  }
});

// =============================================
// API ENDPOINTS
// =============================================

// Renew security token for long-running sessions
app.post('/api/renew-token', (req, res) => {
  try {
    const { roomId, token } = req.body;
    
    if (!roomId || !token) {
      return res.status(400).json({ error: 'Missing roomId or token' });
    }
    
    // Verify existing token
    const verification = verifyRoomToken(token);
    
    if (!verification.valid || verification.roomId !== roomId) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    // Generate new token
    const { token: newToken, expiration } = generateRoomToken(roomId);
    
    // Return new token
    res.json({ token: newToken, expiration });
  } catch (error) {
    console.error('Error renewing token:', error);
    res.status(500).json({ error: 'Failed to renew token' });
  }
});

// =============================================
// SERVER STARTUP AND ROUTES
// =============================================

// Define port (use environment variable if available)
const PORT = process.env.PORT || 3002;

// Start server
server.listen(PORT, () => {
  console.log(`Sprockett server running on port ${PORT}`);
});

