import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/authContext'
import { supabase } from '@/lib/supabaseClient'
import { clearAIConfigCache } from '@/lib/aiConfigManager'

interface AIConfig {
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
  created_at: string
  updated_at: string
}

const AI_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k']
  },
  anthropic: {
    name: 'Anthropic',
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']
  },
  google: {
    name: 'Google',
    models: ['gemini-pro', 'gemini-pro-vision']
  }
}

export default function AIConfiguration() {
  const { userState, isSuperAdmin } = useAuth()
  const [configs, setConfigs] = useState<AIConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingConfig, setEditingConfig] = useState<AIConfig | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { data, error } = await supabase
        .from('ai_config')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        setError(`Database error: ${error.message}`)
        return
      }

      setConfigs(data || [])
    } catch (err) {
      setError(`Failed to fetch AI configs: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async (config: Partial<AIConfig>) => {
    try {
      if (config.id) {
        // Update existing
        const { error } = await supabase
          .from('ai_config')
          .update({
            ai_provider: config.ai_provider,
            model: config.model,
            temperature: config.temperature,
            max_tokens: config.max_tokens,
            frequency_ms: config.frequency_ms,
            system_prompt: config.system_prompt
          })
          .eq('id', config.id)

        if (error) {
          setError(`Failed to update config: ${error.message}`)
          return
        }
      } else {
        // Create new
        const { error } = await supabase
          .from('ai_config')
          .insert({
            config_name: config.config_name,
            config_type: config.config_type,
            ai_provider: config.ai_provider,
            model: config.model,
            temperature: config.temperature,
            max_tokens: config.max_tokens,
            frequency_ms: config.frequency_ms,
            system_prompt: config.system_prompt,
            is_active: false
          })

        if (error) {
          setError(`Failed to create config: ${error.message}`)
          return
        }
      }

      setEditingConfig(null)
      setShowCreateForm(false)
      clearAIConfigCache() // Clear cache so new config takes effect immediately
      fetchConfigs()
    } catch (err) {
      setError(`Failed to save config: ${err}`)
    }
  }

  const setActiveConfig = async (configId: string) => {
    try {
      // First deactivate all configs
      await supabase
        .from('ai_config')
        .update({ is_active: false })
        .neq('id', 'none')

      // Then activate the selected one
      const { error } = await supabase
        .from('ai_config')
        .update({ is_active: true })
        .eq('id', configId)

      if (error) {
        setError(`Failed to activate config: ${error.message}`)
        return
      }

      clearAIConfigCache() // Clear cache so new active config takes effect immediately
      fetchConfigs()
    } catch (err) {
      setError(`Failed to set active config: ${err}`)
    }
  }

  const deleteConfig = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this AI configuration?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('ai_config')
        .delete()
        .eq('id', configId)

      if (error) {
        setError(`Failed to delete config: ${error.message}`)
        return
      }

      fetchConfigs()
    } catch (err) {
      setError(`Failed to delete config: ${err}`)
    }
  }

  if (!userState.isAuthenticated) {
    return <div className="admin-error">Please sign in to access AI configuration</div>
  }

  if (!isSuperAdmin()) {
    return <div className="admin-error">Access denied - Super admin privileges required</div>
  }

  const coachingConfigs = configs.filter(c => c.config_type === 'coaching')
  const metricsConfigs = configs.filter(c => c.config_type === 'metrics')
  const activeCoachingConfig = coachingConfigs.find(c => c.is_active)
  const activeMetricsConfig = metricsConfigs.find(c => c.is_active)

  return (
    <div className="ai-config-section">
      <div className="ai-config-header">
        <h2>AI Coaching Configuration</h2>
        <div className="ai-config-controls">
          <button onClick={fetchConfigs} className="refresh-btn">
            Refresh
          </button>
          <button 
            onClick={() => setShowCreateForm(true)} 
            className="create-config-btn"
          >
            + New Config
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-error">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {activeCoachingConfig && (
        <div className="active-config-display">
          <h3>🟢 Active Coaching Config</h3>
          <div className="config-summary">
            <span><strong>{activeCoachingConfig.config_name}</strong></span>
            <span>{AI_PROVIDERS[activeCoachingConfig.ai_provider].name} {activeCoachingConfig.model}</span>
            <span>Every {activeCoachingConfig.frequency_ms / 1000}s</span>
          </div>
        </div>
      )}

      {activeMetricsConfig && (
        <div className="active-config-display">
          <h3>📊 Active Metrics Config</h3>
          <div className="config-summary">
            <span><strong>{activeMetricsConfig.config_name}</strong></span>
            <span>{AI_PROVIDERS[activeMetricsConfig.ai_provider].name} {activeMetricsConfig.model}</span>
            <span>Every {activeMetricsConfig.frequency_ms / 1000}s</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading AI configurations...</div>
      ) : (
        <div className="configs-list">
          {configs.map(config => (
            <div key={config.id} className={`config-card ${config.is_active ? 'active' : ''}`}>
              <div className="config-info">
                <h4>{config.config_name} {config.is_active && '🟢'}</h4>
                <div className="config-details">
                  <span>{AI_PROVIDERS[config.ai_provider].name}</span>
                  <span>{config.model}</span>
                  <span>T: {config.temperature}</span>
                  <span>Tokens: {config.max_tokens}</span>
                </div>
                <div className="config-prompt-preview">
                  {config.system_prompt.substring(0, 100)}...
                </div>
              </div>
              <div className="config-actions">
                {!config.is_active && (
                  <button 
                    onClick={() => setActiveConfig(config.id)}
                    className="activate-btn"
                  >
                    Activate
                  </button>
                )}
                <button 
                  onClick={() => setEditingConfig(config)}
                  className="edit-btn"
                >
                  Edit
                </button>
                <button 
                  onClick={() => deleteConfig(config.id)}
                  className="delete-btn"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(editingConfig || showCreateForm) && (
        <ConfigForm
          config={editingConfig}
          onSave={saveConfig}
          onCancel={() => {
            setEditingConfig(null)
            setShowCreateForm(false)
          }}
        />
      )}
    </div>
  )
}

interface ConfigFormProps {
  config: AIConfig | null
  onSave: (config: Partial<AIConfig>) => void
  onCancel: () => void
}

function ConfigForm({ config, onSave, onCancel }: ConfigFormProps) {
  const [formData, setFormData] = useState({
    config_name: config?.config_name || '',
    config_type: config?.config_type || 'coaching' as const,
    ai_provider: config?.ai_provider || 'openai' as const,
    model: config?.model || 'gpt-4-turbo-preview',
    temperature: config?.temperature || 0.7,
    max_tokens: config?.max_tokens || 60,
    frequency_ms: config?.frequency_ms || 15000,
    system_prompt: config?.system_prompt || ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ ...formData, id: config?.id })
  }

  return (
    <div className="config-form-overlay">
      <div className="config-form">
        <h3>{config ? 'Edit Configuration' : 'Create New Configuration'}</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Configuration Name</label>
            <input
              type="text"
              value={formData.config_name}
              onChange={(e) => setFormData(prev => ({ ...prev, config_name: e.target.value }))}
              required
              disabled={!!config} // Don't allow renaming existing configs
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>AI Provider</label>
              <select
                value={formData.ai_provider}
                onChange={(e) => {
                  const provider = e.target.value as keyof typeof AI_PROVIDERS
                  setFormData(prev => ({ 
                    ...prev, 
                    ai_provider: provider,
                    model: AI_PROVIDERS[provider].models[0]
                  }))
                }}
              >
                {Object.entries(AI_PROVIDERS).map(([key, provider]) => (
                  <option key={key} value={key}>{provider.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Model</label>
              <select
                value={formData.model}
                onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
              >
                {AI_PROVIDERS[formData.ai_provider].models.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Temperature ({formData.temperature})</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={formData.temperature}
                onChange={(e) => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
              />
              <small>Lower = more focused, Higher = more creative</small>
            </div>

            <div className="form-group">
              <label>Max Tokens</label>
              <input
                type="number"
                min="10"
                max="4000"
                value={formData.max_tokens}
                onChange={(e) => setFormData(prev => ({ ...prev, max_tokens: parseInt(e.target.value) }))}
              />
            </div>
          </div>

          <div className="form-group">
            <label>System Prompt</label>
            <textarea
              value={formData.system_prompt}
              onChange={(e) => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
              rows={10}
              placeholder="Enter the system prompt that defines how the AI should behave..."
              required
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" className="save-btn">
              {config ? 'Update' : 'Create'} Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}