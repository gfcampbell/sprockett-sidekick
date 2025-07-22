// client/sessionLogger.js
// Call session logging for Oblivn WebRTC app
// Tracks session start/end and TURN usage for billing

import { supabase } from './supabaseClient.js';

// =============================================
// TOKEN BILLING CONFIGURATION
// =============================================

/**
 * Token cost rules per minute based on mode and TURN usage
 * Aligned with PRD pricing structure
 */
const TOKEN_RATES = {
    voice: {
        noTurn: 1,    // 1 token per minute
        withTurn: 2   // 2 tokens per minute
    },
    video: {
        noTurn: 2,    // 2 tokens per minute  
        withTurn: 6   // 6 tokens per minute
    }
};

// =============================================
// TOKEN CALCULATION FUNCTIONS
// =============================================

/**
 * Calculates token cost based on session duration, mode, and TURN usage
 * @param {number} durationSeconds - Session duration in seconds
 * @param {string} mode - Call mode ('video' or 'voice-only')
 * @param {boolean} usedTurn - Whether TURN servers were used
 * @returns {number} Token count (rounded up to nearest minute)
 */
export const calculateTokens = (durationSeconds, mode, usedTurn) => {
    if (durationSeconds <= 0) {
        return 0;
    }

    // Round up to nearest full minute
    const durationMinutes = Math.ceil(durationSeconds / 60);
    
    // Determine mode key for token rates
    const modeKey = mode === 'voice-only' ? 'voice' : 'video';
    const turnKey = usedTurn ? 'withTurn' : 'noTurn';
    
    // Get rate from configuration
    const ratePerMinute = TOKEN_RATES[modeKey][turnKey];
    const totalTokens = durationMinutes * ratePerMinute;
    
    console.log(`💰 Token calculation: ${durationMinutes}min × ${ratePerMinute} tokens/min = ${totalTokens} tokens`);
    console.log(`📊 Session details: Mode=${mode}, TURN=${usedTurn}, Duration=${durationSeconds}s`);
    
    return totalTokens;
};

/**
 * Burns tokens from user account and logs usage
 * @param {string} userId - User identifier
 * @param {string} sessionId - Session identifier
 * @param {number} tokenCount - Number of tokens to burn
 * @param {string} mode - Call mode ('video' or 'voice-only')
 * @param {boolean} usedTurn - Whether TURN servers were used
 * @param {number} durationSeconds - Session duration in seconds
 * @returns {Promise<boolean>} Success status
 */
export const burnTokens = async (userId, sessionId, tokenCount, mode, usedTurn, durationSeconds) => {
    console.log(`💳 Attempting to burn ${tokenCount} tokens for user ${userId}`);
    
    if (!supabase) {
        console.warn('⚠️ Supabase not available - skipping token burn');
        return false;
    }

    if (tokenCount <= 0) {
        console.log('✅ No tokens to burn (zero duration session)');
        return true;
    }

    // 🆕 Handle anonymous users - skip billing but allow calls
    if (userId.startsWith('anonymous_')) {
        console.log('ℹ️ Anonymous user detected - skipping token billing');
        return true;
    }

    try {
        // Step 1: Check current token balance
        const { data: userAccount, error: fetchError } = await supabase
            .from('user_accounts')
            .select('tokens_remaining')
            .eq('user_id', userId)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                console.warn(`⚠️ User account not found for ${userId} - allowing call to complete`);
                return false;
            }
            throw fetchError;
        }

        const currentBalance = userAccount.tokens_remaining;
        console.log(`💰 Current token balance: ${currentBalance}`);

        // Step 2: Check if user has enough tokens
        if (currentBalance < tokenCount) {
            console.warn(`⚠️ Insufficient tokens: Need ${tokenCount}, have ${currentBalance} - allowing call to complete`);
            // Don't block the call, but still log usage for billing purposes
        }

        // Step 3: Calculate new balance (can go negative for billing purposes)
        const newBalance = Math.max(0, currentBalance - tokenCount);
        
        // Step 4: Update user balance
        const { error: updateError } = await supabase
            .from('user_accounts')
            .update({ tokens_remaining: newBalance })
            .eq('user_id', userId);

        if (updateError) {
            throw updateError;
        }

        // Step 5: Log token usage
        // Normalize mode for database (expects 'voice' or 'video')
        const normalizedMode = mode === 'voice-only' ? 'voice' : 'video';
        
        const { error: logError } = await supabase
            .from('token_usage')
            .insert({
                user_id: userId,
                session_id: sessionId,
                tokens_used: tokenCount,
                timestamp: new Date().toISOString(),
                mode: normalizedMode,
                used_turn: usedTurn,
                duration_seconds: durationSeconds
            });

        if (logError) {
            throw logError;
        }

        console.log(`✅ Token burn successful: ${tokenCount} tokens deducted`);
        console.log(`💰 New balance: ${newBalance} tokens`);
        
        return true;

    } catch (error) {
        console.error('❌ Error burning tokens:', error);
        console.warn('⚠️ Token burn failed - allowing call to complete');
        return false;
    }
};

// =============================================
// SESSION DETECTION FUNCTIONS  
// =============================================

/**
 * Detects if TURN servers are being used in the WebRTC connection
 * @param {RTCPeerConnection} peerConnection - Active peer connection
 * @returns {Promise<boolean>} True if using TURN relay servers
 */
