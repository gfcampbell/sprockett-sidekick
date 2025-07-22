import { useState, useEffect, useRef } from 'react'
import { DesktopAudioCapture, TranscriptMessage } from '@/lib/audioCapture'
import { DesktopAICoaching, CallConfig, CoachingSuggestion, ConversationTemperature, USE_CASES, loadCallConfig, saveCallConfig } from '@/lib/aiCoaching'
import { transcriptionConfig, coachingConfig } from '@/lib/config'
import { ConfigPanel } from '@/components/ConfigPanel'

function App() {
  // Core state
  const [isListening, setIsListening] = useState(false)
  const [transcriptMessages, setTranscriptMessages] = useState<TranscriptMessage[]>([])
  const [coachingSuggestions, setCoachingSuggestions] = useState<CoachingSuggestion[]>([])
  const [conversationTemp, setConversationTemp] = useState<ConversationTemperature>({ level: 3, trend: 'stable', indicators: [] })
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
        setStatus(`Listening - ${USE_CASES[callConfig.useCase].title}`)
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
            value={callConfig.useCase} 
            onChange={(e) => handleConfigChange({ ...callConfig, useCase: e.target.value as keyof typeof USE_CASES })}
            className="use-case-quick-select"
          >
            {Object.entries(USE_CASES).map(([key, useCase]) => (
              <option key={key} value={key}>{useCase.title}</option>
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
            <div className="temp-gauge">
              {Array.from({length: 5}, (_, i) => (
                <span key={i} className={i < conversationTemp.level ? 'hot' : 'cold'}>
                  {i < conversationTemp.level ? '🔥' : '⚪'}
                </span>
              ))}
              <span className="temp-label">
                {conversationTemp.level >= 4 ? 'HOT' : conversationTemp.level >= 3 ? 'WARM' : 'COLD'}
              </span>
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
                      <strong>{USE_CASES[callConfig.useCase].title}</strong>
                      <span>{USE_CASES[callConfig.useCase].description}</span>
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