// transcription.js
// ✨ Phase III: Real-Time Transcription via OpenAI Whisper API
// Handles both host and visitor audio streams, sends to server proxy, displays results

import { transcriptionConfig, userState } from './config.js';

// Active transcription sessions
const activeTranscriptions = new Map();
let transcriptionChunkCounter = 0;

/**
 * Start real-time transcription for a given audio stream
 * @param {MediaStream} mediaStream - Audio stream to transcribe
 * @param {string} speakerLabel - 'Host' or 'Visitor' 
 * @param {HTMLElement} outputElement - DOM element to display transcripts
 */
export function startRealTranscription(mediaStream, speakerLabel, outputElement) {
    // Only proceed if we have valid inputs
    if (!mediaStream || !speakerLabel || !outputElement) {
        console.warn('❌ Invalid inputs for transcription:', { mediaStream, speakerLabel, outputElement });
        return;
    }

    // Check if transcription is already running for this speaker
    if (activeTranscriptions.has(speakerLabel)) {
        console.log(`🎤 Transcription already running for ${speakerLabel}`);
        return;
    }

    // Get audio tracks
    const audioTracks = mediaStream.getAudioTracks();
    if (audioTracks.length === 0) {
        console.warn(`❌ No audio tracks found for ${speakerLabel}`);
        return;
    }

    console.log(`🎤 Starting real transcription for ${speakerLabel}`);

    try {
        // Create audio-only stream from the provided media stream
        const audioOnlyStream = new MediaStream(audioTracks);
        
        console.log(`🎵 Created audio-only stream for ${speakerLabel}:`, {
            originalTracks: mediaStream.getTracks().length,
            audioTracks: audioTracks.length,
            audioOnlyActive: audioOnlyStream.active
        });

        // Create MediaRecorder for the audio-only stream
        const mediaRecorder = new MediaRecorder(audioOnlyStream, {
            mimeType: 'audio/webm;codecs=opus'
        });

        // Store transcription session data
        const session = {
            mediaRecorder,
            speakerLabel,
            outputElement,
            audioChunks: [],
            isRecording: false,
            lastSentTime: 0
        };

        // Handle data available (collect audio chunks)
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                session.audioChunks.push(event.data);
            }
        };

        // Handle recording stop (send for transcription)
        mediaRecorder.onstop = async () => {
            if (session.audioChunks.length > 0) {
                await processAudioChunks(session);
                session.audioChunks = []; // Clear chunks after processing
            }

            // Restart recording if still active
            if (activeTranscriptions.has(speakerLabel) && !session.isRecording) {
                session.isRecording = true;
                session.mediaRecorder.start();
                
                // Stop after chunk duration to trigger transcription
                setTimeout(() => {
                    if (session.mediaRecorder.state === 'recording') {
                        session.mediaRecorder.stop();
                        session.isRecording = false;
                    }
                }, transcriptionConfig.CHUNK_DURATION);
            }
        };

        // Handle errors
        mediaRecorder.onerror = (event) => {
            console.error(`❌ MediaRecorder error for ${speakerLabel}:`, event.error);
            fallbackToSimulation(speakerLabel, outputElement);
        };

        // Store session and start recording
        activeTranscriptions.set(speakerLabel, session);
        session.isRecording = true;
        mediaRecorder.start();

        // Stop after chunk duration to trigger first transcription
        setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                session.isRecording = false;
            }
        }, transcriptionConfig.CHUNK_DURATION);

        // Add initial message
        addTranscriptMessage(outputElement, speakerLabel, `🎤 Real-time transcription started for ${speakerLabel}`);

    } catch (error) {
        console.error(`❌ Failed to start transcription for ${speakerLabel}:`, error);
        fallbackToSimulation(speakerLabel, outputElement);
    }
}

/**
 * Process collected audio chunks and send for transcription
 * @param {Object} session - Transcription session data
 */