const detectTurnUsage = async (peerConnection) => {
    if (!peerConnection) {
        console.warn('⚠️ No peer connection available for TURN detection');
        return false;
    }

    try {
        const stats = await peerConnection.getStats();
        let usingTurn = false;

        // Find the selected candidate pair
        let selectedCandidatePairId = null;
        stats.forEach(report => {
            if (report.type === 'transport') {
                selectedCandidatePairId = report.selectedCandidatePairId;
            }
        });

        if (!selectedCandidatePairId) {
            console.log('📊 No selected candidate pair found yet');
            return false;
        }

        // Get candidate pair details
        let localCandidateId = null;
        let remoteCandidateId = null;
        stats.forEach(report => {
            if (report.type === 'candidate-pair' && report.id === selectedCandidatePairId) {
                localCandidateId = report.localCandidateId;
                remoteCandidateId = report.remoteCandidateId;
            }
        });

        // Check if either candidate is a relay (TURN)
        stats.forEach(report => {
            if (report.id === localCandidateId || report.id === remoteCandidateId) {
                if (report.candidateType === 'relay') {
                    usingTurn = true;
                }
            }
        });

        console.log(`📊 TURN usage detected: ${usingTurn}`);
        return usingTurn;

    } catch (error) {
        console.error('❌ Error detecting TURN usage:', error);
        return false;
    }
};

// =============================================
// SESSION MANAGEMENT FUNCTIONS
// =============================================

// Track sessions that have already been ended to prevent double billing
const endedSessions = new Set();

/**
 * Starts a new call session
 * @param {string} userId - User identifier
 * @param {string} roomId - Room identifier  
 * @param {string} mode - Call mode ('video' or 'voice-only')
 * @param {RTCPeerConnection} peerConnection - WebRTC peer connection
 * @returns {Promise<string|null>} Session ID if successful
 */
export const startSession = async (userId, roomId, mode = 'video', peerConnection = null) => {
    console.log(`🎬 Starting session - User: ${userId}, Room: ${roomId}, Mode: ${mode}`);
    
    if (!supabase) {
        console.warn('⚠️ Supabase not available - skipping session logging');
        return null;
    }

    try {
        // Detect TURN usage if peer connection is available
        const usingTurn = peerConnection ? await detectTurnUsage(peerConnection) : false;

        const sessionData = {
            room_id: roomId,
            user_id: userId,
            mode: mode,
            used_turn: usingTurn,
            start_time: new Date().toISOString(),
            credit_cost: 0.00 // Will be calculated later based on duration and TURN usage
        };

        const { data, error } = await supabase
            .from('call_sessions')
            .insert(sessionData)
            .select('id')
            .single();

        if (error) {
            console.error('❌ Failed to start session:', error);
            return null;
        }

        console.log(`✅ Session started successfully - ID: ${data.id}`);
        return data.id;

    } catch (error) {
        console.error('❌ Error starting session:', error);
        return null;
    }
};

/**
 * Ends a call session, calculates duration, and processes token billing
 * @param {string} sessionId - Session ID to end
 * @param {RTCPeerConnection} peerConnection - WebRTC peer connection for final TURN check
 * @returns {Promise<boolean>} Success status
 */
export const endSession = async (sessionId, peerConnection = null) => {
    console.log(`🎬 Ending session - ID: ${sessionId}`);
    
    if (!supabase || !sessionId) {
        console.warn('⚠️ Supabase not available or no session ID - skipping session end');
        return false;
    }

    // 🆕 PREVENT DOUBLE BILLING: Check if session already ended
    if (endedSessions.has(sessionId)) {
        console.log(`⚠️ Session ${sessionId} already ended - preventing double billing`);
        return true; // Return success since session was already properly ended
    }

    // 🆕 MARK SESSION AS ENDING: Add to set immediately to prevent race conditions
    endedSessions.add(sessionId);

    try {
        // Get final TURN usage status
        const finalTurnUsage = peerConnection ? await detectTurnUsage(peerConnection) : false;
        
        const endTime = new Date().toISOString();

        // Step 1: Update session with end time and final TURN status
        const { data: sessionData, error: updateError } = await supabase
            .from('call_sessions')
            .update({ 
                end_time: endTime,
                used_turn: finalTurnUsage // Update with final TURN status
            })
            .eq('id', sessionId)
            .select('*')
            .single();

        if (updateError) {
            console.error('❌ Failed to end session:', updateError);
            // Remove from set since ending failed
            endedSessions.delete(sessionId);
            return false;
        }

        console.log('✅ Session ended successfully:', sessionData);

        // Step 2: Calculate session duration and token cost
        const startTime = new Date(sessionData.start_time);
        const endTimeDate = new Date(endTime);
        const durationSeconds = Math.floor((endTimeDate - startTime) / 1000);
        
        console.log(`⏱️ Session duration: ${durationSeconds} seconds`);

        // Step 3: Calculate tokens and process billing
        const tokenCost = calculateTokens(durationSeconds, sessionData.mode, finalTurnUsage);
        
        // Step 4: Burn tokens from user account
        const billingSuccess = await burnTokens(sessionData.user_id, sessionId, tokenCost, sessionData.mode, finalTurnUsage, durationSeconds);

        // 🆕 CLEANUP: Remove from set after successful completion (keep for a short time to prevent immediate re-entry)
        setTimeout(() => {
            endedSessions.delete(sessionId);
        }, 5000); // Keep for 5 seconds to prevent race conditions

        return billingSuccess;

    } catch (error) {
        console.error('❌ Error ending session:', error);
        // Remove from set since ending failed
        endedSessions.delete(sessionId);
        return false;
    }
}; 