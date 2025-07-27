import { useState } from 'react';
import { CONVERSATION_TYPES, CallConfig } from '@/lib/aiCoaching';
import { useAuth } from '@/lib/authContext';

interface ConfigPanelProps {
  config: CallConfig;
  onConfigChange: (config: CallConfig) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSignOut?: () => void;
  onNavigateToAdmin?: () => void;
  // 🏥 SURGICAL: onResetVoice removed - no longer needed
}

export function ConfigPanel({ config, onConfigChange, isCollapsed, onToggleCollapse, onSignOut, onNavigateToAdmin }: ConfigPanelProps) {
  const [localConfig, setLocalConfig] = useState(config);
  const { userState } = useAuth();
  const isAdmin = userState.role === 'admin' || userState.role === 'super_admin';

  const handleConfigUpdate = (updates: Partial<CallConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  if (isCollapsed) {
    return (
      <div className="config-panel-collapsed">
        <button onClick={onToggleCollapse} className="expand-btn">
          Configure
        </button>
        <div className="config-summary">
          <span className="use-case-badge">{config.conversationType && CONVERSATION_TYPES[config.conversationType] ? CONVERSATION_TYPES[config.conversationType].title : 'Select Expert'}</span>
          {config.goal && <span className="goal-preview">"{config.goal.substring(0, 30)}..."</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="config-panel">
      <div className="config-header">
        <h3>Settings</h3>
        <button onClick={onToggleCollapse} className="collapse-btn">Close</button>
      </div>

      {/* User Account Section */}
      <div className="config-section user-account">
        <label>Account</label>
        <div className="account-info">
          <span className="user-email">{userState.userEmail}</span>
          {isAdmin && <span className="admin-badge">👑 Admin</span>}
        </div>
      </div>

      {/* Token Balance Section */}
      <div className="config-section token-balance">
        <label>Token Balance</label>
        <div className="token-info">
          <strong>{userState.tokensRemaining} tokens</strong> available
        </div>
      </div>

      <div className="config-section">
        <label>Conversation Type</label>
        <select 
          value={config.conversationType} 
          onChange={(e) => handleConfigUpdate({ conversationType: e.target.value as keyof typeof CONVERSATION_TYPES })}
          className="use-case-select"
        >
          {Object.entries(CONVERSATION_TYPES).map(([key, conversationType]) => (
            <option key={key} value={key}>{conversationType.title}</option>
          ))}
        </select>
        <p className="use-case-description">{config.conversationType ? CONVERSATION_TYPES[config.conversationType].description : 'Choose a conversation type to see details'}</p>
      </div>

      <div className="config-section">
        <label>Your Goal</label>
        <textarea
          value={config.goal}
          onChange={(e) => handleConfigUpdate({ goal: e.target.value })}
          placeholder="What do you want to achieve in this conversation?"
          className="goal-input"
          rows={3}
        />
      </div>

      <div className="config-section">
        <label>Context & Background</label>
        <textarea
          value={config.context}
          onChange={(e) => handleConfigUpdate({ context: e.target.value })}
          placeholder="Any relevant background info, talking points, or context..."
          className="context-input"
          rows={4}
        />
      </div>


      {/* 🏥 SURGICAL: Voice reset removed - using physics-based audio routing */}
      
      {/* Action Buttons */}
      <div className="config-section config-actions">
        {isAdmin && onNavigateToAdmin && (
          <button 
            className="btn btn-secondary admin-btn"
            onClick={onNavigateToAdmin}
          >
            👑 Admin Dashboard
          </button>
        )}
        {onSignOut && (
          <button 
            className="btn btn-danger sign-out-btn"
            onClick={onSignOut}
          >
            Sign Out
          </button>
        )}
      </div>
    </div>
  );
}