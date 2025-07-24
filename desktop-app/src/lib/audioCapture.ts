/**
 * Audio Capture Module for Desktop App
 * Adapts the existing Sprockett transcription system for Electron
 * Handles both microphone and system audio capture
 */

export interface AudioCaptureConfig {
  chunkDuration: number; // Duration of each audio chunk in ms
  minInterval: number; // Minimum interval between transcriptions
  maxChunksPerMinute: number;
  transcriptionApiUrl: string;
  transcriptionModel: string;
}

export interface TranscriptMessage {
  id: string;
  timestamp: Date;
  speaker: string;
  text: string;
  isSystem?: boolean;
}

export class DesktopAudioCapture {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  private audioChunks: Blob[] = [];
  private lastTranscriptionTime = 0;
  private chunkCount = 0;
  private config: AudioCaptureConfig;
  private onTranscriptCallback?: (message: TranscriptMessage) => void;
  private onErrorCallback?: (error: string) => void;

  constructor(config: AudioCaptureConfig) {
    this.config = config;
  }

  /**
   * Initialize microphone audio capture with speaker detection
   */
  async initialize(): Promise<boolean> {
    try {
      // Request microphone access through Electron
      if (window.electronAPI?.requestMediaAccess) {
        const granted = await window.electronAPI.requestMediaAccess();
        if (!granted) {
          this.handleError('Microphone access denied');
          return false;
        }
      }

      // Get microphone stream with optimized settings for speech
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Optimal for speech recognition
        },
        video: false
      });

      console.log('🎤 Audio capture initialized with speaker detection');
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize audio capture:', error);
      this.handleError(`Failed to initialize audio: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Start recording audio with speaker detection
   */
  async startRecording(): Promise<boolean> {
    if (!this.stream) {
      this.handleError('Audio not initialized. Call initialize() first.');
      return false;
    }

    if (this.isRecording) {
      console.log('🎤 Already recording');
      return true;
    }

    try {
      // Create MediaRecorder for microphone
      this.recorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.recorder.onstop = () => {
        console.log('🎤 Recorder stopped, chunks:', this.audioChunks.length);
        this.processAudioChunks();
      };

      // Set up error handler
      this.recorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event.error);
        this.handleError(`Recording error: ${event.error?.message || 'Unknown error'}`);
      };

      // Start recording
      this.recorder.start();
      this.isRecording = true;

      // Set up chunk processing interval
      this.scheduleNextChunk();

      console.log('🎤 Started audio recording with speaker detection');
      return true;

    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      this.handleError(`Failed to start recording: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Stop recording audio
   */
  stopRecording(): void {
    if (!this.isRecording) {
      return;
    }

    try {
      // Stop recorder
      if (this.recorder && this.recorder.state === 'recording') {
        this.recorder.stop();
      }
      
      this.isRecording = false;
      console.log('🛑 Stopped audio recording');

      // Clean up stream
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }

    } catch (error) {
      console.error('❌ Error stopping recording:', error);
    }
  }

  /**
   * Set callback for transcript messages
   */
  onTranscript(callback: (message: TranscriptMessage) => void): void {
    this.onTranscriptCallback = callback;
  }

  /**
   * Set callback for errors
   */
  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * 🔇 Mute/unmute microphone
   */
  setMuted(muted: boolean): void {
    if (this.stream) {
      this.stream.getAudioTracks().forEach((track: MediaStreamTrack) => {
        track.enabled = !muted;
      });
    }
    console.log(`🎤 Microphone ${muted ? 'muted' : 'unmuted'}`);
  }

  /**
   * Schedule next chunk processing
   */
  private scheduleNextChunk(): void {
    if (!this.isRecording) return;

    setTimeout(() => {
      // Stop recorder if it's recording
      if (this.recorder?.state === 'recording') {
        this.recorder.stop();
      }
        
      // Restart recording for continuous capture
      setTimeout(() => {
        if (this.isRecording && this.recorder && this.recorder.state !== 'recording') {
          this.recorder.start();
          this.scheduleNextChunk();
        }
      }, 100);
    }, this.config.chunkDuration);
  }

  /**
   * Process collected audio chunks and send for transcription with speaker detection
   */
  private async processAudioChunks(): Promise<void> {
    if (this.audioChunks.length === 0) {
      console.log('⚠️ No audio chunks to process');
      return;
    }

    const now = Date.now();

    // Rate limiting check
    if (now - this.lastTranscriptionTime < this.config.minInterval) {
      console.log('⏱️ Rate limiting transcription');
      this.audioChunks.length = 0;
      return;
    }

    // Check chunk count limit
    this.chunkCount++;
    if (this.chunkCount > this.config.maxChunksPerMinute) {
      console.warn('⚠️ Rate limit exceeded');
      this.handleError('Rate limit exceeded. Please wait before continuing.');
      this.audioChunks.length = 0;
      return;
    }

    try {
      // Combine audio chunks into single blob
      const audioBlob = new Blob(this.audioChunks, { 
        type: 'audio/webm;codecs=opus' 
      });
      
      // Skip if audio is too small (likely silence)
      if (audioBlob.size < 1000) {
        console.log('🔇 Skipping small audio chunk');
        this.audioChunks.length = 0;
        return;
      }

      this.lastTranscriptionTime = now;
      
      // Send to transcription API with speaker detection enabled
      const result = await this.sendToTranscriptionAPIWithSpeakers(audioBlob);
      
      if (result && result.segments) {
        // Process each speaker segment
        for (const segment of result.segments) {
          if (this.isValidTranscript(segment.text)) {
            const message: TranscriptMessage = {
              id: `transcript_${Date.now()}_${segment.speaker}`,
              timestamp: new Date(),
              speaker: segment.speaker || 'Unknown',
              text: segment.text,
            };

            // Call transcript callback
            if (this.onTranscriptCallback) {
              this.onTranscriptCallback(message);
            }
            
            console.log(`✅ Transcribed (${segment.speaker}):`, segment.text);
          }
        }
      }

      // Clear processed chunks
      this.audioChunks.length = 0;

    } catch (error) {
      console.error('❌ Transcription failed:', error);
      this.handleError(`Transcription failed: ${error instanceof Error ? error.message : String(error)}`);
      this.audioChunks.length = 0;
    }
  }

  /**
   * Send audio blob to transcription API with speaker detection
   */
  private async sendToTranscriptionAPIWithSpeakers(audioBlob: Blob): Promise<{segments: Array<{speaker: string, text: string}>}> {
    const formData = new FormData();
    formData.append('audio', audioBlob, `audio_${Date.now()}.webm`);
    formData.append('model', this.config.transcriptionModel);
    formData.append('enable_speaker_detection', 'true');
    formData.append('max_speakers', '10'); // Allow up to 10 different speakers

    const response = await fetch(this.config.transcriptionApiUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Transcription API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    // Handle server response format with speaker segments
    if (result.segments) {
      return { segments: result.segments };
    }
    
    // Fallback for single speaker response
    if (result.text || result.transcript) {
      const text = result.text || result.transcript;
      return {
        segments: [{
          speaker: 'Speaker_0',
          text: text
        }]
      };
    }
    
    // Log the actual response format for debugging
    console.error('Unexpected transcription response format:', result);
    throw new Error(`Invalid transcription response format: ${JSON.stringify(result)}`);
  }

  /**
   * Check if a transcript is valid and not a hallucination
   * Adapted from original Sprockett logic
   */
  private isValidTranscript(text: string): boolean {
    if (!text || text.length < 3) return false;
    
    // Common Whisper hallucinations to filter out
    const hallucinations = [
      '...', 'Thank you.', 'Thank you for watching.',
      'Thanks for watching.', 'Subscribe to my channel.',
      'Like and subscribe.', 'Music', 'Applause', 'Laughter',
      '♪ Music ♪', '[Music]', '[Applause]', '[Laughter]'
    ];
    
    const lowerText = text.toLowerCase().trim();
    if (hallucinations.some(h => h.toLowerCase() === lowerText)) {
      return false;
    }
    
    // Filter out very short single words
    if (text.trim().split(' ').length === 1 && text.length < 4) {
      return false;
    }
    
    // Filter out repetitive patterns
    const words = text.trim().split(' ');
    if (words.length > 1) {
      const uniqueWords = new Set(words);
      if (uniqueWords.size === 1) {
        return false; // All words are the same
      }
    }
    
    return true;
  }

  /**
   * Handle errors
   */
  private handleError(error: string): void {
    console.error('🚨 Audio Capture Error:', error);
    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    }
  }

  /**
   * Reset chunk count (call this every minute)
   */
  resetChunkCount(): void {
    this.chunkCount = 0;
  }

  /**
   * Complete cleanup and destroy the audio capture instance
   */
  destroy(): void {
    // Stop recording if active
    if (this.isRecording) {
      this.stopRecording();
    }

    // Clean up recorder
    this.recorder = null;

    // Clean up stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    // Clear chunks
    this.audioChunks = [];

    // Clear callbacks
    this.onTranscriptCallback = undefined;
    this.onErrorCallback = undefined;

    console.log('🧹 Audio capture destroyed');
  }
}

// Type definitions for Electron API
declare global {
  interface Window {
    electronAPI?: {
      requestMediaAccess(): Promise<boolean>;
      requestSystemAudioPermission(): Promise<'granted' | 'denied' | 'prompt-required'>;
      getDesktopSources(): Promise<Array<{id: string, name: string, thumbnail: string}>>;
      startAudioCapture(): Promise<void>;
      stopAudioCapture(): Promise<void>;
      transcribeAudio(audioData: any): Promise<any>;
      getCoachingSuggestions(context: any): Promise<any>;
    };
  }
}