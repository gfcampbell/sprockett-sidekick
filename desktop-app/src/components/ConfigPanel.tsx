import { useState } from 'react';
import { CONVERSATION_TYPES, CallConfig } from '@/lib/aiCoaching';

interface ConfigPanelProps {
  config: CallConfig;
  onConfigChange: (config: CallConfig) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function ConfigPanel({ config, onConfigChange, isCollapsed, onToggleCollapse }: ConfigPanelProps) {
  const [localConfig, setLocalConfig] = useState(config);

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
          <span className="use-case-badge">{CONVERSATION_TYPES[config.conversationType].title}</span>
          {config.goal && <span className="goal-preview">"{config.goal.substring(0, 30)}..."</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="config-panel">
      <div className="config-header">
        <h3>Call Configuration</h3>
        <button onClick={onToggleCollapse} className="collapse-btn">Close</button>
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
        <p className="use-case-description">{CONVERSATION_TYPES[config.conversationType].description}</p>
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

      <div className="config-section">
        <label>📎 Documents</label>
        <div className="document-upload">
          <input 
            type="file" 
            id="document-upload" 
            accept=".pdf,.doc,.docx,.txt"
            multiple
            className="file-input"
          />
          <label htmlFor="document-upload" className="upload-btn">
            Choose Files
          </label>
          <p className="upload-help">Upload relevant documents, notes, or prep materials</p>
        </div>
      </div>
    </div>
  );
}