async function processAudioChunks(session) {
    const { audioChunks, speakerLabel, outputElement } = session;
    
    // Rate limiting check
    const now = Date.now();
    if (now - session.lastSentTime < transcriptionConfig.MIN_INTERVAL_MS) {
        console.log(`⏱️ Rate limiting transcription for ${speakerLabel}`);
        return;
    }

    // Check chunk count limit
    userState.transcriptionChunkCount++;
    if (userState.transcriptionChunkCount > transcriptionConfig.MAX_CHUNKS_PER_MINUTE) {
        console.warn(`⚠️ Rate limit exceeded for ${speakerLabel}, falling back to simulation`);
        fallbackToSimulation(speakerLabel, outputElement);
        return;
    }

    try {
        // Combine audio chunks into single blob
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
        
        // Skip if audio is too small (likely silence)
        if (audioBlob.size < 1000) { // Less than 1KB
            console.log(`🔇 Skipping small audio chunk for ${speakerLabel} (${audioBlob.size} bytes)`);
            return;
        }

        session.lastSentTime = now;
        
        // Send to transcription API
        const transcript = await sendToTranscriptionAPI(audioBlob, speakerLabel);
        
        if (transcript && transcript.trim()) {
            // Filter out Whisper hallucinations and meaningless content
            const cleanTranscript = transcript.trim();
            
            if (isValidTranscript(cleanTranscript)) {
                // Display transcript with speaker label
                const speakerIcon = speakerLabel === 'Host' ? '🎙️' : '👤';
                addTranscriptMessage(outputElement, speakerLabel, `${speakerIcon} ${speakerLabel}: "${cleanTranscript}"`);
                
                console.log(`✅ Transcribed for ${speakerLabel}: "${cleanTranscript}"`);
            } else {
                console.log(`🚫 Filtered out meaningless transcript for ${speakerLabel}: "${cleanTranscript}"`);
            }
        }

    } catch (error) {
        console.error(`❌ Transcription failed for ${speakerLabel}:`, error);
        
        // Fallback to simulation after multiple failures
        if (!session.failureCount) session.failureCount = 0;
        session.failureCount++;
        
        if (session.failureCount >= transcriptionConfig.MAX_RETRIES) {
            console.warn(`⚠️ Too many failures for ${speakerLabel}, falling back to simulation`);
            fallbackToSimulation(speakerLabel, outputElement);
        }
    }
}

/**
 * Send audio blob to transcription API via server proxy
 * @param {Blob} audioBlob - Audio data to transcribe
 * @param {string} speakerLabel - Speaker identifier
 * @returns {Promise<string>} - Transcribed text
 */
