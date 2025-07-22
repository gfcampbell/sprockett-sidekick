// aiCoach.js
// Sprint 4.1: Real-Time AI Coaching via LLM
// Sends conversation context + transcript to OpenAI for intelligent coaching suggestions

import { buildSystemPrompt } from './callConfig.js';
import { userState } from './config.js';

// =============================================
// CONFIGURATION
// =============================================

const COACHING_CONFIG = {
    INTERVAL_MS: 15000,           // Send coaching request every 15 seconds
    TRANSCRIPT_WINDOW_MS: 60000,  // Use last 60 seconds of transcript
    MAX_TRANSCRIPT_CHARS: 2000    // Limit transcript length for API efficiency
};

// =============================================
// STATE MANAGEMENT
// =============================================

let coachingInterval = null;
let isCoachingActive = false;
let lastCoachingRequest = 0;

// =============================================
// MAIN COACHING FUNCTIONS
// =============================================

/**
 * Starts the AI coaching system
 * Sends periodic coaching requests based on recent transcript
 */
export const startAICoaching = () => {
    if (isCoachingActive) return;
    
    // Only start if AI assist is enabled and user is host
    if (!userState.aiAssistEnabled || !userState.isHost) {
        console.log('❌ AI Coaching not started - AI assist disabled or user not host');
        return;
    }
    
    isCoachingActive = true;
    console.log('🤖 AI Coaching started - requesting suggestions every', COACHING_CONFIG.INTERVAL_MS / 1000, 'seconds');
    
    // Start periodic coaching requests
    coachingInterval = setInterval(async () => {
        await requestCoachingSuggestion();
    }, COACHING_CONFIG.INTERVAL_MS);
    
    // Send initial request after a short delay to let conversation start
    setTimeout(async () => {
        await requestCoachingSuggestion();
    }, 5000);
};

/**
 * Stops the AI coaching system
 */
export const stopAICoaching = () => {
    if (!isCoachingActive) return;
    
    isCoachingActive = false;
    
    if (coachingInterval) {
        clearInterval(coachingInterval);
        coachingInterval = null;
    }
    
    console.log('🤖 AI Coaching stopped');
};

/**
 * Requests a coaching suggestion from the AI
 */
const requestCoachingSuggestion = async () => {
    try {
        // Get current state and transcript
        const state = window.state;
        if (!state) {
            console.warn('❌ No state available for coaching request');
            return;
        }
        
        // Get recent transcript
        const transcript = getRecentTranscript(state.transcriptBuffer);
        
        // Skip if no meaningful transcript available
        if (!transcript || transcript.length < 50) {
            console.log('ℹ️ Skipping coaching request - insufficient transcript');
            return;
        }
        
        // Build the coaching prompt
        const promptPayload = buildCoachingPrompt(state.callConfig, transcript);
        
        // Send to coaching API
        await sendToCoachAPI(promptPayload);
        
        lastCoachingRequest = Date.now();
        
    } catch (error) {
        console.error('❌ Error requesting coaching suggestion:', error);
        showCoachingError('Failed to get AI suggestions');
    }
};

/**
 * Gets recent transcript from the buffer
 * @param {Array} transcriptBuffer - The transcript buffer from state
 * @returns {string} Formatted transcript text
 */
const getRecentTranscript = (transcriptBuffer) => {
    if (!transcriptBuffer || transcriptBuffer.length === 0) {
        return '';
    }
    
    const now = Date.now();
    const cutoff = now - COACHING_CONFIG.TRANSCRIPT_WINDOW_MS;
    
    // Filter to recent entries and format
    const recentEntries = transcriptBuffer
        .filter(entry => entry.timestamp > cutoff)
        .slice(-20); // Limit to last 20 entries for performance
    
    if (recentEntries.length === 0) {
        return '';
    }
    
    // Format as conversation
    let formattedTranscript = recentEntries
        .map(entry => {
            const speaker = entry.speaker === 'Host' ? '🙋‍♂️ You' : '👤 Visitor';
            return `${speaker}: "${entry.text}"`;
        })
        .join('\n');
    
    // Truncate if too long
    if (formattedTranscript.length > COACHING_CONFIG.MAX_TRANSCRIPT_CHARS) {
        formattedTranscript = formattedTranscript.substring(0, COACHING_CONFIG.MAX_TRANSCRIPT_CHARS) + '...';
    }
    
    return formattedTranscript;
};

/**
 * Builds the complete coaching prompt for the AI
 * @param {Object} callConfig - Current call configuration
 * @param {string} transcript - Recent conversation transcript
 * @returns {Object} Prompt payload for API
 */
