/**
 * AI Coaching System for Desktop App
 * Ported from Sprockett's sophisticated real-time coaching system
 * Maintains all the original prompt engineering and logic
 */

import { TranscriptMessage } from './audioCapture';

// =============================================
// USE CASE DEFINITIONS (from Sprockett)
// =============================================

export const CONVERSATION_TYPES = {
  'persuade': {
    title: 'The Strategist',
    description: 'Helps you influence others with clarity and purpose',
    systemContext: `You are an expert persuasion coach using STATE method principles. Track progress from skepticism to agreement. Focus on:
    - Objections raised → addressed with facts and empathy
    - Skepticism → interest signals and consideration
    - "No/But" language → "Yes/And" language shifts  
    - Questions showing genuine consideration
    - Share facts, Tell story tentatively, Ask for others' paths`
  },
  'connect': {
    title: 'The Connector',
    description: 'Guides you in building trust and rapport',
    systemContext: `You are an expert relationship coach using STATE method principles. Track connection depth building. Focus on:
    - Personal information exchanged and reciprocated
    - Shared experiences discovered and explored
    - Future plans mentioned together
    - Comfort indicators (humor, informal language, openness)
    - Encourage testing and Talk tentatively about personal matters`
  },
  'resolve': {
    title: 'The Mediator',
    description: 'Assists in navigating sensitive disagreements',
    systemContext: `You are an expert conflict resolution coach using STATE method principles. Track movement from conflict to resolution. Focus on:
    - Problem acknowledged by both sides
    - Emotions de-escalated through empathy
    - Common ground and shared purposes identified
    - Solutions proposed and accepted by both parties
    - Ask for others' paths and Encourage testing of solutions`
  },
  'information': {
    title: 'The Researcher',
    description: 'Focuses on asking the right questions and listening',
    systemContext: `You are an expert information gathering coach using STATE method principles. Track information acquisition progress. Focus on:
    - Questions asked → answered with useful details
    - Topic depth explored through follow-up questions
    - Clarifications received and understood
    - Key insights captured and confirmed
    - Ask for others' paths and Share facts to encourage reciprocity`
  },
  'impression': {
    title: 'The Coach',
    description: 'Helps you show up with confidence and authenticity',
    systemContext: `You are an expert impression management coach using STATE method principles. Track positive response indicators. Focus on:
    - Positive responses and engaged reactions
    - Follow-up questions showing interest in you
    - Interest in future contact or collaboration
    - Compliments, validation, or positive acknowledgments
    - Tell story tentatively and Talk tentatively to avoid appearing arrogant`
  },
  'agreement': {
    title: 'The Diplomat',
    description: 'Supports finding common ground and alignment',
    systemContext: `You are an expert agreement facilitation coach using STATE method principles. Track progress toward mutual commitment. Focus on:
    - Positions stated → understood by both parties
    - Trade-offs and compromises discussed openly
    - Terms clarified and confirmed by both sides
    - Commitment language and next steps established
    - Encourage testing of agreements and Ask for others' paths to consensus`
  }
};

// =============================================
// COACHING CONFIGURATION
// =============================================

const COACHING_CONFIG = {
  INTERVAL_MS: 15000,           // Send coaching request every 15 seconds
  TRANSCRIPT_WINDOW_MS: 60000,  // Use last 60 seconds of transcript
  MAX_TRANSCRIPT_CHARS: 2000    // Limit transcript length for API efficiency
};

// =============================================
// INTERFACES
// =============================================

export interface CallConfig {
  conversationType: keyof typeof CONVERSATION_TYPES | '';
  goal: string;
  context: string;
}

export interface CoachingSuggestion {
  id: string;
  content: string;
  timestamp: Date;
  isStreaming: boolean;
}

export interface ConversationTemperature {
  level: number; // 1-5 scale (1=cold, 5=hot)
  trend: 'warming' | 'cooling' | 'stable';
  indicators: string[];
}

export interface ConversationAnalytics {
  energy: {
    level: number; // 1-5 scale (1=low, 5=high)
    trend: 'rising' | 'falling' | 'stable';
    indicators: string[];
  };
  agreeability: {
    level: number; // 1-5 scale (1=disagreeable, 5=very agreeable)
    trend: 'improving' | 'declining' | 'stable';
    indicators: string[];
  };
  goalProgress: {
    percentage: number; // 0-100% progress toward stated goal
    trend: 'advancing' | 'stalling' | 'regressing';
    indicators: string[];
  };
}

// =============================================
// AI COACHING CLASS
// =============================================

