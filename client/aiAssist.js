// aiAssist.js
// Sprint 3 Phase 1: AI Assist UI Layer (Host Only)
// Sprint 3 Phase 2: Audio Tap + Mock Transcription
// ✨ Phase III: Real-time transcription via OpenAI Whisper API
// ✨ Sprint 4.0: Enhanced system prompts with call configuration
// ✨ Sprint 4.1: Real-time AI coaching integration
// AI suggestions with toggle, prompt input, scrollable output, and real transcription

import { userState, transcriptionConfig } from './config.js';
import { buildSystemPrompt } from './callConfig.js';
import { startAICoaching, stopAICoaching, addToTranscriptBuffer, clearTranscriptBuffer } from './aiCoach.js';
import { 
    startRealTranscription, 
    stopAllTranscriptions, 
    stopTranscription,
    checkTranscriptionAvailability 
} from './transcription.js';

let mockInterval;
let transcriptionInterval;
let mediaRecorder;
let audioContext;
let toggle, promptInput, output, container;
let waitingToggle, waitingPromptInput, waitingContainer;
let transcriptionAvailable = false;

// Track active streams for transcription
let hostStream = null;
let visitorStream = null;

/**
 * Initialize AI Assist functionality (host-only)
 * Sets up event listeners and DOM references for both waiting and active screens
 */
export function initializeAIAssist() {
    // Active call elements
    toggle = document.getElementById('ai-toggle');
    promptInput = document.getElementById('ai-prompt');
    output = document.getElementById('ai-output');
    container = document.getElementById('ai-assist-container');

    // Waiting screen elements
    waitingToggle = document.getElementById('ai-toggle-waiting');
    waitingPromptInput = document.getElementById('ai-prompt-waiting');
    waitingContainer = document.getElementById('ai-assist-container-waiting');

    if (!userState.isHost) {
        // Hide both containers for non-hosts
        if (container) container.style.display = 'none';
        if (waitingContainer) waitingContainer.style.display = 'none';
        return;
    }

    // ✨ Phase III: Check transcription availability on init
    checkTranscriptionAvailability().then(available => {
        transcriptionAvailable = available;
        if (available) {
            console.log('✅ Real transcription service available');
        } else {
            console.log('⚠️ Transcription service unavailable, will use simulation fallback');
        }
    });

    // Set up waiting screen (room-created) controls
    if (waitingToggle && waitingPromptInput && waitingContainer) {
        // Sync waiting toggle with main state
        waitingToggle.addEventListener('change', () => {
            userState.aiAssistEnabled = waitingToggle.checked;
            
            if (waitingToggle.checked) {
                waitingContainer.classList.add('ai-active');
                console.log('✨ AI Assist enabled in waiting screen - transcription will start when call begins');
            } else {
                waitingContainer.classList.remove('ai-active');
                console.log('✨ AI Assist disabled in waiting screen');
            }

            // Sync with active call toggle if it exists
            if (toggle) {
                toggle.checked = waitingToggle.checked;
            }
        });

        // Update prompt in state from waiting screen
        waitingPromptInput.addEventListener('input', () => {
            userState.aiPrompt = waitingPromptInput.value;
            
            // Sync with active call prompt if it exists
            if (promptInput) {
                promptInput.value = waitingPromptInput.value;
            }
        });
    }

    // Set up active call controls
    if (toggle && promptInput && output && container) {
        // Toggle AI assist on/off
        toggle.addEventListener('change', () => {
            userState.aiAssistEnabled = toggle.checked;
            
            if (toggle.checked) {
                container.classList.add('ai-active');
                startMockAI();
                
                // ✨ Phase III: Start real transcription if available and streams exist
                if (transcriptionAvailable) {
                    startRealTranscriptionForStreams();
                } else {
                    // Fallback to simulation
                    startAudioTranscriptionSimulation();
                }
            } else {
                container.classList.remove('ai-active');
                stopMockAI();
            }

            // Sync with waiting toggle if it exists
            if (waitingToggle) {
                waitingToggle.checked = toggle.checked;
            }
        });

        // Update prompt in state from active call
        promptInput.addEventListener('input', () => {
            userState.aiPrompt = promptInput.value;
            
            // Sync with waiting prompt if it exists
            if (waitingPromptInput) {
                waitingPromptInput.value = promptInput.value;
            }
        });
    }

    console.log('✨ AI Assist initialized for host');
}

/**
 * ✨ Phase III: Start real transcription for both host and visitor streams
 * Called when AI is enabled and we have active streams
 */
