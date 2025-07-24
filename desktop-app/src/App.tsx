import { useState, useEffect, useRef } from 'react'
import { DesktopAudioCapture, TranscriptMessage } from '@/lib/audioCapture'
import { DualAudioCapture, TranscriptMessage as DualTranscriptMessage, DualAudioConfig } from '@/lib/dualAudioCapture'
import { DesktopAICoaching, CallConfig, CoachingSuggestion, ConversationTemperature, ConversationAnalytics, CONVERSATION_TYPES, loadCallConfig, saveCallConfig } from '@/lib/aiCoaching'
import { transcriptionConfig, coachingConfig, surgicalFlags } from '@/lib/config'
import { ConfigPanel } from '@/components/ConfigPanel'
// 🏥 SURGICAL: Voice enrollment theater removed
import sprockettLogo from './assets/sprockett_logo.png'

function App() {
  // 🏥 SURGICAL: Voice enrollment state removed - now using physics-based audio routing

  // Core state
  const [isListening, setIsListening] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
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
  const [showControls, setShowControls] = useState(true)

  // Refs - Updated for dual audio system
  const audioCaptureRef = useRef<DesktopAudioCapture | null>(null)
  const dualAudioCaptureRef = useRef<DualAudioCapture | null>(null)
  const aiCoachingRef = useRef<DesktopAICoaching | null>(null)

  // 🏥 SURGICAL: Voice enrollment handlers removed

  // Initialize audio capture and AI coaching systems
  useEffect(() => {
    // 🫀 HEART TRANSPLANT: Choose audio system based on surgical flag
    if (surgicalFlags.USE_DUAL_AUDIO_CAPTURE) {
      console.log('🫀 HEART TRANSPLANT: Initializing DualAudioCapture (physics-based)');
      
      // Create dual audio config
      const dualConfig: DualAudioConfig = {
        chunkDuration: transcriptionConfig.chunkDuration,
        minInterval: transcriptionConfig.minInterval,
        transcriptionApiUrl: transcriptionConfig.transcriptionApiUrl,
        transcriptionModel: transcriptionConfig.transcriptionModel
      };
      
      const dualAudioCapture = new DualAudioCapture(dualConfig);
      
      // Set up transcript callback for dual system
      dualAudioCapture.onTranscript((message: DualTranscriptMessage) => {
        setTranscriptMessages(prev => {
          // 🎯 PHYSICS-BASED TRUTH: Speaker is guaranteed accurate
          const enhancedMessage = {
            ...message,
            displayName: message.speaker === 'Host' ? 'You' : 'Guest',
            speakerRole: message.speaker === 'Host' ? 'You' : 'Guest'
          }

          const updated = [...prev.slice(-50), enhancedMessage]; // Keep last 50 messages
          // Make transcript available to AI coaching system
          (window as any).__transcriptMessages = updated;
          return updated;
        })
      })

      // Set up error callback for dual system
      dualAudioCapture.onError((errorMessage: string) => {
        setError(errorMessage)
        setStatus('Error')
      })

      dualAudioCaptureRef.current = dualAudioCapture;
      
    } else {
      console.log('🔄 FALLBACK: Using legacy DesktopAudioCapture (single stream)');
      
      // Legacy single-stream system
      const audioCapture = new DesktopAudioCapture(transcriptionConfig)

      // Set up transcript callback
      audioCapture.onTranscript((message: TranscriptMessage) => {
        setTranscriptMessages(prev => {
          // 🏥 SURGICAL: No more fake voice enhancement - speaker is now guaranteed accurate
          const enhancedMessage = {
            ...message,
            displayName: message.speaker === 'Host' ? 'You' : 'Guest',
            speakerRole: message.speaker === 'Host' ? 'You' : 'Guest'
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

      audioCaptureRef.current = audioCapture;
    }

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
      // 🫀 HEART TRANSPLANT: Cleanup both audio systems
      if (surgicalFlags.USE_DUAL_AUDIO_CAPTURE && dualAudioCaptureRef.current) {
        dualAudioCaptureRef.current.cleanup()
      } else if (audioCaptureRef.current) {
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

  // Mute functionality
  useEffect(() => {
    if (dualAudioCaptureRef.current) {
      dualAudioCaptureRef.current.setMuted(isMuted);
    }
    if (audioCaptureRef.current) {
      // Also mute regular audio capture if it exists
      audioCaptureRef.current.setMuted(isMuted);
    }
  }, [isMuted])

  // Removed settings dropdown click-outside handler - no longer needed

  const toggleListening = async () => {
    // 🫀 HEART TRANSPLANT: Handle both audio systems
    const activeAudioCapture = surgicalFlags.USE_DUAL_AUDIO_CAPTURE ? dualAudioCaptureRef.current : audioCaptureRef.current;
    
    if (!activeAudioCapture || !aiCoachingRef.current) return

    if (!isListening) {
      // Start listening and coaching
      setError(null)
      setStatus('Initializing...')
      setCoachingSuggestions([]) // Clear previous suggestions
      setTempHistory([]) // Clear temperature history for new session
      setEnergyHistory([]) // Clear energy history for new session
      setAgreeabilityHistory([]) // Clear agreeability history for new session
      // setGoalProgressHistory([]) // Clear goal progress history for new session // Reserved for future use

      const initialized = await activeAudioCapture.initialize()
      if (!initialized) {
        setStatus('Error - Check audio permissions')
        return
      }

      const started = await activeAudioCapture.startRecording()
      if (started) {
        // Start AI coaching
        aiCoachingRef.current.start()
        setIsListening(true)
        
        // Enhanced status for dual audio system
        if (surgicalFlags.USE_DUAL_AUDIO_CAPTURE && dualAudioCaptureRef.current) {
          const status = dualAudioCaptureRef.current.getStatus();
          const mode = status.hasSystemAudio ? 'Dual Audio (Mic + System)' : 'Single Audio (Mic Only)';
          setStatus(`🎯 ${mode} - ${callConfig.conversationType ? CONVERSATION_TYPES[callConfig.conversationType].title : 'General Conversation'}`)
        } else {
          setStatus(`Listening - ${callConfig.conversationType ? CONVERSATION_TYPES[callConfig.conversationType].title : 'General Conversation'}`)
        }
      } else {
        setStatus('Error - Could not start recording')
      }
    } else {
      // Stop listening and coaching
      if (surgicalFlags.USE_DUAL_AUDIO_CAPTURE && dualAudioCaptureRef.current) {
        dualAudioCaptureRef.current.stopRecording()
      } else if (audioCaptureRef.current) {
        audioCaptureRef.current.stopRecording()
      }
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
        {/* Clean Title Bar */}
        <div className="title-bar">
          <div className="brand-section">
            <img
              src={sprockettLogo}
              alt="Sprockett"
              className="brand-logo"
            />
            <span className="brand-name">sprockett.app</span>
          </div>

          <div className="title-bar-controls">
            <button
              onClick={toggleListening}
              className={`btn ${isListening ? 'btn-danger' : 'btn-primary'}`}
            >
              {isListening ? 'Stop' : 'Go Live'}
            </button>
            {isListening && (
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`btn ${isMuted ? 'btn-warning' : 'btn-ghost'}`}
                title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isMuted ? '🔇' : '🎤'}
              </button>
            )}
            <button
              onClick={() => setIsConfigPanelOpen(!isConfigPanelOpen)}
              className={`btn btn-icon ${isConfigPanelOpen ? 'btn-primary' : 'btn-ghost'}`}
              title="Configuration"
            >
              ⚙
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
            {/* Collapsible Controls Section */}
            <div className={`controls-section ${showControls ? 'expanded' : 'collapsed'}`}>
              <button
                className="toggle-controls-btn"
                onClick={() => setShowControls(!showControls)}
                title={showControls ? 'Hide controls' : 'Show controls'}
              >
                {showControls ? '▼' : '▲'}
              </button>

              {showControls && (
                <>
                  <div className="controls-content">
                    <div className="controls-left">
                      <select
                        value={callConfig.conversationType}
                        onChange={(e) => handleConfigChange({ ...callConfig, conversationType: e.target.value as CallConfig['conversationType'] })}
                        className="use-case-quick-select"
                      >
                        <option value="">Pick Your Expert</option>
                        {Object.entries(CONVERSATION_TYPES).map(([key, conversationType]) => (
                          <option key={key} value={key} title={conversationType.description}>
                            {conversationType.title}
                          </option>
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

                    <div className="analytics-dashboard">
                      <div className="conversation-metrics">
                        {/* Conversation Tone - FLAT PANCAKE */}
                        <div className="analytics-metric">
                          <span className="metric-label">Trust</span>
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
                          <span className="metric-label">Energy</span>
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
                            <span>{analytics.energy.trend === 'rising' ? '↗' : analytics.energy.trend === 'falling' ? '↘' : '→'}</span>
                            <span>{analytics.energy.trend}</span>
                          </div>
                        </div>

                        {/* Alignment */}
                        <div className="analytics-metric">
                          <span className="metric-label">Vibe</span>
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
                            <span>{analytics.agreeability.trend === 'improving' ? '↗' : analytics.agreeability.trend === 'declining' ? '↘' : '→'}</span>
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
                </>
              )}
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
                      <p>Configure your goal above, then press Go Live to begin receiving real-time suggestions</p>
                      {callConfig.conversationType && (
                        <div className="use-case-preview">
                          <strong>{CONVERSATION_TYPES[callConfig.conversationType].title}</strong>
                          <span>{CONVERSATION_TYPES[callConfig.conversationType].description}</span>
                        </div>
                      )}
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
                  // 🏥 SURGICAL: Physics-based speaker identification - no more fake profiles
                  const displayName = (message as any).displayName || message.speaker
                  const isUser = message.speaker === 'Host'

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
      {/* 🏥 SURGICAL: Voice enrollment modal completely removed - physics-based audio routing doesn't need fake enrollment */}
    </>
  )
}

export default App