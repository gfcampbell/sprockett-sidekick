import { useState, useEffect, useRef } from 'react'
import { DesktopAudioCapture, TranscriptMessage } from '@/lib/audioCapture'
import { DesktopAICoaching, CallConfig, CoachingSuggestion, ConversationTemperature, ConversationAnalytics, CONVERSATION_TYPES, loadCallConfig, saveCallConfig } from '@/lib/aiCoaching'
import { transcriptionConfig, coachingConfig } from '@/lib/config'
import { ConfigPanel } from '@/components/ConfigPanel'
import { VoiceEnrollment, VoiceProfile } from '@/components/VoiceEnrollment'
import { hasVoiceProfile, saveVoiceProfile, loadVoiceProfile, getSpeakerDisplayName, getSpeakerRole } from '@/lib/voiceProfile'

function App() {
  // Voice enrollment state - force show for testing
  const [showVoiceEnrollment, setShowVoiceEnrollment] = useState(!hasVoiceProfile())
  const [userVoiceProfile, setUserVoiceProfile] = useState<VoiceProfile | null>(loadVoiceProfile())
  
  console.log('🎭 App render - showVoiceEnrollment:', showVoiceEnrollment, 'hasVoiceProfile:', hasVoiceProfile())
  
  // Core state
  const [isListening, setIsListening] = useState(false)
  const [transcriptMessages, setTranscriptMessages] = useState<TranscriptMessage[]>([])
  const [coachingSuggestions, setCoachingSuggestions] = useState<CoachingSuggestion[]>([])
  const [conversationTemp, setConversationTemp] = useState<ConversationTemperature>({ level: 3, trend: 'stable', indicators: [] })
  const [tempHistory, setTempHistory] = useState<number[]>([])
  const [analytics, setAnalytics] = useState<ConversationAnalytics>({
    energy: { level: 3, trend: 'stable', indicators: [] },
    agreeability: { level: 3, trend: 'stable', indicators: [] },
    goalProgress: { percentage: 0, trend: 'advancing', indicators: [] }
  })
  const [energyHistory, setEnergyHistory] = useState<number[]>([])
  const [agreeabilityHistory, setAgreeabilityHistory] = useState<number[]>([])
  // const [goalProgressHistory, setGoalProgressHistory] = useState<number[]>([]); // Reserved for future use
  const [status, setStatus] = useState('Ready to start')
  const [error, setError] = useState<string | null>(null)
  
  // Configuration state
  const [callConfig, setCallConfig] = useState<CallConfig>(() => loadCallConfig())
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  
  // Refs
  const audioCaptureRef = useRef<DesktopAudioCapture | null>(null)
  const aiCoachingRef = useRef<DesktopAICoaching | null>(null)

  // Voice enrollment handlers
  const handleVoiceEnrollmentComplete = (profile: VoiceProfile) => {
    saveVoiceProfile(profile)
    setUserVoiceProfile(profile)
    setShowVoiceEnrollment(false)
    console.log(`🎤 Voice profile created for ${profile.name}`)
  }

  const handleVoiceEnrollmentSkip = () => {
    setShowVoiceEnrollment(false)
    console.log('⏭️ Voice enrollment skipped')
  }

  // Initialize audio capture and AI coaching systems
  useEffect(() => {
    // Initialize audio capture
    const audioCapture = new DesktopAudioCapture(transcriptionConfig)
    
    // Set up transcript callback
    audioCapture.onTranscript((message: TranscriptMessage) => {
      setTranscriptMessages(prev => {
        // Enhance message with voice profile information
        const enhancedMessage = {
          ...message,
          displayName: getSpeakerDisplayName(message.speaker, undefined), // TODO: Add profile matching
          speakerRole: getSpeakerRole(message.speaker, undefined)
        }
        
        const updated = [...prev.slice(-50), enhancedMessage]; // Keep last 50 messages
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
      // setGoalProgressHistory(prev => [...prev.slice(-19), analyticsData.goalProgress.percentage]) // Reserved for future use
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
      // setGoalProgressHistory([]) // Clear goal progress history for new session // Reserved for future use
      
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
    <>
    <div className="app">
      {/* Compact Top Control Bar */}
      <div className="top-bar">
        <div className="app-title">
          <h1>AI Co-Pilot</h1>
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
            className={`btn btn-icon ${isConfigPanelOpen ? 'btn-primary' : 'btn-ghost'}`}
          >
            Settings
          </button>
          
          {/* Dev: Reset voice profile button - always show for now */}
          <button 
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              console.log('BUTTON CLICKED - Resetting voice profile...')
              localStorage.removeItem('sprockett_voice_profile')
              setUserVoiceProfile(null)
              setShowVoiceEnrollment(true)
              console.log('Voice profile reset, modal should appear')
            }}
            className="btn btn-warning btn-sm"
          >
            Reset Voice
          </button>
          
          <button 
            onClick={toggleListening}
            className={`btn ${isListening ? 'btn-danger' : 'btn-primary'} btn-lg`}
          >
            {isListening ? 'Stop' : 'Start'}
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
              AI Coaching Suggestions
              {isListening && <div className="pulse-blue" />}
            </h2>
            <div className="analytics-dashboard">
              <div className="conversation-metrics">
                {/* Conversation Tone - FLAT PANCAKE */}
                <div className="analytics-metric">
                  <span className="metric-label">Conversation Tone</span>
                  <div className={`metric-current ${conversationTemp.level >= 4 ? 'good' : conversationTemp.level >= 3 ? 'okay' : 'poor'}`}>
                    {conversationTemp.level}/5
                  </div>
                  <svg className="sparkline" viewBox="0 0 200 24">
                    {tempHistory.length > 1 && (
                      <polyline
                        points={tempHistory.map((temp, i) => 
                          `${(i / Math.max(tempHistory.length - 1, 1)) * 200},${24 - (temp / 5) * 20}`
                        ).join(' ')}
                        fill="none"
                        stroke="var(--color-primary)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </svg>
                  <div className="metric-trend">
                    <span>{conversationTemp.trend === 'warming' ? '↗' : conversationTemp.trend === 'cooling' ? '↘' : '→'}</span>
                    <span>{conversationTemp.trend}</span>
                  </div>
                </div>

                {/* Engagement Level */}
                <div className="analytics-metric">
                  <span className="metric-label">Engagement</span>
                  <div className={`metric-current ${analytics.energy.level >= 4 ? 'good' : analytics.energy.level >= 3 ? 'okay' : 'poor'}`}>
                    {analytics.energy.level}/5
                  </div>
                  <svg className="sparkline" viewBox="0 0 200 24">
                    {energyHistory.length > 1 && (
                      <polyline
                        points={energyHistory.map((energy, i) => 
                          `${(i / Math.max(energyHistory.length - 1, 1)) * 200},${24 - (energy / 5) * 20}`
                        ).join(' ')}
                        fill="none"
                        stroke="var(--color-success)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </svg>
                  <div className="metric-trend">
                    <span>{analytics.energy.trend === 'increasing' ? '↗' : analytics.energy.trend === 'decreasing' ? '↘' : '→'}</span>
                    <span>{analytics.energy.trend}</span>
                  </div>
                </div>

                {/* Alignment */}
                <div className="analytics-metric">
                  <span className="metric-label">Alignment</span>
                  <div className={`metric-current ${analytics.agreeability.level >= 4 ? 'good' : analytics.agreeability.level >= 3 ? 'okay' : 'poor'}`}>
                    {analytics.agreeability.level}/5
                  </div>
                  <svg className="sparkline" viewBox="0 0 200 24">
                    {agreeabilityHistory.length > 1 && (
                      <polyline
                        points={agreeabilityHistory.map((agree, i) => 
                          `${(i / Math.max(agreeabilityHistory.length - 1, 1)) * 200},${24 - (agree / 5) * 20}`
                        ).join(' ')}
                        fill="none"
                        stroke="var(--color-warning)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </svg>
                  <div className="metric-trend">
                    <span>{analytics.agreeability.trend === 'increasing' ? '↗' : analytics.agreeability.trend === 'decreasing' ? '↘' : '→'}</span>
                    <span>{analytics.agreeability.trend}</span>
                  </div>
                </div>
              </div>

              {/* Goal Progress - Hero Element */}
              <div className="goal-progress">
                <span className="goal-label">Goal Progress</span>
                <div className="goal-percentage">{Math.round(analytics.goalProgress.percentage)}%</div>
                <div className="goal-bar">
                  <div 
                    className="goal-bar-fill" 
                    style={{ width: `${analytics.goalProgress.percentage}%` }}
                  />
                </div>
                <div className="goal-label">{analytics.goalProgress.trend}</div>
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
                    <div className="pulse-animation">⚫</div>
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
          <span className="status-item">Status: {status}</span>
          <span className="status-item">{transcriptMessages.length} messages</span>
          <span className="status-item">{coachingSuggestions.length} suggestions</span>
        </div>
        
        <div className="transcript-toggle">
          <button 
            onClick={() => setShowTranscript(!showTranscript)}
            className={`btn ${showTranscript ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          >
            {showTranscript ? 'Hide Transcript' : 'Show Transcript'}
          </button>
        </div>
      </div>

      {/* Collapsible Transcript */}
      {showTranscript && (
        <div className="transcript-panel">
          <div className="transcript-content">
            {transcriptMessages.length > 0 ? (
              transcriptMessages.slice(-10).map((message) => {
                const displayName = (message as any).displayName || getSpeakerDisplayName(message.speaker)
                const speakerRole = (message as any).speakerRole || getSpeakerRole(message.speaker)
                const isUser = userVoiceProfile && speakerRole === 'You'
                
                return (
                  <div key={message.id} className={`transcript-message ${isUser ? 'user-message' : ''}`}>
                    <span className={`transcript-speaker ${isUser ? 'user-speaker' : ''}`}>
                      {displayName}:
                    </span>
                    <span className="transcript-text">{message.text}</span>
                    <span className="transcript-time">{message.timestamp.toLocaleTimeString()}</span>
                  </div>
                )
              })
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
          Warning: {error}
          <button onClick={() => setError(null)} className="error-close">Close</button>
        </div>
      )}
    </div>
    {/* Voice Enrollment Modal - Outside main container for true overlay */}
    {console.log('🔍 Debug: showVoiceEnrollment =', showVoiceEnrollment, 'hasVoiceProfile =', hasVoiceProfile())}
    {showVoiceEnrollment ? (
      <>
        {console.log('✅ Rendering VoiceEnrollment component')}
        <VoiceEnrollment
          onComplete={handleVoiceEnrollmentComplete}
          onSkip={handleVoiceEnrollmentSkip}
        />
      </>
    ) : (
      <>
        {console.log('❌ NOT rendering VoiceEnrollment - showVoiceEnrollment is false')}
      </>
    )}
    </>
  )
}

export default App