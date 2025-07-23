// callConfig.js
// Sprint 4.0: Pre-Call Configuration Panel
// Handles use case selection, goal setting, context input, and system prompt building

// =============================================
// USE CASE DEFINITIONS
// =============================================

/**
 * Available use cases with their specialized coaching approaches
 * Based on the use-cases.html page content
 */
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
// GOAL HISTORY MANAGEMENT
// =============================================

/**
 * Saves a goal to localStorage history
 * @param {string} goal - The goal to save
 */
export const saveGoalToHistory = (goal) => {
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
 * Gets goal history from localStorage
 * @returns {string[]} Array of previous goals
 */
export const getGoalHistory = () => {
    try {
        const stored = localStorage.getItem('sprockett_goal_history');
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Error loading goal history:', error);
        return [];
    }
};

/**
 * Clears goal history
 */
export const clearGoalHistory = () => {
    localStorage.removeItem('sprockett_goal_history');
};

// =============================================
// SETTINGS PERSISTENCE
// =============================================

/**
 * Saves call configuration to localStorage
 * @param {Object} config - The call configuration object
 */
export const saveCallConfig = (config) => {
    try {
        localStorage.setItem('sprockett_call_config', JSON.stringify(config));
    } catch (error) {
        console.error('Error saving call config:', error);
    }
};

/**
 * Loads call configuration from localStorage
 * @returns {Object} The saved call configuration or default values
 */
export const loadCallConfig = () => {
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
        useCase: '',
        goal: '',
        context: ''
    };
};

// =============================================
// SYSTEM PROMPT BUILDER
// =============================================

/**
 * Builds the complete system prompt for AI coaching
 * @param {Object} callConfig - Current call configuration
 * @param {string} userPrompt - User's additional prompt from AI assist
 * @returns {string} Complete system prompt
 */
export const buildSystemPrompt = (callConfig, userPrompt = '') => {
    // Base system directive (consistent across all calls)
    const basePrompt = `You are a warm, perceptive confidante supporting the host during their conversation. You're like a trusted friend who notices subtle social cues and offers gentle, insightful guidance.

Your role is to:
- Notice specific moments and reactions in the conversation
- Offer warm, observational coaching (12-15 words max)
- Reference what you actually heard or observed when possible
- Suggest what to say or do next based on those observations
- Be like a mentor-friend whispering helpful insights

TONE: Warm but sharp, observational, specific. Structure as: [what you noticed] + [what to do about it].
IMPORTANT: You are only visible to the host. Keep responses 12-15 words maximum while staying natural and authentic.`;

    // Add use case specific context if selected
    let useCaseContext = '';
    if (callConfig.useCase && USE_CASES[callConfig.useCase]) {
        useCaseContext = `\n\nSITUATION CONTEXT:\n${USE_CASES[callConfig.useCase].systemContext}`;
    }

    // Add user's specific goal
    let goalContext = '';
    if (callConfig.goal && callConfig.goal.trim()) {
        goalContext = `\n\nHOST'S GOAL: ${callConfig.goal.trim()}`;
    }

    // Add relevant background context
    let backgroundContext = '';
    if (callConfig.context && callConfig.context.trim()) {
        backgroundContext = `\n\nRELEVANT CONTEXT: ${callConfig.context.trim()}`;
    }

    // Add user's additional prompt
    let additionalPrompt = '';
    if (userPrompt && userPrompt.trim()) {
        additionalPrompt = `\n\nADDITIONAL GUIDANCE: ${userPrompt.trim()}`;
    }

    return basePrompt + useCaseContext + goalContext + backgroundContext + additionalPrompt;
};

// =============================================
// EXPORT STATE ACCESS
// =============================================

/**
 * Gets the current call configuration from connection.js state
 * This function should be called from modules that have access to the state
 */
export const getCurrentCallConfig = () => {
    // This will be called from connection.js where state is available
    if (typeof window !== 'undefined' && window.state && window.state.callConfig) {
        return window.state.callConfig;
    }
    return { useCase: '', goal: '', context: '' };
};

console.log('✅ Call Configuration module loaded'); 