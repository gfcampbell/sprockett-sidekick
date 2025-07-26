// Use multer for multipart parsing like the original server
const multer = require('multer');
const upload = multer();

// Wrap multer middleware for serverless
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

module.exports = async (req, res) => {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'false');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log('Request method:', req.method);
  console.log('Content-Type:', req.headers['content-type']);
  console.log('User-Agent:', req.headers['user-agent']);
  console.log('All headers:', Object.keys(req.headers));
  
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      method: req.method,
      contentType: req.headers['content-type']
    });
  }

  try {
    const ENABLE_TRANSCRIPTION = process.env.ENABLE_TRANSCRIPTION !== 'false';
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!ENABLE_TRANSCRIPTION) {
      return res.status(503).json({ 
        error: 'Transcription service is disabled',
        fallback: true
      });
    }

    if (!OPENAI_API_KEY) {
      return res.status(503).json({ 
        error: 'OpenAI API key not configured',
        fallback: true
      });
    }

    // Use multer to parse multipart data
    await runMiddleware(req, res, upload.single('audio'));

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

    // Prepare FormData for OpenAI API using built-in FormData
    const formData = new FormData();
    
    // Convert buffer to blob for FormData
    const audioBlob = new Blob([audioBuffer], { type: req.file.mimetype || 'audio/webm' });
    formData.append('file', audioBlob, req.file.originalname || 'audio.webm');
    formData.append('model', model);
    
    if (enableSpeakerDetection) {
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities', 'segment');
    } else {
      formData.append('response_format', 'json');
    }

    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
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
        text: result.text,
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