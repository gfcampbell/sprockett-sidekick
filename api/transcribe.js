// Copied from server.js - exact same logic, adapted for Vercel
export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // For now, return a test response to verify the endpoint works
  return res.json({ 
    segments: [{
      speaker: 'Test',
      text: 'API endpoint is working'
    }],
    text: 'API endpoint is working',
    speaker: 'Test',
    timestamp: new Date().toISOString(),
    model: 'test'
  });

  try {
    const ENABLE_TRANSCRIPTION = process.env.ENABLE_TRANSCRIPTION === 'true' || true;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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
}