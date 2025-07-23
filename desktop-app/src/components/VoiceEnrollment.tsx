import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

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
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-semibold">
            {step.title}
          </DialogTitle>
        </DialogHeader>
        
        <Card className="border-0 shadow-none">
          <CardContent className="space-y-6">
            {/* Progress indicator */}
            <div className="space-y-2">
              <div className="flex justify-center space-x-2">
                {ENROLLMENT_STEPS.map((_, index) => (
                  <Badge 
                    key={index}
                    variant={index <= currentStep ? "default" : "secondary"}
                    className={`w-8 h-8 rounded-full p-0 flex items-center justify-center ${
                      index <= currentStep ? 'bg-blue-500' : 'bg-gray-200'
                    }`}
                  >
                    {index + 1}
                  </Badge>
                ))}
              </div>
              <Progress value={(currentStep / (ENROLLMENT_STEPS.length - 1)) * 100} className="w-full" />
            </div>

            {/* Step content */}
            <div className="text-center space-y-4">
              <p className="text-base text-muted-foreground leading-relaxed">
                {step.instruction}
              </p>
              
              {step.prompt && (
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                  <CardContent className="p-4">
                    <p className="text-blue-900 font-semibold leading-relaxed">
                      {step.prompt}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Recording controls */}
            {isRecordingStep && (
              <div className="text-center space-y-4">
                {isRecording ? (
                  <div className="space-y-4">
                    <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
                      <div className="w-6 h-6 bg-white rounded-sm"></div>
                    </div>
                    
                    <div className="space-y-2">
                      <Progress value={recordingProgress} className="w-full" />
                      <p className="text-sm text-muted-foreground">
                        Recording... {Math.round(recordingProgress)}%
                      </p>
                    </div>
                    
                    <Button
                      variant="outline"
                      onClick={stopRecording}
                    >
                      Stop Early
                    </Button>
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
                  <Button
                    onClick={() => {
                      console.log('🔘 Record button clicked, canRecord:', canRecord)
                      if (canRecord) {
                        startRecording()
                      } else {
                        console.log('❌ Cannot record, canRecord is false')
                      }
                    }}
                    disabled={!canRecord}
                    size="lg"
                    className="w-24 h-24 rounded-full text-2xl"
                  >
                    🎤
                  </Button>
                )}
              </div>
            )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between items-center pt-6">
              <Button
                variant="outline"
                onClick={currentStep === 0 ? onSkip : handleBack}
              >
                {currentStep === 0 ? 'Skip Setup' : '← Back'}
              </Button>
              
              <Button
                onClick={() => {
                  console.log('🔘 Next button clicked, canNext:', canNext)
                  handleNext()
                }}
                disabled={!canNext}
              >
                {currentStep === ENROLLMENT_STEPS.length - 1 ? 'Start Using Sprockett' : 'Next →'}
              </Button>
            </div>
        </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  )
}