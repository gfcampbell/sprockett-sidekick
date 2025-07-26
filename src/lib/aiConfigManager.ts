import { supabase } from './supabaseClient'

export interface AIConfig {
  id: string
  config_name: string
  config_type: 'coaching' | 'metrics'
  ai_provider: 'openai' | 'anthropic' | 'google'
  model: string
  temperature: number
  max_tokens: number
  frequency_ms: number
  system_prompt: string
  is_active: boolean
}

// Default fallback configurations
const DEFAULT_COACHING_CONFIG: Omit<AIConfig, 'id' | 'config_name' | 'is_active'> = {
  config_type: 'coaching',
  ai_provider: 'openai',
  model: 'gpt-4-turbo-preview',
  temperature: 0.7,
  max_tokens: 60,
  frequency_ms: 15000,
  system_prompt: `You are an elite real-time coaching assistant for professional conversations. Think of yourself as a perceptive, emotionally intelligent confidante — warm like a close friend, sharp like a world-class communication coach. Your job is to analyze subtle cues and patterns in the conversation and deliver short but transformative insights.

Your purpose:
- Detect specific emotional shifts, energy changes, or social cues in the last 60 seconds
- Reference what actually happened (words, tone, silence, pacing, energy)
- Offer one precise coaching insight that helps the host improve clarity, connection, or influence
- Always frame the coaching as a whisper from a trusted advisor — never robotic, obvious, or judgmental

⚠️ Keep responses short: 12–15 words max`
}

const DEFAULT_METRICS_CONFIG: Omit<AIConfig, 'id' | 'config_name' | 'is_active'> = {
  config_type: 'metrics',
  ai_provider: 'openai',
  model: 'gpt-3.5-turbo',
  temperature: 0.3,
  max_tokens: 100,
  frequency_ms: 60000,
  system_prompt: `You are a conversation analytics system. Analyze the conversation and provide numerical ratings.

Rate the conversation on these metrics:
1. Warmth (1-5): How warm and friendly is the overall tone?
2. Energy (1-5): What is the energy level of the guest/other speaker?
3. Agreeability (1-5): How open and agreeable is the guest/other speaker?
4. Goal Progress (0-100): How close is the host to achieving their stated goal?

Transcript format:
- 🙋‍♂️ You = Host
- 👤 Guest = Other speaker

Output ONLY valid JSON in this exact format:
{
  "warmth": 3,
  "energy": 4, 
  "agreeability": 2,
  "goal_progress": 75
}`
}

let cachedCoachingConfig: AIConfig | null = null
let cachedMetricsConfig: AIConfig | null = null
let cacheExpiry = 0
const CACHE_DURATION = 30000 // 30 seconds

/**
 * Gets the active AI configuration from database with caching
 */
export async function getActiveAIConfig(configType: 'coaching' | 'metrics' = 'coaching'): Promise<Omit<AIConfig, 'id' | 'config_name' | 'is_active'>> {
  const now = Date.now()
  const cachedConfig = configType === 'coaching' ? cachedCoachingConfig : cachedMetricsConfig
  const defaultConfig = configType === 'coaching' ? DEFAULT_COACHING_CONFIG : DEFAULT_METRICS_CONFIG
  
  // Return cached config if still valid
  if (cachedConfig && now < cacheExpiry) {
    return {
      config_type: cachedConfig.config_type,
      ai_provider: cachedConfig.ai_provider,
      model: cachedConfig.model,
      temperature: cachedConfig.temperature,
      max_tokens: cachedConfig.max_tokens,
      frequency_ms: cachedConfig.frequency_ms,
      system_prompt: cachedConfig.system_prompt
    }
  }
  
  try {
    // Fetch active config from database
    const { data, error } = await supabase
      .from('ai_config')
      .select('*')
      .eq('is_active', true)
      .eq('config_type', configType)
      .single()
    
    if (error) {
      console.warn(`⚠️ Failed to fetch ${configType} AI config from database:`, error.message)
      console.log(`🔄 Using default ${configType} AI configuration`)
      return defaultConfig
    }
    
    if (!data) {
      console.warn(`⚠️ No active ${configType} AI config found in database`)
      console.log(`🔄 Using default ${configType} AI configuration`)
      return defaultConfig
    }
    
    // Cache the result
    if (configType === 'coaching') {
      cachedCoachingConfig = data
    } else {
      cachedMetricsConfig = data
    }
    cacheExpiry = now + CACHE_DURATION
    
    console.log(`✅ Using ${configType} AI config: ${data.config_name} (${data.ai_provider} ${data.model}) every ${data.frequency_ms}ms`)
    
    return {
      config_type: data.config_type,
      ai_provider: data.ai_provider,
      model: data.model,
      temperature: data.temperature,
      max_tokens: data.max_tokens,
      frequency_ms: data.frequency_ms,
      system_prompt: data.system_prompt
    }
    
  } catch (err) {
    console.error(`❌ Error fetching ${configType} AI config:`, err)
    console.log(`🔄 Using default ${configType} AI configuration`)
    return defaultConfig
  }
}

/**
 * Clears the cached configuration (call when config changes)
 */
export function clearAIConfigCache(): void {
  cachedCoachingConfig = null
  cachedMetricsConfig = null
  cacheExpiry = 0
  console.log('🧹 AI config cache cleared')
}