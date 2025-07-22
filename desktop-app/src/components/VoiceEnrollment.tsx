import { useState, useRef, useEffect } from 'react'

interface VoiceEnrollmentProps {
  onComplete: (voiceProfile: VoiceProfile) => void
  onSkip: () => void
}

export interface VoiceProfile {
  id: string
  name: string
  role: string
  createdAt: Date
  samples: Array<{
    text: string
    duration: number
    audioData: string // base64 encoded audio
  }>
}

const ENROLLMENT_STEPS = [
  {
    id: 'intro',
    title: 'Welcome to Sprockett!',
    instruction: 'Let\'s set up your voice profile so the app knows when you\'re speaking.',
    prompt: null
  },
  {
    id: 'sentence',
    title: 'Step 1: Read this sentence',
    instruction: 'Click the microphone and read the following clearly:',
    prompt: '"I use Sprockett to get better at conversations and presentations."'
  },
  {
    id: 'introduction',
    title: 'Step 2: Introduce yourself',
    instruction: 'Tell us your name and role:',
    prompt: '"Hi, I\'m [Your Name], and I\'m a [Your Role]."'
  },
  {
    id: 'natural',
    title: 'Step 3: Speak naturally',
    instruction: 'Talk about anything for 10 seconds - your day, your goals, anything:',
    prompt: null
  },
  {
    id: 'complete',
    title: 'Voice Profile Created!',
    instruction: 'Perfect! Your voice profile has been saved. You\'ll appear as your name in all transcripts.',
    prompt: null
  }
]

