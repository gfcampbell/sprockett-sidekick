// server.js - WebRTC Video Chat Signaling Server
// This server handles WebRTC signaling between peers for the Oblivn private video chat application.
// It manages room creation, peer connections, and WebRTC signaling exchange.
require('dotenv').config();
const express = require('express');
const http = require('node:http');
const path = require('node:path');
const { Server } = require('socket.io');
const crypto = require('node:crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

// =============================================
// SERVER INITIALIZATION
// =============================================

// Initialize express app (only once)
const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS configuration
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// =============================================
// TRANSCRIPTION API CONFIGURATION
// =============================================

// ✨ Phase III: OpenAI Whisper API configuration
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
  max: 1000, // Increased to 1000 requests per 15 minutes (more reasonable for development)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// ✨ Phase III: Specific rate limiting for transcription API
const transcriptionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 transcription requests per minute
  message: { error: 'Too many transcription requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all routes (but with generous limits)
app.use(limiter);

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Parse JSON in request body
app.use(express.json());

// =============================================
// ✨ PHASE III: TRANSCRIPTION API ENDPOINTS
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

    const { model = 'whisper-1', speaker = 'Unknown' } = req.body;
    const audioBuffer = req.file.buffer;

    console.log(`🎤 Transcribing audio for ${speaker}: ${audioBuffer.length} bytes`);

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
    
    // Optional: Add response format
    formData.append('response_format', 'json');

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
    
    // Log successful transcription
    console.log(`✅ Transcription for ${speaker}: "${result.text}"`);

    // Return transcribed text
    res.json({ 
      text: result.text,
      speaker: speaker,
      timestamp: new Date().toISOString(),
      model: model
    });

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
// ✨ SPRINT 4.1: AI COACHING API ENDPOINT
// =============================================

/**
 * AI Coaching endpoint - sends conversation context to OpenAI for coaching suggestions
 */
app.post('/api/coach', transcriptionLimiter, async (req, res) => {
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
// SECURITY TOKEN FUNCTIONS
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
// ROOM MANAGEMENT
// =============================================

// Track active rooms and their participants
const rooms = new Map();

/**
 * Generates a cryptographically secure room ID
 * @returns {string} Hexadecimal room identifier
 */
function generateRoomId() {
  return crypto.randomBytes(8).toString('hex');
}

// =============================================
// SOCKET.IO EVENT HANDLERS
// =============================================

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Create new room
  socket.on('create-room', () => {
    try {
      const roomId = generateRoomId();
      const { token, expiration } = generateRoomToken(roomId);
      
      rooms.set(roomId, {
        creator: socket.id,
        participants: [socket.id],
        created: Date.now(),
        token
      });

      socket.join(roomId);
      socket.emit('room-created', { roomId, token, expiration });
      console.log(`Room created: ${roomId} by ${socket.id}`);
    } catch (error) {
      console.error(`Error creating room for ${socket.id}:`, error);
      socket.emit('error', { message: `Failed to create room: ${error.message}` });
    }
  });

  // Join existing room
  socket.on('join-room', ({ roomId, token }) => {
    try {
      // First verify token if provided
      if (token) {
        const verification = verifyRoomToken(token);
        if (!verification.valid) {
          console.log(`Invalid token for room ${roomId}: ${verification.reason}`);
          socket.emit('error', { message: `Invalid room token: ${verification.reason}` });
          return;
        }
        
        // Verify roomId matches token
        if (verification.roomId !== roomId) {
          console.log(`Token doesn't match room ID: ${roomId}`);
          socket.emit('error', { message: 'Security verification failed' });
          return;
        }
      } else {
        // For backward compatibility, allow connections without token
        // but log them as potentially less secure
        console.log(`Room ${roomId} joined without security token by ${socket.id}`);
      }
      
      const room = rooms.get(roomId);

      if (!room) {
        console.log(`Room not found: ${roomId}, requested by ${socket.id}`);
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      if (room.participants.length >= 2) {
        console.log(`Room full: ${roomId}, rejected ${socket.id}`);
        socket.emit('error', { message: 'Room is full' });
        return;
      }

      room.participants.push(socket.id);
      socket.join(roomId);
      socket.emit('room-joined', { roomId });

      // Notify the other participant
      socket.to(roomId).emit('peer-joined', { peerId: socket.id });
      console.log(`User ${socket.id} joined room ${roomId}`);
    } catch (error) {
      console.error(`Error joining room ${roomId} for ${socket.id}:`, error);
      socket.emit('error', { message: `Failed to join room: ${error.message}` });
    }
  });

  // Rejoin room after disconnection
  socket.on('rejoin-room', ({ roomId, token }) => {
    try {
      // First verify token if provided (same logic as join-room)
      if (token) {
        const verification = verifyRoomToken(token);
        if (!verification.valid) {
          console.log(`Invalid token for rejoin ${roomId}: ${verification.reason}`);
          socket.emit('error', { message: `Invalid room token: ${verification.reason}` });
          return;
        }
        
        if (verification.roomId !== roomId) {
          console.log(`Token doesn't match room ID for rejoin: ${roomId}`);
          socket.emit('error', { message: 'Security verification failed' });
          return;
        }
      }
      
      const room = rooms.get(roomId);
      
      if (!room) {
        console.log(`Room not found for rejoin: ${roomId}, requested by ${socket.id}`);
        socket.emit('error', { message: 'Room expired or not found' });
        return;
      }
      
      // If the room is full but this socket wasn't in it, reject
      if (room.participants.length >= 2 && !room.participants.includes(socket.id)) {
        console.log(`Room full for rejoin: ${roomId}, rejected ${socket.id}`);
        socket.emit('error', { message: 'Room is full' });
        return;
      }
      
      // Add user to participants if not already there
      if (!room.participants.includes(socket.id)) {
        room.participants.push(socket.id);
      }
      
      socket.join(roomId);
      socket.emit('room-rejoined', { roomId });
      
      // Notify the other participant
      socket.to(roomId).emit('peer-rejoined', { peerId: socket.id });
      console.log(`User ${socket.id} rejoined room ${roomId}`);
    } catch (error) {
      console.error(`Error rejoining room ${roomId} for ${socket.id}:`, error);
      socket.emit('error', { message: `Failed to rejoin room: ${error.message}` });
    }
  });

  // =============================================
  // WEBRTC SIGNALING
  // =============================================

  // Handle SDP offer from initiating peer
  socket.on('offer', ({ roomId, offer }) => {
    try {
      if (!rooms.has(roomId)) {
        console.log(`Invalid room for offer: ${roomId}`);
        socket.emit('error', { message: 'Room not found for offer' });
        return;
      }
      // Forward offer to the other peer in the room
      socket.to(roomId).emit('offer', { peerId: socket.id, offer });
    } catch (error) {
      console.error(`Error processing offer for room ${roomId}:`, error);
      socket.emit('error', { message: `Failed to process offer: ${error.message}` });
    }
  });

  // Handle SDP answer from receiving peer
  socket.on('answer', ({ roomId, answer }) => {
    try {
      if (!rooms.has(roomId)) {
        console.log(`Invalid room for answer: ${roomId}`);
        socket.emit('error', { message: 'Room not found for answer' });
        return;
      }
      // Forward answer to the other peer in the room
      socket.to(roomId).emit('answer', { peerId: socket.id, answer });
    } catch (error) {
      console.error(`Error processing answer for room ${roomId}:`, error);
      socket.emit('error', { message: `Failed to process answer: ${error.message}` });
    }
  });

  // Handle ICE candidates for NAT traversal
  socket.on('ice-candidate', ({ roomId, candidate }) => {
    try {
      if (!rooms.has(roomId)) {
        // Don't emit error for ICE candidates to avoid spamming the user
        console.log(`Invalid room for ICE candidate: ${roomId}`);
        return;
      }
      // Forward ICE candidate to the other peer in the room
      socket.to(roomId).emit('ice-candidate', { peerId: socket.id, candidate });
    } catch (error) {
      console.error(`Error processing ICE candidate for room ${roomId}:`, error);
      // Don't emit error for ICE candidates to avoid spamming the user with errors
    }
  });

  // =============================================
  // DISCONNECT AND CLEANUP
  // =============================================

  // Handle disconnect
  socket.on('disconnect', () => {
    try {
      console.log('User disconnected:', socket.id);

      // Find and clean up rooms
      for (const [roomId, room] of rooms.entries()) {
        if (room.participants.includes(socket.id)) {
          // Notify other participants
          socket.to(roomId).emit('peer-disconnected', { peerId: socket.id });

          // Remove user from participants
          room.participants = room.participants.filter(id => id !== socket.id);

          // If room still has participants, keep it alive
          // Otherwise, mark it for potential reconnection with a timeout
          if (room.participants.length > 0) {
            console.log(`Room ${roomId} still has ${room.participants.length} participant(s)`);
          } else {
            // Set a reconnection window of 60 seconds
            room.reconnectionWindow = Date.now() + 60000;
            console.log(`Room ${roomId} marked for reconnection until ${new Date(room.reconnectionWindow).toISOString()}`);
            
            // Schedule cleanup after reconnection window
            setTimeout(() => {
              const staleRoom = rooms.get(roomId);
              if (staleRoom && staleRoom.participants.length === 0) {
                rooms.delete(roomId);
                console.log(`Room ${roomId} deleted (reconnection window expired)`);
              }
            }, 60000);
          }
        }
      }
    } catch (error) {
      console.error(`Error handling disconnect for ${socket.id}:`, error);
      // Can't emit to disconnected socket
    }
  });

  // Handle manual call end ("burn")
  socket.on('burn-room', ({ roomId }) => {
    try {
      const room = rooms.get(roomId);

      if (room) {
        // Notify all participants
        io.to(roomId).emit('room-burned');

        // Delete the room
        rooms.delete(roomId);
        console.log(`Room ${roomId} burned by ${socket.id}`);
      } else {
        console.log(`Attempted to burn non-existent room: ${roomId}`);
        // Still notify the requester so they can clean up locally
        socket.emit('room-burned');
        // Also send the error for logging purposes
        socket.emit('error', { message: 'Room not found for burning' });
      }
    } catch (error) {
      console.error(`Error burning room ${roomId}:`, error);
      // Send room-burned anyway to ensure client cleans up
      socket.emit('room-burned');
      socket.emit('error', { message: `Failed to end call: ${error.message}` });
    }
  });
});

// =============================================
// SERVER STARTUP AND ROUTES
// =============================================

// Define port (use environment variable if available)
const PORT = process.env.PORT || 3002;

// Add a periodic room cleanup for stale rooms
const cleanupStaleRooms = () => {
  const now = Date.now();
  let roomsCleaned = 0;
  
  for (const [roomId, room] of rooms.entries()) {
    // Clean up rooms with expired reconnection windows
    if (room.participants.length === 0 && room.reconnectionWindow && now > room.reconnectionWindow) {
      rooms.delete(roomId);
      roomsCleaned++;
    }
    
    // Clean up very old rooms (over 2 hours old) regardless of state
    if (room.created && now - room.created > 7200000) {
      rooms.delete(roomId);
      roomsCleaned++;
    }
  }
  
  if (roomsCleaned > 0) {
    console.log(`Cleaned up ${roomsCleaned} stale room(s)`);
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupStaleRooms, 300000);

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

// Provide ICE server configuration for WebRTC NAT traversal
app.get('/api/ice-servers', (req, res) => {
  try {
    // Send ICE server configuration with credentials from environment variables
    const iceServers = [
      {
        urls: "stun:stun.relay.metered.ca:80"
      },
      {
        urls: "turn:standard.relay.metered.ca:80",
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL
      },
      {
        urls: "turn:standard.relay.metered.ca:80?transport=tcp",
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL
      },
      {
        urls: "turn:standard.relay.metered.ca:443",
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL
      },
      {
        urls: "turns:standard.relay.metered.ca:443?transport=tcp",
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL
      }
    ];

    res.json({ iceServers });
  } catch (error) {
    console.error('Error providing ICE servers:', error);
    res.status(500).json({ error: 'Failed to provide ICE servers' });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`Oblivn server running on port ${PORT}`);
});

// Route all requests to index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});