// Session billing logic ported from deprecated_client/sessionLogger.js
// Adapted for coaching sessions (1 token per minute)
import { supabase } from './supabaseClient';

// Token rates for coaching sessions
const TOKEN_RATES = {
  coaching: {
    rate: 1 // 1 token per minute
  }
};

export interface SessionInfo {
  sessionId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  mode: 'voice-only';
}


/**
 * Creates a new coaching session record - returns auto-generated UUID
 */
export async function startSession(userId: string): Promise<string> {
  try {
    console.log(`💰 [${new Date().toISOString()}] Starting session for user ${userId}`);
    
    // Let database auto-generate UUID for id field (like deprecated client)
    const { data, error } = await supabase
      .from('call_sessions')
      .insert({
        user_id: userId,
        room_id: `coaching_${Date.now()}`,
        start_time: new Date().toISOString(),
        mode: 'voice-only',
        used_turn: false,
        credit_cost: 0.00
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ Error creating session record:', error);
      throw error;
    }

    const sessionId = data.id;
    console.log(`✅ Session ${sessionId} started successfully`);
    return sessionId;
  } catch (error) {
    console.error('❌ Exception starting session:', error);
    throw error;
  }
}

/**
 * Ends a coaching session and calculates token usage
 * Ported directly from deprecated_client/sessionLogger.js burnTokens()
 */
export async function endSession(
  userId: string, 
  sessionId: string, 
  startTime: number,
  endTime: number = Date.now()
): Promise<number> {
  try {
    console.log(`💰 [${new Date().toISOString()}] Ending session ${sessionId} for user ${userId}`);
    
    // Calculate session duration in minutes (rounded up)
    const durationMs = endTime - startTime;
    const durationMinutes = Math.ceil(durationMs / 60000); // Round up to nearest minute
    const tokenCount = durationMinutes * TOKEN_RATES.coaching.rate;
    
    console.log(`💰 Session duration: ${durationMs}ms (${durationMinutes} minutes)`);
    console.log(`💰 Token cost: ${tokenCount} tokens (${TOKEN_RATES.coaching.rate} per minute)`);

    // Step 1: Update session end time
    const { error: sessionError } = await supabase
      .from('call_sessions')
      .update({
        end_time: new Date(endTime).toISOString(),
        credit_cost: tokenCount * 0.10 // Rough cost estimate (10¢ per token)
      })
      .eq('id', sessionId);

    if (sessionError) {
      console.error('❌ Error updating session:', sessionError);
    }

    // Step 2: Get current user token balance
    const { data: userAccount, error: balanceError } = await supabase
      .from('user_accounts')
      .select('tokens_remaining')
      .eq('user_id', userId)
      .single();

    if (balanceError) {
      console.error('❌ Error fetching user balance:', balanceError);
      // Log usage anyway for billing purposes
      await logTokenUsage(userId, sessionId, tokenCount, durationMs / 1000);
      return tokenCount;
    }

    const currentBalance = userAccount?.tokens_remaining || 0;
    console.log(`💰 Current balance: ${currentBalance} tokens`);

    // Step 3: Check if user has enough tokens (but don't block)
    if (currentBalance < tokenCount) {
      console.warn(`⚠️ Insufficient tokens: Need ${tokenCount}, have ${currentBalance} - allowing session to complete`);
      // Don't block the session, but still log usage for billing purposes
    }

    // Step 4: Calculate new balance (can't go below 0)
    const newBalance = Math.max(0, currentBalance - tokenCount);
    console.log(`💰 New balance: ${newBalance} tokens (deducted ${Math.min(tokenCount, currentBalance)})`);

    // Step 5: Update user token balance
    const { error: updateError } = await supabase
      .from('user_accounts')
      .update({ tokens_remaining: newBalance })
      .eq('user_id', userId);

    if (updateError) {
      console.error('❌ Error updating user balance:', updateError);
      throw updateError;
    }

    // Step 6: Log token usage for billing/analytics
    await logTokenUsage(userId, sessionId, tokenCount, durationMs / 1000);

    console.log(`✅ Session ${sessionId} ended successfully. Tokens deducted: ${Math.min(tokenCount, currentBalance)}`);
    return tokenCount;

  } catch (error) {
    console.error('❌ Exception ending session:', error);
    // Still try to log usage for billing
    try {
      const durationMs = endTime - startTime;
      const durationMinutes = Math.ceil(durationMs / 60000);
      const tokenCount = durationMinutes * TOKEN_RATES.coaching.rate;
      await logTokenUsage(userId, sessionId, tokenCount, durationMs / 1000);
    } catch (logError) {
      console.error('❌ Failed to log usage after session error:', logError);
    }
    throw error;
  }
}

/**
 * Logs token usage to the database for billing/analytics
 */
async function logTokenUsage(
  userId: string,
  sessionId: string,
  tokensUsed: number,
  durationSeconds: number
): Promise<void> {
  try {
    const { error } = await supabase
      .from('token_usage')
      .insert({
        user_id: userId,
        session_id: sessionId,
        tokens_used: tokensUsed,
        timestamp: new Date().toISOString(),
        mode: 'voice-only',
        used_turn: false, // Not applicable for coaching
        duration_seconds: Math.round(durationSeconds)
      });

    if (error) {
      console.error('❌ Error logging token usage:', error);
      throw error;
    }

    console.log(`✅ Token usage logged: ${tokensUsed} tokens for ${Math.round(durationSeconds)}s session`);
  } catch (error) {
    console.error('❌ Exception logging token usage:', error);
    throw error;
  }
}

/**
 * Gets session cost estimate for UI display
 */
export function getSessionCostEstimate(durationMs: number): number {
  const durationMinutes = Math.ceil(durationMs / 60000);
  return durationMinutes * TOKEN_RATES.coaching.rate;
}

/**
 * Formats session duration for display
 */
export function formatSessionDuration(durationMs: number): string {
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Gets token cost per minute rate
 */
export function getTokenRate(): number {
  return TOKEN_RATES.coaching.rate;
}