export function VoiceEnrollment({ onComplete, onSkip }: VoiceEnrollmentProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingProgress, setRecordingProgress] = useState(0)
  const [samples, setSamples] = useState<VoiceProfile['samples']>([])
  const [userName] = useState('') // Reserved for future use
  const [userRole] = useState('') // Reserved for future use
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const progressIntervalRef = useRef<number | null>(null)

  const step = ENROLLMENT_STEPS[currentStep]
  const isRecordingStep = ['sentence', 'introduction', 'natural'].includes(step.id)
  const canRecord = isRecordingStep && !isRecording
  const canNext = !isRecordingStep || samples.length > currentStep - 1

  useEffect(() => {
    // Don't initialize audio immediately - wait for user to start recording
    return () => {
      cleanup()
    }
  }, [])

  const initializeAudio = async () => {
    console.log('🎤 Initializing audio for voice enrollment...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        }
      })
      streamRef.current = stream
      console.log('✅ Audio stream initialized, tracks:', stream.getAudioTracks().length)
    } catch (error) {
      console.error('❌ Failed to initialize audio:', error)
    }
  }

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }
  }

  const startRecording = async () => {
    console.log('🎤 Starting voice enrollment recording...')
    
    // Initialize audio if not already done
    if (!streamRef.current) {
      console.log('🎤 Audio not initialized, requesting permissions now...')
      await initializeAudio()
    }
    
    if (!streamRef.current) {
      console.error('❌ Failed to get audio stream - user may have denied permission')
      return
    }

    try {
      chunksRef.current = []
      console.log('🎤 Creating MediaRecorder...')
      
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      mediaRecorder.ondataavailable = (event) => {
        console.log('🎤 Audio data received:', event.data.size, 'bytes')
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        console.log('🎤 Recording stopped, chunks:', chunksRef.current.length)
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        console.log('🎤 Audio blob size:', audioBlob.size, 'bytes')
        saveRecording(audioBlob)
      }
      
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
      setRecordingProgress(0)
      
      console.log('🎤 Recording started for step:', step.id)
      
      // Progress tracking
      const duration = step.id === 'natural' ? 10000 : 5000 // 10s for natural, 5s for others
      const interval = 100
      let elapsed = 0
      
      progressIntervalRef.current = window.setInterval(() => {
        elapsed += interval
        const progress = (elapsed / duration) * 100
        setRecordingProgress(progress)
        
        if (elapsed >= duration) {
          console.log('🎤 Auto-stopping recording after', duration / 1000, 'seconds')
          stopRecording()
        }
      }, interval) as number
      
    } catch (error) {
      console.error('❌ Failed to start recording:', error)
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }

  const saveRecording = async (audioBlob: Blob) => {
    console.log('💾 Saving recording for step:', step.id)
    try {
      // Convert to base64 for storage
      const reader = new FileReader()
      reader.onloadend = () => {
        console.log('💾 Audio converted to base64, length:', (reader.result as string).length)
        const audioData = reader.result as string
        
        const sample = {
          text: step.prompt || 'Natural speech',
          duration: step.id === 'natural' ? 10 : 5,
          audioData: audioData
        }
        
        console.log('💾 Adding sample to collection, total samples will be:', samples.length + 1)
        setSamples(prev => [...prev, sample])
        
        // Auto-advance to next step after recording
        setTimeout(() => {
          if (currentStep < ENROLLMENT_STEPS.length - 2) {
            console.log('➡️ Auto-advancing to next step')
            setCurrentStep(currentStep + 1)
          } else {
            console.log('🎯 Voice enrollment complete!')
          }
        }, 1000)
      }
      
      reader.onerror = (error) => {
        console.error('❌ FileReader error:', error)
      }
      
      reader.readAsDataURL(audioBlob)
    } catch (error) {
      console.error('❌ Failed to save recording:', error)
    }
  }

  const handleNext = () => {
    if (currentStep === ENROLLMENT_STEPS.length - 2) {
      // Create voice profile
      const profile: VoiceProfile = {
        id: `voice_${Date.now()}`,
        name: userName || 'User',
        role: userRole || 'Speaker',
        createdAt: new Date(),
        samples: samples
      }
      
      onComplete(profile)
    } else {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Reserved for future advanced name/role extraction
  // const extractNameAndRole = (text: string) => {
  //   // Simple extraction from introduction
  //   const nameMatch = text.match(/I'm ([^,]+)/i)
  //   const roleMatch = text.match(/I'm (?:a |an )?([^.]+)$/i)
  //   
  //   if (nameMatch && nameMatch[1]) {
  //     setUserName(nameMatch[1].trim())
  //   }
  //   if (roleMatch && roleMatch[1] && !roleMatch[1].includes('and')) {
  //     setUserRole(roleMatch[1].trim())
  //   }
  // }

  console.log('🎭 Voice Enrollment Render - Step:', currentStep, 'ID:', step.id, 'isRecordingStep:', isRecordingStep)

  console.log('🎨 VoiceEnrollment rendering with inline styles for debugging')
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        padding: '40px',
        maxWidth: '500px',
        width: '90%'
      }}>
        {/* Progress indicator */}
        <div className="flex justify-center mb-6">
          <div className="flex space-x-2">
            {ENROLLMENT_STEPS.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index <= currentStep ? 'bg-blue-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            {step.title}
          </h2>
          <p className="text-lg text-gray-600 mb-6 leading-relaxed">
            {step.instruction}
          </p>
          
          {step.prompt && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-8">
              <p className="text-blue-900 font-semibold text-lg leading-relaxed">
                {step.prompt}
              </p>
            </div>
          )}
        </div>

        {/* Recording controls */}
        {isRecordingStep && (
          <div className="text-center mb-10">
            {isRecording ? (
              <div>
                <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <div className="w-6 h-6 bg-white rounded-sm"></div>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full transition-all duration-100"
                    style={{ width: `${recordingProgress}%` }}
                  />
                </div>
                
                <p className="text-sm text-gray-600">
                  Recording... {Math.round(recordingProgress)}%
                </p>
                
                <button
                  onClick={stopRecording}
                  className="mt-4 px-4 py-2 text-red-600 hover:text-red-800 transition-colors"
                >
                  Stop Early
                </button>
              </div>
            ) : (
              <div>
                {samples.length > currentStep - 1 ? (
                  <div className="text-center">
                    <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-green-600 font-medium">Recording complete!</p>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      console.log('🔘 Record button clicked, canRecord:', canRecord)
                      if (canRecord) {
                        startRecording()
                      } else {
                        console.log('❌ Cannot record, canRecord is false')
                      }
                    }}
                    disabled={!canRecord}
                    className="w-24 h-24 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-6 transition-all duration-200 hover:scale-105 shadow-lg"
                  >
                    <div style={{ 
                      width: '40px', 
                      height: '40px', 
                      fontSize: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      🎤
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center pt-4">
          <button
            onClick={currentStep === 0 ? onSkip : handleBack}
            className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors"
          >
            {currentStep === 0 ? 'Skip Setup' : '← Back'}
          </button>
          
          <button
            onClick={() => {
              console.log('🔘 Next button clicked, canNext:', canNext)
              handleNext()
            }}
            disabled={!canNext}
            className="px-8 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl font-semibold transition-all duration-200 hover:scale-105 shadow-lg"
          >
            {currentStep === ENROLLMENT_STEPS.length - 1 ? 'Start Using Sprockett' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}