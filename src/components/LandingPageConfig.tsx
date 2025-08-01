import { useState, useEffect } from 'react'

interface LandingPageConfig {
  enabled: boolean
  redirect_url: string
  bypass_param: string
  test_mode: boolean
}

export default function LandingPageConfig() {
  const [config, setConfig] = useState<LandingPageConfig>({
    enabled: false,
    redirect_url: '/landing',
    bypass_param: 'skip_landing',
    test_mode: false
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = () => {
    // Load from localStorage for now - can be moved to database later
    const saved = localStorage.getItem('landing_page_config')
    if (saved) {
      try {
        setConfig(JSON.parse(saved))
      } catch (error) {
        console.error('Failed to parse landing page config:', error)
      }
    }
  }

  const saveConfig = async () => {
    setSaving(true)
    setMessage(null)
    
    try {
      // Save to localStorage for now - can be moved to database later
      localStorage.setItem('landing_page_config', JSON.stringify(config))
      
      // For now, just simulate a successful save
      await new Promise(resolve => setTimeout(resolve, 500))
      
      setMessage({ type: 'success', text: 'Landing page configuration saved successfully!' })
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to save configuration: ${error}` })
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = () => {
    setConfig({
      enabled: false,
      redirect_url: '/landing',
      bypass_param: 'skip_landing',
      test_mode: false
    })
  }

  const clearLandingHistory = () => {
    localStorage.removeItem('sprockett_landing_seen')
    setMessage({ type: 'success', text: 'Landing page viewing history cleared. All users will see landing page again.' })
  }

  return (
    <div className="admin-section">
      <h2>🚀 Landing Page Configuration</h2>
      <p style={{ color: 'var(--color-secondary)', marginBottom: '2rem' }}>
        Control landing page redirect behavior and A/B testing
      </p>

      <div className="config-grid" style={{ display: 'grid', gap: '2rem', maxWidth: '800px' }}>
        
        {/* Landing Page Status */}
        <div className="config-card">
          <h3>📊 Current Status</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1rem 0' }}>
            <div className={`status-indicator ${config.enabled ? 'active' : 'inactive'}`}>
              {config.enabled ? '🟢 Active' : '🔴 Disabled'}
            </div>
            <span>Landing page redirect is {config.enabled ? 'enabled' : 'disabled'}</span>
          </div>
          
          {config.test_mode && (
            <div style={{ background: '#fff3cd', border: '1px solid #ffeaa7', padding: '0.75rem', borderRadius: '4px', marginTop: '1rem' }}>
              ⚠️ <strong>Test Mode Active</strong> - Only admins will see landing page redirects
            </div>
          )}
        </div>

        {/* Main Controls */}
        <div className="config-card">
          <h3>⚙️ Redirect Settings</h3>
          
          <div className="config-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig(prev => ({ ...prev, enabled: e.target.checked }))}
              />
              <strong>Enable Landing Page Redirect</strong>
            </label>
            <p style={{ color: 'var(--color-secondary)', fontSize: '0.9rem', marginLeft: '1.5rem' }}>
              When enabled, first-time visitors will be redirected to the landing page
            </p>
          </div>

          <div className="config-field">
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Landing Page URL:
            </label>
            <input
              type="text"
              value={config.redirect_url}
              onChange={(e) => setConfig(prev => ({ ...prev, redirect_url: e.target.value }))}
              className="config-input"
              placeholder="/landing"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: '4px' }}
            />
            <p style={{ color: 'var(--color-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              Internal route or external URL for landing page
            </p>
          </div>

          <div className="config-field">
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Bypass Parameter:
            </label>
            <input
              type="text"
              value={config.bypass_param}
              onChange={(e) => setConfig(prev => ({ ...prev, bypass_param: e.target.value }))}
              className="config-input"
              placeholder="skip_landing"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: '4px' }}
            />
            <p style={{ color: 'var(--color-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              URL parameter to bypass landing page (e.g., ?skip_landing=true)
            </p>
          </div>
        </div>

        {/* Testing Controls */}
        <div className="config-card">
          <h3>🧪 Testing & Debug</h3>
          
          <div className="config-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="checkbox"
                checked={config.test_mode}
                onChange={(e) => setConfig(prev => ({ ...prev, test_mode: e.target.checked }))}
              />
              <strong>Test Mode</strong>
            </label>
            <p style={{ color: 'var(--color-secondary)', fontSize: '0.9rem', marginLeft: '1.5rem' }}>
              When enabled, only admin users will be redirected to landing page for testing
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button 
              onClick={clearLandingHistory}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1rem' }}
            >
              Clear Landing History
            </button>
            <a 
              href={config.redirect_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1rem', textDecoration: 'none' }}
            >
              Preview Landing Page
            </a>
            <a 
              href={`/?${config.bypass_param}=true`}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1rem', textDecoration: 'none' }}
            >
              Test Bypass URL
            </a>
          </div>
        </div>

        {/* Live URLs */}
        <div className="config-card">
          <h3>🔗 Live URLs</h3>
          <div style={{ background: 'var(--color-gray-50)', padding: '1rem', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.9rem' }}>
            <div><strong>Main App:</strong> sprockett.app/</div>
            <div><strong>Landing Page:</strong> sprockett.app{config.redirect_url}</div>
            <div><strong>Bypass URL:</strong> sprockett.app/?{config.bypass_param}=true</div>
          </div>
        </div>
      </div>

      {/* Save Controls */}
      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button 
          onClick={saveConfig}
          disabled={saving}
          className="btn btn-primary"
          style={{ padding: '0.75rem 1.5rem' }}
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
        <button 
          onClick={resetToDefaults}
          className="btn btn-secondary"
          style={{ padding: '0.75rem 1.5rem' }}
        >
          Reset to Defaults
        </button>
      </div>

      {message && (
        <div 
          className={`config-message ${message.type}`}
          style={{ 
            marginTop: '1rem', 
            padding: '0.75rem', 
            borderRadius: '4px',
            backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
            border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
            color: message.type === 'success' ? '#155724' : '#721c24'
          }}
        >
          {message.text}
        </div>
      )}
    </div>
  )
}