async function sendToTranscriptionAPI(audioBlob, speakerLabel) {
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('audio', audioBlob, `audio_${speakerLabel}_${Date.now()}.webm`);
    formData.append('model', transcriptionConfig.TRANSCRIPTION_MODEL);
    formData.append('speaker', speakerLabel);

    // Send to server proxy
    const response = await fetch(transcriptionConfig.TRANSCRIPTION_API_URL, {
        method: 'POST',
        body: formData,
        // No Content-Type header - let browser set multipart/form-data boundary
    });

    if (!response.ok) {
        throw new Error(`Transcription API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    // Handle different response formats
    if (result.text) return result.text;
    if (result.transcript) return result.transcript;
    if (typeof result === 'string') return result;
    
    throw new Error('Invalid transcription response format');
}

/**
 * Stop all active transcriptions
 */
export function stopAllTranscriptions() {
    console.log('🛑 Stopping all transcriptions');
    
    for (const [speakerLabel, session] of activeTranscriptions) {
        try {
            if (session.mediaRecorder && session.mediaRecorder.state !== 'inactive') {
                session.mediaRecorder.stop();
            }
            console.log(`✅ Stopped transcription for ${speakerLabel}`);
        } catch (error) {
            console.error(`❌ Error stopping transcription for ${speakerLabel}:`, error);
        }
    }
    
    // Clear all sessions
    activeTranscriptions.clear();
    
    // Reset counters
    userState.transcriptionChunkCount = 0;
    userState.lastTranscriptionTime = 0;
}

/**
 * Stop transcription for a specific speaker
 * @param {string} speakerLabel - Speaker to stop transcription for
 */
export function stopTranscription(speakerLabel) {
    const session = activeTranscriptions.get(speakerLabel);
    if (session) {
        try {
            if (session.mediaRecorder && session.mediaRecorder.state !== 'inactive') {
                session.mediaRecorder.stop();
            }
            activeTranscriptions.delete(speakerLabel);
            console.log(`✅ Stopped transcription for ${speakerLabel}`);
        } catch (error) {
            console.error(`❌ Error stopping transcription for ${speakerLabel}:`, error);
        }
    }
}

/**
 * Fallback to simulation when real transcription fails
 * @param {string} speakerLabel - Speaker label
 * @param {HTMLElement} outputElement - Output element for messages
 */
function fallbackToSimulation(speakerLabel, outputElement) {
    if (!transcriptionConfig.FALLBACK_TO_SIMULATION) {
        return;
    }

    console.log(`🔄 Falling back to simulation for ${speakerLabel}`);
    
    // Stop real transcription
    stopTranscription(speakerLabel);
    
    // Start simulation
    const simulationTexts = [
        "Thanks for joining the call",
        "Let me share my screen",
        "Can everyone hear me clearly?",
        "I think we should focus on the main objectives",
        "What are your thoughts on this approach?",
        "Let's move to the next agenda item",
        "Any questions before we continue?",
        "I'll follow up with an email summary"
    ];

    const simulationInterval = setInterval(() => {
        if (!activeTranscriptions.has(`${speakerLabel}_simulation`)) {
            clearInterval(simulationInterval);
            return;
        }

        const randomText = simulationTexts[Math.floor(Math.random() * simulationTexts.length)];
        const speakerIcon = speakerLabel === 'Host' ? '🎙️' : '👤';
        addTranscriptMessage(outputElement, speakerLabel, `${speakerIcon} ${speakerLabel} (simulated): "${randomText}"`);
    }, 8000);

    // Track simulation session
    activeTranscriptions.set(`${speakerLabel}_simulation`, { interval: simulationInterval });
}

/**
 * Add transcript message to output element
 * @param {HTMLElement} outputElement - DOM element to add message to (legacy parameter, now using conversation window)
 * @param {string} speakerLabel - Speaker label
 * @param {string} message - Message to display
 */
function addTranscriptMessage(outputElement, speakerLabel, message) {
    // Use the new conversation messages container instead of passed outputElement
    const conversationContainer = document.querySelector('.conversation-messages');
    if (!conversationContainer) return;

    // ✨ SURGICAL FIX: Extract clean text and add to transcript buffer for AI coaching
    const cleanText = message.replace(/^[🎤👤🎙️]\s*(Host|Visitor)(\s*\(simulated.*?\))?\s*:\s*"?([^"]*)"?$/i, '$3').trim();
    if (cleanText && cleanText.length > 3 && !cleanText.includes('Real-time transcription started')) {
        // Import addToTranscriptBuffer dynamically to avoid circular imports
        if (window.addToTranscriptBuffer) {
            window.addToTranscriptBuffer(speakerLabel, cleanText);
        }
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'transcript-message';
    messageDiv.innerHTML = `
        <span class="timestamp">${new Date().toLocaleTimeString()}</span>
        <span class="message">${message}</span>
    `;

    conversationContainer.appendChild(messageDiv);
    
    // Auto-scroll to bottom
    conversationContainer.scrollTop = conversationContainer.scrollHeight;
    
    // Limit message history (keep last 50 messages)
    const messages = conversationContainer.querySelectorAll('.transcript-message');
    if (messages.length > 50) {
        messages[0].remove();
    }
}

/**
 * Check if transcription is available (server proxy reachable)
 * @returns {Promise<boolean>} - True if transcription service is available
 */
export async function checkTranscriptionAvailability() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

    try {
        const response = await fetch('/api/transcribe/health', {
            method: 'GET',
            signal: controller.signal // Pass the AbortController's signal
        });
        clearTimeout(timeoutId); // Clear the timeout if the request succeeds
        return response.ok;
    } catch (error) {
        clearTimeout(timeoutId); // Also clear timeout on error
        if (error.name === 'AbortError') {
            console.warn('⚠️ Transcription service check timed out, will use simulation');
        } else {
            console.warn('⚠️ Transcription service not available, will use simulation');
        }
        return false;
    }
}

/**
 * Check if a transcript is valid and not a Whisper hallucination
 * @param {string} text - The transcript text to validate
 * @returns {boolean} - True if valid, false if likely hallucination
 */
function isValidTranscript(text) {
    if (!text || text.length < 3) return false;
    
    // Common Whisper hallucinations to filter out
    const hallucinations = [
        // Generic filler
        '...', 
        'Thank you.', 
        'Thank you for watching.',
        'Thank you for watching this video.',
        'Thanks for watching.',
        'Subscribe to my channel.',
        'Like and subscribe.',
        'Don\'t forget to subscribe.',
        'Please subscribe.',
        'Share this video.',
        'Share this video with your friends.',
        '📢 Share this video with your friends on social media.',
        
        // Korean common phrases (Whisper often hallucinates these)
        '시청해 주셔서 감사합니다.',
        '구독과 좋아요 부탁드립니다.',
        '감사합니다.',
        
        // Other common hallucinations
        'Music',
        'Applause',
        'Laughter',
        '♪ Music ♪',
        '[Music]',
        '[Applause]',
        '[Laughter]',
        'you',
        'I',
        'a',
        'the',
        'and',
        'is',
        'it'
    ];
    
    // Check for exact matches (case insensitive)
    const lowerText = text.toLowerCase().trim();
    if (hallucinations.some(h => h.toLowerCase() === lowerText)) {
        return false;
    }
    
    // Filter out very short single words (likely noise)
    if (text.trim().split(' ').length === 1 && text.length < 4) {
        return false;
    }
    
    // Filter out repetitive patterns (like "a a a a")
    const words = text.trim().split(' ');
    if (words.length > 1) {
        const uniqueWords = new Set(words);
        if (uniqueWords.size === 1) {
            return false; // All words are the same
        }
    }
    
    // Filter out emoji-only or symbol-heavy content
    const emojiRegex = /^[\s🎤👤📢♪\[\]()_-]*$/;
    if (emojiRegex.test(text)) {
        return false;
    }
    
    return true;
} 