function startRealTranscriptionForStreams() {
    if (!output) return;

    // Start transcription for host stream
    if (hostStream) {
        startRealTranscription(hostStream, 'Host', output);
        console.log('🎤 Started real transcription for Host stream');
    }

    // Start transcription for visitor stream  
    if (visitorStream) {
        startRealTranscription(visitorStream, 'Visitor', output);
        console.log('🎤 Started real transcription for Visitor stream');
    }

    if (!hostStream && !visitorStream) {
        addAIMessage('⚠️ No audio streams available for transcription');
    }
}

/**
 * ✨ Phase III: Set host stream for transcription
 * Called when host's local stream is established
 * @param {MediaStream} stream - Host's audio stream
 */
export function setHostStream(stream) {
    hostStream = stream;
    console.log('🎙️ Host stream set for transcription');
    
    // Start transcription immediately if AI is already enabled
    if (userState.aiAssistEnabled && transcriptionAvailable && output) {
        startRealTranscription(hostStream, 'Host', output);
    }
}

/**
 * ✨ Phase III: Set visitor stream for transcription  
 * Called when visitor's remote stream is received
 * @param {MediaStream} stream - Visitor's audio stream
 */
export function setVisitorStream(stream) {
    visitorStream = stream;
    console.log('👤 Visitor stream set for transcription');
    
    // Start transcription immediately if AI is already enabled
    if (userState.aiAssistEnabled && transcriptionAvailable && output) {
        startRealTranscription(visitorStream, 'Visitor', output);
    }
}

/**
 * Start mock AI suggestions
 * Injects fake AI messages every 10 seconds
 * ✨ Sprint 4.0: Enhanced with call configuration context
 * ✨ Sprint 4.1: Replaced with real AI coaching system
 */
function startMockAI() {
    if (!output) return;
    
    output.innerHTML = '';
    
    // ✨ Sprint 4.1: Start real AI coaching instead of mock suggestions
    const callConfig = (typeof window !== 'undefined' && window.state?.callConfig) || 
                      { useCase: '', goal: '', context: '' };
    
    // Show initial message based on configuration
    let initialMessage = '🤖 AI Coaching enabled!';
    if (callConfig.useCase || callConfig.goal) {
        if (callConfig.goal) {
            initialMessage += ` Ready to help you: "${callConfig.goal}"`;
        }
        if (callConfig.useCase) {
            const useCases = {
                'sales': '🎯 Sales coaching',
                'interview': '💼 Interview coaching', 
                'negotiation': '🤝 Negotiation coaching',
                'support': '❤️ Customer support coaching',
                'difficult': '💬 Difficult conversation coaching',
                'general': '🗣️ General conversation coaching'
            };
            initialMessage += ` | ${useCases[callConfig.useCase] || 'Specialized coaching'}`;
        }
    }
    
    if (output) {
        output.innerHTML = `
            <div class="ai-message ai-coaching">
                <div class="ai-coaching-content">
                    ${initialMessage}
                    <br><br>
                    🎤 Listening to your conversation and preparing coaching suggestions...
                </div>
                <div class="ai-coaching-timestamp">
                    ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        `;
    }
    
    // ✨ Sprint 4.1: Start real AI coaching
    startAICoaching();
}

/**
 * ✨ Sprint 4.0: Get contextual suggestions based on use case
 * @param {Object} callConfig - Current call configuration
 * @returns {Array} Array of contextual suggestions
 */
function getContextualSuggestions(callConfig) {
    const baseGoal = callConfig.goal || 'your objective';
    
    // Use case specific suggestions
    const useCaseSuggestions = {
        'sales': [
            `Ask about their decision-making process for ${baseGoal}`,
            'Listen for buying signals - urgency, budget, authority',
            'Address any objections with empathy and evidence',
            'Ask about their timeline and next steps',
            'Confirm their pain points and how you solve them'
        ],
        'interview': [
            `Share a specific example that demonstrates ${baseGoal}`,
            'Ask thoughtful questions about the role and team',
            'Show enthusiasm for the company mission',
            'Listen for what they value in candidates',
            'Ask about growth opportunities and next steps'
        ],
        'negotiation': [
            `Find common ground around ${baseGoal}`,
            'Listen for their underlying interests and constraints',
            'Suggest creative solutions that benefit both parties',
            'Use strategic pauses to let them respond',
            'Confirm understanding before making proposals'
        ],
        'support': [
            `Focus on solving their main concern: ${baseGoal}`,
            'Use empathy to acknowledge their frustration',
            'Ask clarifying questions to understand the issue',
            'Suggest proactive solutions beyond the immediate problem',
            'Follow up to ensure they\'re satisfied'
        ],
        'difficult': [
            `Stay focused on the real issue: ${baseGoal}`,
            'Use "I" statements to avoid defensiveness',
            'Listen actively and validate their feelings',
            'Look for shared interests and common ground',
            'Suggest concrete next steps to move forward'
        ]
    };
    
    // Get use case specific suggestions
    const contextualSuggestions = useCaseSuggestions[callConfig.useCase] || [];
    
    // General suggestions that work for any conversation
    const generalSuggestions = [
        `Keep your focus on ${baseGoal}`,
        'Ask open-ended questions to understand their perspective',
        'Listen more than you speak',
        'Confirm understanding: "Let me make sure I understand..."',
        'Suggest moving to the next topic when appropriate',
        'Check if there are any questions or concerns',
        'Summarize key points discussed so far',
        'Ask for their thoughts on what you\'ve shared'
    ];
    
    // Combine suggestions, prioritizing contextual ones
    return contextualSuggestions.length > 0 ? 
           [...contextualSuggestions, ...generalSuggestions] : 
           generalSuggestions;
}

