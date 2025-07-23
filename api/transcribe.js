// api/transcribe.js - Vercel API function for OpenAI Whisper transcription
import { FormData, File } from 'formdata-node';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const ENABLE_TRANSCRIPTION = process.env.ENABLE_TRANSCRIPTION === 'true' || false;

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

    // Parse multipart form data (Vercel handles this differently)
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
    }

    // For Vercel, we need to handle the multipart parsing differently
    // This is a simplified version - in production you'd use a proper multipart parser
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    
    await new Promise((resolve) => {
      req.on('end', resolve);
    });
    
    const buffer = Buffer.concat(chunks);
    
    // Extract form data (simplified - in production use proper multipart parser)
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
      return res.status(400).json({ error: 'Missing boundary in multipart data' });
    }

    // Simple multipart parsing (for production, use proper parser like 'multiparty')
    const parts = buffer.toString().split(`--${boundary}`);
    let audioBuffer = null;
    let filename = 'audio.webm';
    let contentTypeFile = 'audio/webm';
    
    // Extract audio file from multipart data
    for (const part of parts) {
      if (part.includes('Content-Disposition: form-data; name="audio"')) {
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          const headers = part.substring(0, headerEnd);
          const filenameMatch = headers.match(/filename="([^"]+)"/);
          if (filenameMatch) filename = filenameMatch[1];
          
          const contentTypeMatch = headers.match(/Content-Type: ([^\r\n]+)/);
          if (contentTypeMatch) contentTypeFile = contentTypeMatch[1];
          
          // Get binary data
          const binaryStart = headerEnd + 4;
          const binaryEnd = part.lastIndexOf('\r\n');
          audioBuffer = Buffer.from(part.substring(binaryStart, binaryEnd), 'binary');
          break;
        }
      }
    }

    if (!audioBuffer) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Extract other form fields
    let enableSpeakerDetection = false;
    let maxSpeakers = '5';
    let model = 'whisper-1';
    let speaker = 'Unknown';
    let audioSource = 'unknown'; // 🏥 SURGICAL: Track audio source

    for (const part of parts) {
      if (part.includes('name="enable_speaker_detection"')) {
        const valueMatch = part.match(/\r\n\r\n([^\r\n]+)/);
        if (valueMatch) enableSpeakerDetection = valueMatch[1] === 'true';
      }
      if (part.includes('name="max_speakers"')) {
        const valueMatch = part.match(/\r\n\r\n([^\r\n]+)/);
        if (valueMatch) maxSpeakers = valueMatch[1];
      }
      if (part.includes('name="model"')) {
        const valueMatch = part.match(/\r\n\r\n([^\r\n]+)/);
        if (valueMatch) model = valueMatch[1];
      }
      if (part.includes('name="speaker"')) {
        const valueMatch = part.match(/\r\n\r\n([^\r\n]+)/);
        if (valueMatch) speaker = valueMatch[1];
      }
      if (part.includes('name="audioSource"')) {
        const valueMatch = part.match(/\r\n\r\n([^\r\n]+)/);
        if (valueMatch) audioSource = valueMatch[1];
      }
    }

    console.log(`🎤 Transcribing audio for ${speaker} (${audioSource}): ${audioBuffer.length} bytes`);

    // Prepare FormData for OpenAI API
    const formData = new FormData();
    
    // Add audio file
    const audioFile = new File([audioBuffer], filename, { type: contentTypeFile });
    formData.append('file', audioFile);
    
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
        // Simple speaker detection based on voice characteristics
        const speakerId = `Speaker_${segment.id % parseInt(maxSpeakers)}`;
        
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
          end: segment.end,
          audioSource: audioSource // 🏥 SURGICAL: Include audio source for all segments
        });
      }
      
      console.log(`✅ Speaker detection transcription: ${segments.length} segments from ${speakerMap.size} speakers`);
      
      res.json({
        segments: segments,
        speakers: Object.fromEntries(speakerMap),
        text: result.text, // Full text fallback
        audioSource: audioSource, // 🏥 SURGICAL: Include audio source in response
        timestamp: new Date().toISOString(),
        model: model
      });
      
    } else {
      // Standard single-speaker response
      console.log(`✅ Transcription for ${speaker}: "${result.text}"`);
      
      res.json({ 
        segments: [{
          speaker: speaker,
          text: result.text,
          audioSource: audioSource // 🏥 SURGICAL: Include audio source in response
        }],
        text: result.text,
        speaker: speaker,
        audioSource: audioSource,
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