/**
 * AI Coaching System for Desktop App
 * Ported from Sprockett's sophisticated real-time coaching system
 * Maintains all the original prompt engineering and logic
 */

import { TranscriptMessage } from './audioCapture';

// =============================================
// USE CASE DEFINITIONS (from Sprockett)
// =============================================

export const USE_CASES = {
  'sales': {
    title: 'Close More Deals',
    description: 'Sales calls with real-time coaching on buyer signals and objection handling',
    systemContext: `You are an expert sales coach. Focus on:
    - Identifying buyer signals and interest levels
    - Coaching on objection handling techniques
    - Timing for closing questions and next steps
    - Reading prospect engagement and emotional state
    - Suggesting strategic questions to uncover needs`
  },
  'interview': {
    title: 'Nail Every Interview',
    description: 'Job interviews with coaching on answers and follow-up questions',
    systemContext: `You are an expert interview coach. Focus on:
    - Strengthening answers to show relevant experience
    - Suggesting thoughtful follow-up questions
    - Reading interviewer engagement and interest
    - Coaching on storytelling and examples
    - Timing for questions about role and company`
  },
  'negotiation': {
    title: 'Win Every Negotiation',
    description: 'Business negotiations with real-time strategy and concession timing',
    systemContext: `You are an expert negotiation strategist. Focus on:
    - Identifying the other party's pain points and motivations
    - Strategic timing for concessions and proposals
    - Reading emotional state and pressure points
    - Coaching on value articulation and positioning
    - Suggesting creative win-win solutions`
  },
  'support': {
    title: 'Delight Every Customer',
    description: 'Customer support with problem diagnosis and de-escalation techniques',
    systemContext: `You are an expert customer success coach. Focus on:
    - Quick problem diagnosis and solution identification
    - De-escalation techniques for frustrated customers
    - Reading customer emotions and satisfaction levels
    - Suggesting proactive value-add opportunities
    - Coaching on empathy and relationship building`
  },
  'difficult': {
    title: 'Navigate Tough Conversations',
    description: 'Difficult conversations with emotional intelligence and solution finding',
    systemContext: `You are an expert communication coach. Focus on:
    - Reading emotional state and defensiveness
    - De-escalation and empathy techniques
    - Finding common ground and shared interests
    - Coaching on active listening and validation
    - Suggesting constructive solution-focused approaches`
  },
  'general': {
    title: 'General Conversation Coaching',
    description: 'All-purpose conversation coaching and communication support',
    systemContext: `You are a general conversation coach. Focus on:
    - Active listening and engagement techniques
    - Clear communication and articulation
    - Reading conversation flow and timing
    - Suggesting thoughtful questions and responses
    - Building rapport and connection`
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
  useCase: keyof typeof USE_CASES;
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

// =============================================
// AI COACHING CLASS
// =============================================

export class DesktopAICoaching {
  private coachingInterval: NodeJS.Timeout | null = null;
  private isActive = false;
  private lastCoachingRequest = 0;
  private callConfig: CallConfig;
  private apiUrl: string;
  private onSuggestionCallback?: (suggestion: CoachingSuggestion) => void;
  private onErrorCallback?: (error: string) => void;
  private onTemperatureCallback?: (temp: ConversationTemperature) => void;

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
    this.coachingInterval = setInterval(async () => {
      await this.requestCoachingSuggestion();
    }, COACHING_CONFIG.INTERVAL_MS);
    
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
   * Requests a coaching suggestion from the AI
   */
  private async requestCoachingSuggestion(): Promise<void> {
    try {
      // Get recent transcript from the app's transcript buffer
      const transcript = this.getRecentTranscript();
      
      // Skip if no meaningful transcript available
      if (!transcript || transcript.length < 50) {
        console.log('ℹ️ Skipping coaching request - insufficient transcript');
        return;
      }
      
      // Build the coaching prompt
      const promptPayload = this.buildCoachingPrompt(transcript);
      
      // Send to coaching API
      await this.sendToCoachAPI(promptPayload);
      
      this.lastCoachingRequest = Date.now();
      
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
    
    // Format as conversation - you are the host leading the conversation
    let formattedTranscript = recentEntries
      .map(entry => `👤 Other person: "${entry.text}"`)
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
    const userMessage = `CURRENT CONVERSATION:
${transcript}

COACHING REQUEST:
1. Rate conversation warmth (1-5): 1=cold/hostile, 3=neutral, 5=warm/positive
2. Provide 1 ULTRA-SHORT coaching tip (5-8 words max)

Format: "TEMP:3 🤖 [5-8 words]"`;

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
      max_tokens: 20,
      temperature: 0.7,
      stream: true
    };
  }

  /**
   * Builds the system prompt with use case and goal context (from Sprockett)
   */
  private buildSystemPrompt(): string {
    // Base system directive (consistent across all calls)
    const basePrompt = `You are an AI assistant supporting the host during their conversation. The host is trying to accomplish something specific, and you are working with the host to help them succeed. 
Your role is to:
- Give ULTRA-SHORT tips (5-8 words max)
- Suggest what to say next
- Be punchy and direct
IMPORTANT: You are coaching the HOST. Keep responses under 8 words.`;

    // Add use case specific context if selected
    let useCaseContext = '';
    if (this.callConfig.useCase && USE_CASES[this.callConfig.useCase]) {
      useCaseContext = `\n\nSITUATION CONTEXT:\n${USE_CASES[this.callConfig.useCase].systemContext}`;
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
                
                // Parse temperature and suggestion
                const tempMatch = suggestion.match(/TEMP:(\d)/);
                const tempLevel = tempMatch ? parseInt(tempMatch[1]) : 3;
                
                // Extract coaching tip
                const coachingTip = suggestion.replace(/TEMP:\d+\s*/, '');
                
                // Update temperature
                if (this.onTemperatureCallback) {
                  this.onTemperatureCallback({
                    level: tempLevel,
                    trend: 'stable', // TODO: compare with previous
                    indicators: []
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
      
      // Show final complete suggestion
      if (suggestion.trim() && this.onSuggestionCallback) {
        this.onSuggestionCallback({
          id: suggestionId,
          content: suggestion.trim(),
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
    return (window as any).__transcriptMessages || [];
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
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading call config:', error);
  }
  
  // Return default configuration
  return {
    useCase: 'general',
    goal: '',
    context: ''
  };
};