/**
 * Stop mock AI suggestions
 * ✨ Sprint 4.1: Updated to stop real AI coaching
 */
function stopMockAI() {
    // ✨ Sprint 4.1: Stop real AI coaching
    stopAICoaching();
    
    if (mockInterval) {
        clearInterval(mockInterval);
        mockInterval = null;
    }
}

/**
 * ✨ LEGACY: Start audio transcription simulation (fallback only)
 * Only used when real transcription is not available
 */
function startAudioTranscriptionSimulation() {
    if (!output) return;
    
    // Start transcription simulation every 5 seconds
    transcriptionInterval = setInterval(() => {
        simulateTranscription();
    }, 5000);

    addAIMessage('🎤 Audio transcription started (simulation mode)...');
    console.log('🎤 Audio transcription simulation started as fallback');
}

/**
 * ✨ LEGACY: Start audio transcription (for backward compatibility)
 * Now acts as a wrapper that chooses between real and simulated transcription
 * @param {MediaStream} micStream - The host's microphone stream
 */
export function startAudioTranscription(micStream) {
    // Only run for hosts with AI Assist enabled
    if (!userState.isHost || !userState.aiAssistEnabled) {
        return;
    }

    // Set the host stream
    setHostStream(micStream);

    console.log('🎤 Audio transcription started via legacy method');
}

/**
 * ✨ Phase III: Stop audio transcription simulation
 * Cleans up audio processing and stops transcription
 */
export function stopAudioTranscription() {
    // Clear transcription interval
    if (transcriptionInterval) {
        clearInterval(transcriptionInterval);
        transcriptionInterval = null;
    }

    // Clean up MediaRecorder
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
            mediaRecorder.stop();
            console.log('📹 Audio recording stopped');
        } catch (error) {
            console.warn('Error stopping MediaRecorder:', error);
        }
    }
    mediaRecorder = null;

    console.log('🎤 Audio transcription simulation stopped');
}

/**
 * ✨ LEGACY: Simulate transcription output (fallback only)
 * Generates mock transcribed text and adds it to the AI output
 */
function simulateTranscription() {
    if (!output) return;

    const mockTranscriptions = [
        "Hello, how are you doing today?",
        "Let me share my screen to show you this presentation.",
        "I think we should focus on the main deliverables for this project.",
        "Can you hear me clearly? The audio seems a bit choppy.",
        "That's a great point about the user experience design.",
        "We need to schedule a follow-up meeting to discuss the budget.",
        "I'm taking notes on the key action items we've covered.",
        "The deadline for this phase is next Friday, correct?",
        "Let me clarify the requirements before we move forward.",
        "I appreciate everyone's input on this important decision.",
        `Regarding ${userState.aiPrompt || 'the main topic'}, I wanted to add...`,
        "Should we involve the marketing team in this discussion?",
        "The technical approach looks solid from my perspective.",
        "I'll send out a summary email after this call.",
        "Are there any questions before we wrap up?"
    ];

    const randomTranscription = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
    const timestamp = new Date().toLocaleTimeString();
    
    // Alternate between Host and Visitor for simulation
    const speaker = Math.random() > 0.5 ? 'Host' : 'Visitor';
    const speakerIcon = speaker === 'Host' ? '🎙️' : '👤';
    
    addTranscriptionMessage({
        isHost: speaker === 'Host',
        text: `${speakerIcon} ${speaker} (simulated, ${timestamp}): "${randomTranscription}"`,
        timestamp: timestamp,
        simulated: true
    });
}

/**
 * Add AI message to output area
 * @param {string} message - The message to display
 */
function addAIMessage(message) {
    if (!output) return;
    
    const msg = document.createElement('div');
    msg.className = 'ai-message';
    msg.textContent = message;
    output.appendChild(msg);
    output.scrollTop = output.scrollHeight;
}

