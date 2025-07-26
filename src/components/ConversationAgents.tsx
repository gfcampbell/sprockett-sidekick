import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/authContext'
import { supabase } from '@/lib/supabaseClient'
import { clearConversationTypesCache } from '@/lib/aiCoaching'
import { clearConversationAgentsCache } from '@/lib/conversationAgentsManager'

interface ConversationAgent {
  id: string
  agent_key: string
  title: string
  description: string
  system_context: string
  is_active: boolean
}

export default function ConversationAgents() {
  const { userState, isSuperAdmin } = useAuth()
  const [agents, setAgents] = useState<ConversationAgent[]>([])
  const [editingAgent, setEditingAgent] = useState<ConversationAgent | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('conversation_agents')
        .select('*')
        .eq('is_active', true)
        .order('agent_key')

      if (fetchError) {
        setError(`Failed to load agents: ${fetchError.message}`)
        return
      }

      setAgents(data || [])
    } catch (err) {
      setError(`Failed to load agents: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const saveAgent = async (agent: ConversationAgent) => {
    try {
      const { error: updateError } = await supabase
        .from('conversation_agents')
        .update({
          title: agent.title,
          description: agent.description,
          system_context: agent.system_context
        })
        .eq('id', agent.id)

      if (updateError) {
        setError(`Failed to save agent: ${updateError.message}`)
        return
      }

      // Clear caches so changes take effect immediately
      clearConversationAgentsCache()
      clearConversationTypesCache()
      
      // Reload agents to get updated data
      await loadAgents()
      setEditingAgent(null)
      setError(null)
    } catch (err) {
      setError(`Failed to save agent: ${err}`)
    }
  }

  if (!userState.isAuthenticated) {
    return <div className="admin-error">Please sign in to access conversation agents</div>
  }

  if (!isSuperAdmin()) {
    return <div className="admin-error">Access denied - Super admin privileges required</div>
  }

  return (
    <div className="conversation-agents">
      <div className="agents-header">
        <h2>Conversation Agents</h2>
        <div className="agents-info">
          Manage the different conversation agent types (The Strategist, The Mediator, etc.)
        </div>
      </div>

      {error && (
        <div className="admin-error">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading conversation agents...</div>
      ) : (
        <div className="agents-grid">
          {agents.map(agent => (
            <div key={agent.id} className="agent-card">
              <div className="agent-header">
                <h3>{agent.title}</h3>
                <div className="agent-key">{agent.agent_key}</div>
              </div>
              <div className="agent-description">
                {agent.description}
              </div>
              <div className="agent-prompt-preview">
                <strong>System Context:</strong>
                <div className="prompt-text">
                  {agent.system_context.substring(0, 200)}...
                </div>
              </div>
              <div className="agent-actions">
                <button 
                  onClick={() => setEditingAgent(agent)}
                  className="edit-btn"
                >
                  Edit Agent
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingAgent && (
        <AgentEditor
          agent={editingAgent}
          onSave={saveAgent}
          onCancel={() => setEditingAgent(null)}
        />
      )}
    </div>
  )
}

interface AgentEditorProps {
  agent: ConversationAgent
  onSave: (agent: ConversationAgent) => void
  onCancel: () => void
}

function AgentEditor({ agent, onSave, onCancel }: AgentEditorProps) {
  const [formData, setFormData] = useState({
    id: agent.id,
    agent_key: agent.agent_key,
    title: agent.title,
    description: agent.description,
    system_context: agent.system_context,
    is_active: agent.is_active
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="agent-editor-overlay">
      <div className="agent-editor">
        <h3>Edit Conversation Agent</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Agent Key</label>
            <input
              type="text"
              value={formData.agent_key}
              disabled
              className="disabled-input"
            />
            <small>The unique identifier for this agent (cannot be changed)</small>
          </div>

          <div className="form-group">
            <label>Agent Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., The Strategist"
              required
            />
            <small>The display name users see (e.g., "The Strategist", "The Mediator")</small>
          </div>

          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of what this agent helps with"
              required
            />
            <small>Brief explanation shown to users when selecting agent type</small>
          </div>

          <div className="form-group">
            <label>System Context / Prompt</label>
            <textarea
              value={formData.system_context}
              onChange={(e) => setFormData(prev => ({ ...prev, system_context: e.target.value }))}
              rows={15}
              placeholder="The detailed system prompt that defines how this agent behaves..."
              required
              className="system-context-textarea"
            />
            <small>The detailed prompt that shapes how the AI coaching behaves for this agent type</small>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" className="save-btn">
              Save Agent
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}