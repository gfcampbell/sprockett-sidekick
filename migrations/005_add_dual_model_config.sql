-- Add dual-model configuration support
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS config_type TEXT DEFAULT 'coaching' CHECK (config_type IN ('coaching', 'metrics'));
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS frequency_ms INTEGER DEFAULT 15000 CHECK (frequency_ms >= 1000 AND frequency_ms <= 300000);

-- Update existing config to be coaching type
UPDATE ai_config SET config_type = 'coaching', frequency_ms = 15000 WHERE config_name = 'default_coaching';

-- Insert default metrics configuration
INSERT INTO ai_config (
    config_name, 
    config_type,
    ai_provider, 
    model, 
    temperature, 
    max_tokens, 
    frequency_ms,
    system_prompt, 
    is_active
) VALUES (
    'default_metrics',
    'metrics',
    'openai',
    'gpt-3.5-turbo',
    0.3,
    100,
    60000,
    'You are a conversation analytics system. Analyze the conversation and provide numerical ratings.

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
}',
    true
) ON CONFLICT (config_name) DO NOTHING;

-- Update unique constraint to include config_type
ALTER TABLE ai_config DROP CONSTRAINT IF EXISTS ai_config_config_name_key;
ALTER TABLE ai_config ADD CONSTRAINT ai_config_config_name_type_key UNIQUE (config_name, config_type);

-- Create index for config type lookups
CREATE INDEX IF NOT EXISTS idx_ai_config_type_active ON ai_config(config_type, is_active);

-- Add comment
COMMENT ON COLUMN ai_config.config_type IS 'Type of AI configuration: coaching (fast suggestions) or metrics (analytical data)';
COMMENT ON COLUMN ai_config.frequency_ms IS 'How often to run this AI call in milliseconds';