/**
 * Add a transcription message to the AI output
 * ✨ Sprint 4.1: Also adds to transcript buffer for AI coaching
 * @param {Object} message - Transcription message object
 */
function addTranscriptionMessage(message) {
    if (!output) return;
    
    // ✨ Sprint 4.1: Add to transcript buffer for AI coaching
    const speaker = message.isHost ? 'Host' : 'Visitor';
    addToTranscriptBuffer(speaker, message.text);
    
    const messageElement = document.createElement('div');
    messageElement.className = `transcript-message ${message.isHost ? 'host-message' : 'visitor-message'}${message.simulated ? ' simulated' : ''}`;
    
    messageElement.innerHTML = `
        <div class="timestamp">${message.timestamp}</div>
        <div class="message">${message.isHost ? '🙋‍♂️' : '👤'} ${message.text}</div>
    `;
    
    output.appendChild(messageElement);
    output.scrollTop = output.scrollHeight;
}

/**
 * Show AI assist panel (host-only)
 * Called when entering video chat as host or room-created screen
 */
export function showAIAssist() {
    if (!userState.isHost) return;

    // Show waiting container on room-created screen
    if (waitingContainer && window.location.pathname === '/' && window.location.search.includes('room')) {
        waitingContainer.style.display = 'block';
    }

    // Show active container on video chat screen
    if (container) {
        container.style.display = 'block';
        
        // Sync state from waiting screen to active screen
        if (toggle && waitingToggle) {
            toggle.checked = waitingToggle.checked;
        }
        if (promptInput && waitingPromptInput) {
            promptInput.value = waitingPromptInput.value;
        }
        
        // Apply current state if already enabled
        userState.aiAssistEnabled = toggle ? toggle.checked : false;
        userState.aiPrompt = promptInput ? promptInput.value : '';
    }
}

/**
 * Hide AI assist panel
 * Called when leaving video chat or switching to visitor mode
 */
export function hideAIAssist() {
    // Hide both containers
    if (container) container.style.display = 'none';
    if (waitingContainer) waitingContainer.style.display = 'none';
    
    // Stop all AI functionality
    stopMockAI();
}

/**
 * Clean up AI Assist resources
 * Called when call ends or connection is reset
 * ✨ Sprint 4.1: Added transcript buffer cleanup
 */
export function cleanupAIAssist() {
    console.log('🧹 Cleaning up AI Assist resources');
    
    // ✨ Sprint 4.1: Stop AI coaching and clear transcript
    stopAICoaching();
    clearTranscriptBuffer();
    
    // Stop any active AI suggestions
    if (mockInterval) {
        clearInterval(mockInterval);
        mockInterval = null;
    }
    
    // ✨ Phase III: Stop all transcriptions (real and simulation)
    stopAllTranscriptions();
    stopAudioTranscription();
    
    // Reset AI assist state
    userState.aiAssistEnabled = false;
    
    // Clear output
    if (output) {
        output.innerHTML = '';
    }
    
    console.log('✅ AI Assist cleanup completed');
}

/**
 * ✨ Sprint 4.1: Test function to populate transcript buffer with sample conversation
 * This helps test the AI coaching system during development
 */
export function testTranscriptBuffer() {
    console.log('🧪 Populating transcript buffer with test data');
    
    // Sample conversation for testing
    const testConversation = [
        { speaker: 'Host', text: 'Hi, thanks for taking the time to meet with me today.', delay: 1000 },
        { speaker: 'Visitor', text: 'Of course! I\'m excited to learn more about what you have to offer.', delay: 2000 },
        { speaker: 'Host', text: 'Great! So tell me a bit about your current situation and what challenges you\'re facing.', delay: 3000 },
        { speaker: 'Visitor', text: 'Well, we\'re struggling with our current solution. It\'s expensive and doesn\'t really meet our needs.', delay: 4000 },
        { speaker: 'Host', text: 'I understand. Cost and functionality are definitely important factors. What specific features are you missing?', delay: 5000 },
        { speaker: 'Visitor', text: 'We need better reporting and the ability to integrate with our existing systems.', delay: 6000 }
    ];
    
    // Add each message with realistic timing
    testConversation.forEach((entry, index) => {
        setTimeout(() => {
            addToTranscriptBuffer(entry.speaker, entry.text);
            
            // Show in the transcript display too
            addTranscriptionMessage({
                isHost: entry.speaker === 'Host',
                text: entry.text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                simulated: true
            });
        }, entry.delay);
    });
    
    console.log('🧪 Test transcript data scheduled');
}

// Expose test function globally for development
if (typeof window !== 'undefined') {
    window.testTranscriptBuffer = testTranscriptBuffer;
} 