export class DesktopAICoaching {
  private coachingInterval: number | null = null;
  private isActive = false;
  // private lastCoachingRequest = 0; // Reserved for rate limiting
  private callConfig: CallConfig;
  private apiUrl: string;
  private onSuggestionCallback?: (suggestion: CoachingSuggestion) => void;
  private onErrorCallback?: (error: string) => void;
  private onTemperatureCallback?: (temp: ConversationTemperature) => void;
  private onAnalyticsCallback?: (analytics: ConversationAnalytics) => void;

  constructor(callConfig: CallConfig, apiUrl: string) {
    this.callConfig = callConfig;
    this.apiUrl = apiUrl;
  }

  /**
   * Starts the AI coaching system
   */
  start(): void {
    if (this.isActive) return;
    
    this.isActive = true;
    console.log('🤖 AI Coaching started - requesting suggestions every', COACHING_CONFIG.INTERVAL_MS / 1000, 'seconds');
    
    // Start periodic coaching requests
    this.coachingInterval = window.setInterval(async () => {
      await this.requestCoachingSuggestion();
    }, COACHING_CONFIG.INTERVAL_MS) as number;
    
    // Send initial request after a short delay to let conversation start
    setTimeout(async () => {
      await this.requestCoachingSuggestion();
    }, 5000);
  }

  /**
   * Stops the AI coaching system
   */
  stop(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    if (this.coachingInterval) {
      clearInterval(this.coachingInterval);
      this.coachingInterval = null;
    }
    
    console.log('🤖 AI Coaching stopped');
  }

  /**
   * Updates the call configuration
   */
  updateConfig(newConfig: CallConfig): void {
    this.callConfig = newConfig;
  }

  /**
   * Set callback for coaching suggestions
   */
  onSuggestion(callback: (suggestion: CoachingSuggestion) => void): void {
    this.onSuggestionCallback = callback;
  }

  /**
   * Set callback for errors
   */
  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * Set callback for temperature updates
   */
  onTemperature(callback: (temp: ConversationTemperature) => void): void {
    this.onTemperatureCallback = callback;
  }

  /**
   * Set callback for conversation analytics
   */
  onAnalytics(callback: (analytics: ConversationAnalytics) => void): void {
    this.onAnalyticsCallback = callback;
  }

