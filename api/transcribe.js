// Use multer for multipart parsing like the original server
const multer = require('multer');
const upload = multer();
const { AssemblyAI } = require('assemblyai');

// Filter out non-English text (Korean, Chinese, etc.)
function isEnglishText(text) {
  if (!text || text.trim().length === 0) return false;
  
  // Check for Korean characters (Hangul)
  const koreanRegex = /[\u3131-\u3163\uac00-\ud7a3]/;
  if (koreanRegex.test(text)) return false;
  
  // Check for Chinese characters (CJK)
  const chineseRegex = /[\u4e00-\u9fff]/;
  if (chineseRegex.test(text)) return false;
  
  // Check for Japanese characters (Hiragana, Katakana)
  const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff]/;
  if (japaneseRegex.test(text)) return false;
  
  // Check if text is mostly English (letters, numbers, common punctuation)
  const englishRegex = /^[a-zA-Z0-9\s.,!?'"();:\-–—\[\]{}@#$%^&*+=/<>~`|\\]+$/;
  return englishRegex.test(text.trim());
}

function filterEnglishText(text) {
  if (!text) return '';
  
  // Split by sentences and filter out non-English ones
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  const englishSentences = sentences.filter(sentence => isEnglishText(sentence));
  
  return englishSentences.join('. ').trim();
}

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
    const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

    if (!ENABLE_TRANSCRIPTION) {
      return res.status(503).json({ 
        error: 'Transcription service is disabled',
        fallback: true
      });
    }

    if (!ASSEMBLYAI_API_KEY) {
      return res.status(503).json({ 
        error: 'AssemblyAI API key not configured',
        fallback: true
      });
    }
    
    // Initialize AssemblyAI client
    const client = new AssemblyAI({
      apiKey: ASSEMBLYAI_API_KEY
    });

    // Use multer to parse multipart data
    await runMiddleware(req, res, upload.single('audio'));

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const { 
      speaker = 'Unknown',
      enable_speaker_detection = 'true'
    } = req.body;
    
    const audioBuffer = req.file.buffer;
    const enableSpeakerDetection = enable_speaker_detection === 'true';

    console.log(`🎤 Transcribing audio with AssemblyAI (${enableSpeakerDetection ? 'with speaker diarization' : 'single speaker'}): ${audioBuffer.length} bytes`);

    // First, upload the audio buffer to AssemblyAI
    const uploadUrl = await client.files.upload(audioBuffer);
    console.log('📤 Audio uploaded to:', uploadUrl);

    // Configure transcription parameters
    const config = {
      audio_url: uploadUrl,
      speaker_labels: enableSpeakerDetection
    };

    // Call AssemblyAI transcription
    const transcript = await client.transcripts.transcribe(config);
    
    // Wait for transcription to complete
    const completedTranscript = await client.transcripts.wait(transcript.id);

    if (completedTranscript.status === 'error') {
      console.error(`❌ AssemblyAI error:`, completedTranscript.error);
      return res.status(500).json({ 
        error: `Transcription error: ${completedTranscript.error}`,
        fallback: true
      });
    }
    
    if (enableSpeakerDetection && completedTranscript.utterances) {
      // Process speaker-labeled utterances
      const speakerMap = new Map();
      const segments = [];
      
      for (const utterance of completedTranscript.utterances) {
        const speakerId = utterance.speaker;
        
        if (!speakerMap.has(speakerId)) {
          speakerMap.set(speakerId, {
            totalDuration: 0,
            segments: 0
          });
        }
        
        const speakerInfo = speakerMap.get(speakerId);
        speakerInfo.totalDuration += (utterance.end - utterance.start);
        speakerInfo.segments += 1;
        speakerMap.set(speakerId, speakerInfo);
        
        const filteredText = filterEnglishText(utterance.text.trim());
        if (filteredText) { // Only add segments with English text
          segments.push({
            speaker: speakerId,
            text: filteredText,
            start: utterance.start / 1000, // Convert to seconds
            end: utterance.end / 1000,
            confidence: utterance.confidence
          });
        }
      }
      
      console.log(`✅ Speaker detection transcription: ${segments.length} segments from ${speakerMap.size} speakers`);
      
      const filteredFullText = filterEnglishText(completedTranscript.text);
      
      res.json({
        segments: segments,
        speakers: Object.fromEntries(speakerMap),
        text: filteredFullText,
        timestamp: new Date().toISOString(),
        model: 'assemblyai'
      });
      
    } else {
      // Standard single-speaker response
      const filteredText = filterEnglishText(completedTranscript.text);
      console.log(`✅ Transcription for ${speaker}: "${filteredText}"`);
      
      if (filteredText) {
        res.json({ 
          segments: [{
            speaker: speaker,
            text: filteredText
          }],
          text: filteredText,
          speaker: speaker,
          timestamp: new Date().toISOString(),
          model: 'assemblyai'
        });
      } else {
        // No English text found, return empty result
        res.json({ 
          segments: [],
          text: '',
          speaker: speaker,
          timestamp: new Date().toISOString(),
          model: 'assemblyai'
        });
      }
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