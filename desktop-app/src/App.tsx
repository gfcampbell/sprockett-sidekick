import { useState, useEffect, useRef } from 'react'
import { DesktopAudioCapture, TranscriptMessage } from '@/lib/audioCapture'
import { DesktopAICoaching, CallConfig, CoachingSuggestion, ConversationTemperature, ConversationAnalytics, CONVERSATION_TYPES, loadCallConfig, saveCallConfig } from '@/lib/aiCoaching'
import { transcriptionConfig, coachingConfig } from '@/lib/config'
import { ConfigPanel } from '@/components/ConfigPanel'

function App() {
  // Core state
  const [isListening, setIsListening] = useState(false)
  const [transcriptMessages, setTranscriptMessages] = useState<TranscriptMessage[]>([])
  const [coachingSuggestions, setCoachingSuggestions] = useState<CoachingSuggestion[]>([])
  const [conversationTemp, setConversationTemp] = useState<ConversationTemperature>({ level: 3, trend: 'stable', indicators: [] })
  const [tempHistory, setTempHistory] = useState<number[]>([])
  const [analytics, setAnalytics] = useState<ConversationAnalytics>({
    energy: { level: 3, trend: 'stable', indicators: [] },
    agreeability: { level: 3, trend: 'stable', indicators: [] }
  })
  const [energyHistory, setEnergyHistory] = useState<number[]>([])
  const [agreeabilityHistory, setAgreeabilityHistory] = useState<number[]>([])
  const [status, setStatus] = useState('Ready to start')
  const [error, setError] = useState<string | null>(null)
  
  // Configuration state
  const [callConfig, setCallConfig] = useState<CallConfig>(() => loadCallConfig())
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  
  // Refs
  const audioCaptureRef = useRef<DesktopAudioCapture | null>(null)
  const aiCoachingRef = useRef<DesktopAICoaching | null>(null)

  // Initialize audio capture and AI coaching systems
  useEffect(() => {
    // Initialize audio capture
    const audioCapture = new DesktopAudioCapture(transcriptionConfig)
    
    // Set up transcript callback
    audioCapture.onTranscript((message: TranscriptMessage) => {
      setTranscriptMessages(prev => {
        const updated = [...prev.slice(-50), message]; // Keep last 50 messages
        // Make transcript available to AI coaching system
        (window as any).__transcriptMessages = updated;
        return updated;
      })
    })
    
    // Set up error callback
    audioCapture.onError((errorMessage: string) => {
      setError(errorMessage)
      setStatus('Error')
    })
    
    audioCaptureRef.current = audioCapture

    // Initialize AI coaching
    const aiCoaching = new DesktopAICoaching(callConfig, coachingConfig.COACHING_API_URL)
    
    // Set up coaching suggestion callback
    aiCoaching.onSuggestion((suggestion: CoachingSuggestion) => {
      setCoachingSuggestions(prev => {
        // Replace if updating existing suggestion (streaming), otherwise add new
        const existing = prev.find(s => s.id === suggestion.id);
        if (existing) {
          return prev.map(s => s.id === suggestion.id ? suggestion : s);
        }
        return [suggestion, ...prev.slice(0, 4)]; // Add new suggestion at TOP, keep 5 total
      })
    })
    
    // Set up coaching error callback
    aiCoaching.onError((errorMessage: string) => {
      setError(errorMessage)
    })

    // Set up temperature callback
    aiCoaching.onTemperature((temp: ConversationTemperature) => {
      setConversationTemp(temp)
      // Add to temperature history (keep last 20 readings for sparkline)
      setTempHistory(prev => [...prev.slice(-19), temp.level])
    })

    // Set up analytics callback
    aiCoaching.onAnalytics((analyticsData: ConversationAnalytics) => {
      setAnalytics(analyticsData)
      // Add to history for sparklines (keep last 20 readings)
      setEnergyHistory(prev => [...prev.slice(-19), analyticsData.energy.level])
      setAgreeabilityHistory(prev => [...prev.slice(-19), analyticsData.agreeability.level])
    })
    
    aiCoachingRef.current = aiCoaching
    
    return () => {
      if (audioCaptureRef.current) {
        audioCaptureRef.current.stopRecording()
      }
      if (aiCoachingRef.current) {
        aiCoachingRef.current.stop()
      }
    }
  }, [])

  // Update AI coaching config when call config changes
  useEffect(() => {
    if (aiCoachingRef.current) {
      aiCoachingRef.current.updateConfig(callConfig)
    }
    saveCallConfig(callConfig)
  }, [callConfig])

  const toggleListening = async () => {
    if (!audioCaptureRef.current || !aiCoachingRef.current) return

    if (!isListening) {
      // Start listening and coaching
      setError(null)
      setStatus('Initializing...')
      setCoachingSuggestions([]) // Clear previous suggestions
      setTempHistory([]) // Clear temperature history for new session
      setEnergyHistory([]) // Clear energy history for new session
      setAgreeabilityHistory([]) // Clear agreeability history for new session
      
      const initialized = await audioCaptureRef.current.initialize()
      if (!initialized) {
        setStatus('Error - Check microphone permissions')
        return
      }
      
      const started = await audioCaptureRef.current.startRecording()
      if (started) {
        // Start AI coaching
        aiCoachingRef.current.start()
        setIsListening(true)
        setStatus(`Listening - ${CONVERSATION_TYPES[callConfig.conversationType].title}`)
      } else {
        setStatus('Error - Could not start recording')
      }
    } else {
      // Stop listening and coaching
      audioCaptureRef.current.stopRecording()
      aiCoachingRef.current.stop()
      setIsListening(false)
      setStatus('Ready to start')
    }
  }

  const handleConfigChange = (newConfig: CallConfig) => {
    setCallConfig(newConfig)
  }

  return (
    <div className="app">
      {/* Compact Top Control Bar */}
      <div className="top-bar">
        <div className="app-title">
          <h1>🤖 AI Co-Pilot</h1>
        </div>
        
        <div className="quick-config">
          <select 
            value={callConfig.conversationType} 
            onChange={(e) => handleConfigChange({ ...callConfig, conversationType: e.target.value as keyof typeof CONVERSATION_TYPES })}
            className="use-case-quick-select"
          >
            {Object.entries(CONVERSATION_TYPES).map(([key, conversationType]) => (
              <option key={key} value={key}>{conversationType.title}</option>
            ))}
          </select>
          
          <input
            type="text"
            value={callConfig.goal}
            onChange={(e) => handleConfigChange({ ...callConfig, goal: e.target.value })}
            placeholder="Your goal for this conversation..."
            className="goal-quick-input"
          />
        </div>
        
        <div className="main-controls">
          <button 
            onClick={() => setIsConfigPanelOpen(!isConfigPanelOpen)}
            className={`config-btn ${isConfigPanelOpen ? 'active' : ''}`}
          >
            ⚙️
          </button>
          
          <button 
            onClick={toggleListening}
            className={`start-btn ${isListening ? 'listening' : ''}`}
          >
            {isListening ? '⏹ Stop' : '🎙 Start'}
          </button>
        </div>
      </div>

      <div className="main-content">
        {/* Configuration Side Panel */}
        {isConfigPanelOpen && (
          <ConfigPanel
            config={callConfig}
            onConfigChange={handleConfigChange}
            isCollapsed={false}
            onToggleCollapse={() => setIsConfigPanelOpen(false)}
          />
        )}

        {/* AI Suggestions - Main Hero Section */}
        <div className="suggestions-panel">
          <div className="suggestions-header">
            <h2>
              💡 AI Coaching Suggestions
              {isListening && <div className="pulse-blue" />}
            </h2>
            <div className="analytics-dashboard">
              {/* Temperature Sparkline */}
              <div className="analytics-metric">
                <svg width="100" height="25" className="sparkline">
                  {tempHistory.length > 1 && (
                    <polyline
                      points={tempHistory.map((temp, i) => 
                        `${(i / Math.max(tempHistory.length - 1, 1)) * 100},${25 - (temp / 5) * 20}`
                      ).join(' ')}
                      fill="none"
                      stroke={conversationTemp.level >= 4 ? '#e53e3e' : conversationTemp.level >= 3 ? '#d69e2e' : '#3182ce'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {tempHistory.length > 0 && (
                    <circle
                      cx="100"
                      cy={25 - (conversationTemp.level / 5) * 20}
                      r="2"
                      fill={conversationTemp.level >= 4 ? '#e53e3e' : conversationTemp.level >= 3 ? '#d69e2e' : '#3182ce'}
                    />
                  )}
                </svg>
                <span className="metric-label">Warmth</span>
              </div>

              {/* Energy Sparkline */}
              <div className="analytics-metric">
                <svg width="100" height="25" className="sparkline">
                  {energyHistory.length > 1 && (
                    <polyline
                      points={energyHistory.map((energy, i) => 
                        `${(i / Math.max(energyHistory.length - 1, 1)) * 100},${25 - (energy / 5) * 20}`
                      ).join(' ')}
                      fill="none"
                      stroke={analytics.energy.level >= 4 ? '#38a169' : analytics.energy.level >= 3 ? '#d69e2e' : '#718096'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {energyHistory.length > 0 && (
                    <circle
                      cx="100"
                      cy={25 - (analytics.energy.level / 5) * 20}
                      r="2"
                      fill={analytics.energy.level >= 4 ? '#38a169' : analytics.energy.level >= 3 ? '#d69e2e' : '#718096'}
                    />
                  )}
                </svg>
                <span className="metric-label">Energy</span>
              </div>

              {/* Agreeability Sparkline */}
              <div className="analytics-metric">
                <svg width="100" height="25" className="sparkline">
                  {agreeabilityHistory.length > 1 && (
                    <polyline
                      points={agreeabilityHistory.map((agree, i) => 
                        `${(i / Math.max(agreeabilityHistory.length - 1, 1)) * 100},${25 - (agree / 5) * 20}`
                      ).join(' ')}
                      fill="none"
                      stroke={analytics.agreeability.level >= 4 ? '#9f7aea' : analytics.agreeability.level >= 3 ? '#d69e2e' : '#e53e3e'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {agreeabilityHistory.length > 0 && (
                    <circle
                      cx="100"
                      cy={25 - (analytics.agreeability.level / 5) * 20}
                      r="2"
                      fill={analytics.agreeability.level >= 4 ? '#9f7aea' : analytics.agreeability.level >= 3 ? '#d69e2e' : '#e53e3e'}
                    />
                  )}
                </svg>
                <span className="metric-label">Agreement</span>
              </div>
            </div>
          </div>
          
          <div className="suggestions-content">
            {coachingSuggestions.length > 0 ? (
              coachingSuggestions.map((suggestion) => (
                <div key={suggestion.id} className={`coaching-suggestion ${suggestion.isStreaming ? 'streaming' : ''}`}>
                  <div className="suggestion-content">
                    {suggestion.content}
                  </div>
                  <div className="suggestion-time">
                    {suggestion.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))
            ) : (
              <div className="suggestions-empty">
                {isListening ? (
                  <div className="waiting-state">
                    <div className="pulse-animation">🎯</div>
                    <p>Analyzing conversation...</p>
                    <small>AI suggestions will appear here in a few moments</small>
                  </div>
                ) : (
                  <div className="ready-state">
                    <h3>Ready to provide AI coaching</h3>
                    <p>Configure your goal above, then press Start to begin receiving real-time suggestions</p>
                    <div className="use-case-preview">
                      <strong>{CONVERSATION_TYPES[callConfig.conversationType].title}</strong>
                      <span>{CONVERSATION_TYPES[callConfig.conversationType].description}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Status & Optional Transcript */}
      <div className="bottom-bar">
        <div className="status-info">
          <span>🎯 {status}</span>
          <span>📝 {transcriptMessages.length} messages</span>
          <span>💡 {coachingSuggestions.length} suggestions</span>
        </div>
        
        <div className="transcript-toggle">
          <button 
            onClick={() => setShowTranscript(!showTranscript)}
            className={`transcript-btn ${showTranscript ? 'active' : ''}`}
          >
            {showTranscript ? '▼ Hide Transcript' : '▲ Show Transcript'}
          </button>
        </div>
      </div>

      {/* Collapsible Transcript */}
      {showTranscript && (
        <div className="transcript-panel">
          <div className="transcript-content">
            {transcriptMessages.length > 0 ? (
              transcriptMessages.slice(-10).map((message) => (
                <div key={message.id} className="transcript-message">
                  <span className="transcript-speaker">{message.speaker}:</span>
                  <span className="transcript-text">{message.text}</span>
                  <span className="transcript-time">{message.timestamp.toLocaleTimeString()}</span>
                </div>
              ))
            ) : (
              <div className="transcript-empty">
                {isListening ? 'Listening for speech...' : 'Transcript will appear here when you start listening'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          ⚠️ {error}
          <button onClick={() => setError(null)} className="error-close">✕</button>
        </div>
      )}
    </div>
  )
}

export default App