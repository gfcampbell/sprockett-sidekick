import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/authContext'
import { supabase } from '@/lib/supabaseClient'
import AIConfiguration from './AIConfiguration'
import SessionAnalytics from './SessionAnalytics'
import ConversationAgents from './ConversationAgents'
import Economics from './Economics'

interface UserAccount {
  user_id: string
  email: string
  tokens_remaining: number
  subscription_tier: string
  role: string
  created_at: string
}

export default function AdminDashboard() {
  const { userState, isAdmin } = useAuth()
  const [users, setUsers] = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'users' | 'ai' | 'analytics' | 'agents' | 'economics'>('users')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { data, error } = await supabase
        .from('user_accounts')
        .select('user_id, email, tokens_remaining, subscription_tier, role, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        setError(`Database error: ${error.message}`)
        return
      }

      setUsers(data || [])
    } catch (err) {
      setError(`Failed to fetch users: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const addTokens = async (userId: string, tokensToAdd: number) => {
    try {
      const user = users.find(u => u.user_id === userId)
      if (!user) return

      const newBalance = user.tokens_remaining + tokensToAdd

      const { error } = await supabase
        .from('user_accounts')
        .update({ tokens_remaining: newBalance })
        .eq('user_id', userId)

      if (error) {
        setError(`Failed to add tokens: ${error.message}`)
        return
      }

      // Update local state
      setUsers(prev => 
        prev.map(u => 
          u.user_id === userId 
            ? { ...u, tokens_remaining: newBalance }
            : u
        )
      )
    } catch (err) {
      setError(`Failed to add tokens: ${err}`)
    }
  }

  if (!userState.isAuthenticated) {
    return <div className="admin-error">Please sign in to access admin dashboard</div>
  }

  if (!isAdmin()) {
    return <div className="admin-error">Access denied - Admin privileges required</div>
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div className="admin-title-section">
          <button 
            onClick={() => window.location.href = '/'}
            className="back-to-app-btn"
            title="Back to App"
          >
            ← Back to App
          </button>
          <h1>Admin Dashboard</h1>
        </div>
        <div className="admin-info">
          Logged in as: {userState.userEmail} ({userState.role})
        </div>
      </div>

      <div className="admin-tabs">
        <button 
          className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 User Management
        </button>
        <button 
          className={`admin-tab ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          🤖 AI Configuration
        </button>
        <button 
          className={`admin-tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📊 Session Analytics
        </button>
        <button 
          className={`admin-tab ${activeTab === 'agents' ? 'active' : ''}`}
          onClick={() => setActiveTab('agents')}
        >
          🎭 Conversation Agents
        </button>
        <button 
          className={`admin-tab ${activeTab === 'economics' ? 'active' : ''}`}
          onClick={() => setActiveTab('economics')}
        >
          💰 Economics
        </button>
      </div>

      {error && (
        <div className="admin-error">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="admin-section">
          <h2>User Management ({users.length} users)</h2>
          <button onClick={fetchUsers} className="refresh-btn">
            Refresh Data
          </button>

          {loading ? (
            <div className="loading">Loading users...</div>
          ) : (
            <div className="users-table">
              <div className="table-header">
                <div>Email</div>
                <div>Tokens</div>
                <div>Tier</div>
                <div>Role</div>
                <div>Joined</div>
                <div>Actions</div>
              </div>
              
              {users.map(user => (
                <div key={user.user_id} className="table-row">
                  <div className="user-email">{user.email}</div>
                  <div className="user-tokens">{user.tokens_remaining}</div>
                  <div className="user-tier">{user.subscription_tier}</div>
                  <div className="user-role">{user.role}</div>
                  <div className="user-joined">
                    {new Date(user.created_at).toLocaleDateString()}
                  </div>
                  <div className="user-actions">
                    <button 
                      onClick={() => addTokens(user.user_id, 100)}
                      className="add-tokens-btn"
                    >
                      +100 Tokens
                    </button>
                    <button 
                      onClick={() => addTokens(user.user_id, 1000)}
                      className="add-tokens-btn"
                    >
                      +1000 Tokens
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'ai' && <AIConfiguration />}
      
      {activeTab === 'analytics' && <SessionAnalytics />}
      
      {activeTab === 'agents' && <ConversationAgents />}
      {activeTab === 'economics' && <Economics />}
    </div>
  )
}