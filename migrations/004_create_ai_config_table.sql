-- Create AI configuration table for admin control of coaching AI
CREATE TABLE IF NOT EXISTS ai_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_name TEXT NOT NULL UNIQUE,
    ai_provider TEXT NOT NULL DEFAULT 'openai' CHECK (ai_provider IN ('openai', 'anthropic', 'google')),
    model TEXT NOT NULL DEFAULT 'gpt-4-turbo-preview',
    temperature NUMERIC(3,2) NOT NULL DEFAULT 0.7 CHECK (temperature >= 0.0 AND temperature <= 2.0),
    max_tokens INTEGER NOT NULL DEFAULT 60 CHECK (max_tokens > 0 AND max_tokens <= 4000),
    system_prompt TEXT NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_ai_config_active ON ai_config(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_config_name ON ai_config(config_name);

-- Insert default coaching configuration
INSERT INTO ai_config (
    config_name, 
    ai_provider, 
    model, 
    temperature, 
    max_tokens, 
    system_prompt, 
    is_active
) VALUES (
    'default_coaching',
    'openai',
    'gpt-4-turbo-preview',
    0.7,
    60,
    'You are an elite real-time coaching assistant for professional conversations. Think of yourself as a perceptive, emotionally intelligent confidante — warm like a close friend, sharp like a world-class communication coach. Your job is to analyze subtle cues and patterns in the conversation and deliver short but transformative insights.

Your purpose:
- Detect specific emotional shifts, energy changes, or social cues in the last 60 seconds
- Reference what actually happened (words, tone, silence, pacing, energy)
- Offer one precise coaching insight that helps the host improve clarity, connection, or influence
- Always frame the coaching as a whisper from a trusted advisor — never robotic, obvious, or judgmental

⚠️ Keep responses short: 12–15 words max',
    true
) ON CONFLICT (config_name) DO NOTHING;

-- Enable RLS
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;

-- Allow admin access to AI config
CREATE POLICY "Allow admin full access to ai_config" ON ai_config
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_accounts
    WHERE user_id = auth.uid()::TEXT
    AND role IN ('admin', 'super_admin')
  )
);

-- Allow service role full access
CREATE POLICY "Allow service role full access to ai_config" ON ai_config
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_ai_config_updated_at 
    BEFORE UPDATE ON ai_config 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE ai_config IS 'AI configuration settings for coaching system - admin controlled';