  /**
   * Requests a coaching suggestion from the AI
   */
  private async requestCoachingSuggestion(): Promise<void> {
    try {
      // Check if transcript messages are available
      const transcriptMessages = this.getTranscriptMessages();
      if (!transcriptMessages || transcriptMessages.length === 0) {
        console.log('ℹ️ Skipping coaching request - transcript messages not available yet');
        return;
      }
      
      // Get recent transcript from the app's transcript buffer
      const transcript = this.getRecentTranscript();
      
      // Skip if no meaningful transcript available
      if (!transcript || transcript.length < 50) {
        console.log('ℹ️ Skipping coaching request - insufficient transcript content:', transcript.length, 'chars');
        return;
      }
      
      // Build the coaching prompt
      const promptPayload = this.buildCoachingPrompt(transcript);
      
      // Send to coaching API
      await this.sendToCoachAPI(promptPayload);
      
      // this.lastCoachingRequest = Date.now(); // Reserved for rate limiting
      
    } catch (error) {
      console.error('❌ Error requesting coaching suggestion:', error);
      this.handleError(`Failed to get AI suggestions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets recent transcript from global transcript messages
   */
  private getRecentTranscript(): string {
    // In desktop app, we'll get this from React state passed to the coaching system
    const transcriptMessages = this.getTranscriptMessages();
    
    if (!transcriptMessages || transcriptMessages.length === 0) {
      return '';
    }
    
    const now = Date.now();
    const cutoff = now - COACHING_CONFIG.TRANSCRIPT_WINDOW_MS;
    
    // Filter to recent entries and format
    const recentEntries = transcriptMessages
      .filter(entry => entry.timestamp.getTime() > cutoff)
      .slice(-20); // Limit to last 20 entries for performance
    
    if (recentEntries.length === 0) {
      return '';
    }
    
    // 🫀 HEART TRANSPLANT: Use physics-based speaker identification
    let formattedTranscript = recentEntries
      .map(entry => {
        // Now we have guaranteed accurate speaker identification
        const label = entry.speaker === 'Host' ? '🙋‍♂️ You' : '👤 Guest';
        return `${label}: "${entry.text}"`;
      })
      .join('\n');
    
    // Truncate if too long
    if (formattedTranscript.length > COACHING_CONFIG.MAX_TRANSCRIPT_CHARS) {
      formattedTranscript = formattedTranscript.substring(0, COACHING_CONFIG.MAX_TRANSCRIPT_CHARS) + '...';
    }
    
    return formattedTranscript;
  }

  /**
   * Builds the complete coaching prompt for the AI (from Sprockett)
   */
  private buildCoachingPrompt(transcript: string) {
    // Build system prompt with use case context
    const systemPrompt = this.buildSystemPrompt();
    
    // Build user message with context and transcript
    const userMessage = `CURRENT CONVERSATION (last 60 seconds):
${transcript}

HOST'S GOAL: ${this.callConfig.goal || 'Build connection and communicate effectively'}

Analyze this moment and provide ratings + coaching insight.`;

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
      max_tokens: 60,
      temperature: 0.7,
      stream: true
    };
  }

  /**
   * Builds the system prompt with use case and goal context (from Sprockett)
   */
  private buildSystemPrompt(): string {
    // Base system directive (consistent across all calls)
    const basePrompt = `You are an elite real-time coaching assistant for professional conversations. Think of yourself as a perceptive, emotionally intelligent confidante — warm like a close friend, sharp like a world-class communication coach. Your job is to analyze subtle cues and patterns in the conversation and deliver short but transformative insights.

Your purpose:
- Detect specific emotional shifts, energy changes, or social cues in the last 60 seconds
- Reference what actually happened (words, tone, silence, pacing, energy)
- Offer one precise coaching insight that helps the host improve clarity, connection, or influence
- Always frame the coaching as a whisper from a trusted advisor — never robotic, obvious, or judgmental

⚠️ Keep responses short: 12–15 words max  
🎯 Use this structure: [What you picked up on] → [What to say/do about it]  
✅ Focus ONLY on coaching the HOST (🙋‍♂️ You) based on transcript

You will also rate the moment using the following scale:
1. Warmth (1–5): 1=cold, 5=very warm
2. Guest Energy (1–5): 1=flat, 5=high
3. Guest Agreeability (1–5): 1=resistant, 5=very open
4. Goal Progress (0–100): How close is the host to achieving their stated goal?
5. Coaching Comment (max 15 words): Insightful, situational, friendly

Transcript Formatting:
- 🙋‍♂️ You = Host (being coached)
- 👤 Guest = Other speaker

Your output format:

TEMP:[Warmth] ENERGY:[Energy] AGREE:[Agreeability] GOAL:[0–100] 🤖 [Coaching Insight (12–15 words)]`;

    // Add use case specific context if selected
    let useCaseContext = '';
    if (this.callConfig.conversationType && CONVERSATION_TYPES[this.callConfig.conversationType]) {
      useCaseContext = `\n\nSITUATION CONTEXT:\n${CONVERSATION_TYPES[this.callConfig.conversationType].systemContext}`;
    }

    // Add user's specific goal
    let goalContext = '';
    if (this.callConfig.goal && this.callConfig.goal.trim()) {
      goalContext = `\n\nHOST'S GOAL: ${this.callConfig.goal.trim()}`;
    }

    // Add relevant background context
    let backgroundContext = '';
    if (this.callConfig.context && this.callConfig.context.trim()) {
      backgroundContext = `\n\nRELEVANT CONTEXT: ${this.callConfig.context.trim()}`;
    }

    return basePrompt + useCaseContext + goalContext + backgroundContext;
  }

  /**
   * Sends coaching request to server API and streams response (from Sprockett)
   */
  private async sendToCoachAPI(promptPayload: any): Promise<void> {
    try {
      const response = await fetch(this.apiUrl, {
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
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }
      
      const decoder = new TextDecoder();
      
      let suggestion = '';
      let isFirstChunk = true;
      const suggestionId = `coaching_${Date.now()}`;
      
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
                
                // Parse all metrics from AI response
                const tempMatch = suggestion.match(/TEMP:(\d)/);
                const energyMatch = suggestion.match(/ENERGY:(\d)/);
                const agreeMatch = suggestion.match(/AGREE:(\d)/);
                const goalMatch = suggestion.match(/GOAL:(\d+)/);
                
                const tempLevel = tempMatch ? parseInt(tempMatch[1]) : 3;
                const energyLevel = energyMatch ? parseInt(energyMatch[1]) : 3;
                const agreeLevel = agreeMatch ? parseInt(agreeMatch[1]) : 3;
                const goalProgress = goalMatch ? parseInt(goalMatch[1]) : 50;
                
                // Extract coaching tip (remove all metric tags)
                let coachingTip = suggestion.replace(/TEMP:\d+\s*/g, '').replace(/ENERGY:\d+\s*/g, '').replace(/AGREE:\d+\s*/g, '').replace(/GOAL:\d+\s*/g, '');
                // Also remove any remaining patterns like "🤖 " at start
                coachingTip = coachingTip.replace(/^[^a-zA-Z]*/, '').trim();
                
                // Update temperature
                if (this.onTemperatureCallback) {
                  this.onTemperatureCallback({
                    level: tempLevel,
                    trend: 'stable', // TODO: compare with previous
                    indicators: []
                  });
                }
                
                // Update analytics
                if (this.onAnalyticsCallback) {
                  this.onAnalyticsCallback({
                    energy: {
                      level: energyLevel,
                      trend: 'stable', // TODO: compare with previous
                      indicators: []
                    },
                    agreeability: {
                      level: agreeLevel,
                      trend: 'stable', // TODO: compare with previous
                      indicators: []
                    },
                    goalProgress: {
                      percentage: goalProgress,
                      trend: 'advancing', // TODO: compare with previous
                      indicators: []
                    }
                  });
                }
                
                // Show coaching suggestion
                if (this.onSuggestionCallback) {
                  this.onSuggestionCallback({
                    id: suggestionId,
                    content: coachingTip,
                    timestamp: new Date(),
                    isStreaming: !isFirstChunk
                  });
                }
                
                isFirstChunk = false;
              }
            } catch (parseError) {
              // Skip malformed JSON chunks
              continue;
            }
          }
        }
      }
      
      // Show final complete suggestion (clean metrics first)
      if (suggestion.trim() && this.onSuggestionCallback) {
        // Clean the final suggestion same as during streaming
        let finalCoachingTip = suggestion.replace(/TEMP:\d+\s*/g, '').replace(/ENERGY:\d+\s*/g, '').replace(/AGREE:\d+\s*/g, '').replace(/GOAL:\d+\s*/g, '');
        finalCoachingTip = finalCoachingTip.replace(/^[^a-zA-Z]*/, '').trim();
        
        this.onSuggestionCallback({
          id: suggestionId,
          content: finalCoachingTip,
          timestamp: new Date(),
          isStreaming: false
        });
      }
      
    } catch (error) {
      console.error('❌ Error calling coaching API:', error);
      this.handleError(`AI suggestions unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets transcript messages - to be implemented by the React app
   */
  private getTranscriptMessages(): TranscriptMessage[] {
    // This will be injected by the React app
    const messages = (window as any).__transcriptMessages || [];
    if (messages.length > 0) {
      console.log(`🎯 AI Coaching: Found ${messages.length} transcript messages`);
    }
    return messages;
  }

  /**
   * Handle errors
   */
  private handleError(error: string): void {
    console.error('🚨 AI Coaching Error:', error);
    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    }
  }

  /**
   * Check if coaching is currently active
   */
  isRunning(): boolean {
    return this.isActive;
  }
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

/**
 * Saves goal to localStorage history (from Sprockett)
 */
export const saveGoalToHistory = (goal: string): void => {
  if (!goal || goal.trim().length < 3) return;
  
  const history = getGoalHistory();
  const trimmedGoal = goal.trim();
  
  // Remove if already exists (to move to top)
  const filtered = history.filter(g => g !== trimmedGoal);
  
  // Add to beginning and limit to 10 most recent
  const updated = [trimmedGoal, ...filtered].slice(0, 10);
  
  localStorage.setItem('sprockett_goal_history', JSON.stringify(updated));
};

/**
 * Gets goal history from localStorage (from Sprockett)
 */
export const getGoalHistory = (): string[] => {
  try {
    const stored = localStorage.getItem('sprockett_goal_history');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading goal history:', error);
    return [];
  }
};

/**
 * Saves call configuration to localStorage (from Sprockett)
 */
export const saveCallConfig = (config: CallConfig): void => {
  try {
    localStorage.setItem('sprockett_call_config', JSON.stringify(config));
  } catch (error) {
    console.error('Error saving call config:', error);
  }
};

/**
 * Loads call configuration from localStorage (from Sprockett)
 */
export const loadCallConfig = (): CallConfig => {
  try {
    const stored = localStorage.getItem('sprockett_call_config');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migrate old useCase to conversationType
      if (parsed.useCase && !parsed.conversationType) {
        parsed.conversationType = 'connect'; // Default migration
        delete parsed.useCase;
      }
      // Ensure conversationType exists and is valid
      if (!parsed.conversationType || !CONVERSATION_TYPES[parsed.conversationType as keyof typeof CONVERSATION_TYPES]) {
        parsed.conversationType = 'connect';
      }
      return parsed;
    }
  } catch (error) {
    console.error('Error loading call config:', error);
  }
  
  // Return default configuration
  return {
    conversationType: '',
    goal: '',
    context: ''
  };
};