const buildCoachingPrompt = (callConfig, transcript) => {
    // Get the enhanced system prompt
    const systemPrompt = buildSystemPrompt(callConfig, userState.aiPrompt);
    
    // Build user message with context and transcript
    const userMessage = `CURRENT CONVERSATION:
${transcript}

COACHING REQUEST:
Based on the conversation above and my stated goal, provide 1-2 specific, actionable coaching suggestions. Focus on:
- What I should say or ask next
- How to read the other person's responses
- Strategic timing for important points
- Ways to move toward my objective

Be concise and practical. Format as: "🤖 Coaching Tip: [your suggestion]"`;

    return {
        model: 'gpt-4-turbo-preview',
        messages: [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user', 
                content: userMessage
            }
        ],
        max_tokens: 150,
        temperature: 0.7,
        stream: true
    };
};

/**
 * Sends coaching request to server API and streams response
 * @param {Object} promptPayload - The prompt data for OpenAI
 */
const sendToCoachAPI = async (promptPayload) => {
    try {
        const response = await fetch('/api/coach', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(promptPayload)
        });
        
        if (!response.ok) {
            throw new Error(`API responded with status ${response.status}`);
        }
        
        // Stream the response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        let suggestion = '';
        let isFirstChunk = true;
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            
            // Parse OpenAI streaming format
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    
                    if (data === '[DONE]') {
                        break;
                    }
                    
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        
                        if (content) {
                            suggestion += content;
                            
                            // Show first chunk immediately, then update
                            if (isFirstChunk) {
                                showCoachingSuggestion(suggestion);
                                isFirstChunk = false;
                            }
                        }
                    } catch (parseError) {
                        // Skip malformed JSON chunks
                        continue;
                    }
                }
            }
        }
        
        // Show final complete suggestion
        if (suggestion.trim()) {
            showCoachingSuggestion(suggestion.trim());
        }
        
    } catch (error) {
        console.error('❌ Error calling coaching API:', error);
        showCoachingError(`AI suggestions unavailable: ${error.message}`);
    }
};

// =============================================
// UI INTEGRATION
// =============================================

/**
 * Displays a coaching suggestion in the AI output
 * @param {string} suggestion - The AI coaching suggestion
 */
const showCoachingSuggestion = (suggestion) => {
    const coachingContainer = document.querySelector('.coaching-messages');
    if (!coachingContainer) return;
    
    // Create suggestion element
    const suggestionElement = document.createElement('div');
    suggestionElement.className = 'ai-message ai-coaching';
    suggestionElement.innerHTML = `
        <div class="ai-coaching-content">
            ${suggestion}
        </div>
        <div class="ai-coaching-timestamp">
            ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
    `;
    
    // Add to coaching window
    coachingContainer.appendChild(suggestionElement);
    
    // Auto-scroll to bottom
    coachingContainer.scrollTop = coachingContainer.scrollHeight;
    
    // Limit number of messages (keep last 10)
    const messages = coachingContainer.querySelectorAll('.ai-message');
    if (messages.length > 10) {
        messages[0].remove();
    }
};

/**
 * Displays an error message in the AI output
 * @param {string} errorMessage - The error message to display
 */
const showCoachingError = (errorMessage) => {
    const coachingContainer = document.querySelector('.coaching-messages');
    if (!coachingContainer) return;
    
    const errorElement = document.createElement('div');
    errorElement.className = 'ai-message ai-error';
    errorElement.innerHTML = `
        <div class="ai-error-content">
            ❌ ${errorMessage}
        </div>
    `;
    
    coachingContainer.appendChild(errorElement);
    coachingContainer.scrollTop = coachingContainer.scrollHeight;
};

// =============================================
// TRANSCRIPT BUFFER UTILITIES
// =============================================

/**
 * Adds a transcript entry to the buffer
 * Called by transcription system when new speech is detected
 * @param {string} speaker - 'Host' or 'Visitor'
 * @param {string} text - The transcribed text
 */
export const addToTranscriptBuffer = (speaker, text) => {
    const state = window.state;
    if (!state) return;
    
    // Add new entry
    state.transcriptBuffer.push({
        speaker,
        text: text.trim(),
        timestamp: Date.now()
    });
    
    // Keep buffer manageable (last 100 entries)
    if (state.transcriptBuffer.length > 100) {
        state.transcriptBuffer = state.transcriptBuffer.slice(-100);
    }
    
    console.log(`📝 Added to transcript: ${speaker}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
};

/**
 * Clears the transcript buffer
 * Called when call ends
 */
export const clearTranscriptBuffer = () => {
    const state = window.state;
    if (state) {
        state.transcriptBuffer = [];
        console.log('🗑️ Transcript buffer cleared');
    }
};

// =============================================
// WINDOW OBJECT EXPOSURE
// =============================================
// Expose functions to window object for compatibility with existing module pattern

window.startAICoaching = startAICoaching;
window.stopAICoaching = stopAICoaching;
window.addToTranscriptBuffer = addToTranscriptBuffer;
window.clearTranscriptBuffer = clearTranscriptBuffer;

console.log('✅ AI Coaching module loaded'); 