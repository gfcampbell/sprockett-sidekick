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
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
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
   * Initialize audio capture with microphone permission
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

      // Get user media (microphone)
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false
      });

      console.log('🎤 Audio capture initialized successfully');
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize audio capture:', error);
      this.handleError(`Failed to initialize audio: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Start recording audio
   */
  async startRecording(): Promise<boolean> {
    if (!this.audioStream) {
      this.handleError('Audio not initialized. Call initialize() first.');
      return false;
    }

    if (this.isRecording) {
      console.log('🎤 Already recording');
      return true;
    }

    try {
      // Create MediaRecorder for audio chunks
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.processAudioChunks();
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event.error);
        this.handleError(`Recording error: ${event.error?.message || 'Unknown error'}`);
      };

      // Start recording
      this.mediaRecorder.start();
      this.isRecording = true;

      // Set up chunk processing interval
      this.scheduleNextChunk();

      console.log('🎤 Started recording');
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
    if (!this.isRecording || !this.mediaRecorder) {
      return;
    }

    try {
      this.mediaRecorder.stop();
      this.isRecording = false;
      console.log('🛑 Stopped recording');

      // Clean up
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop());
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
   * Schedule next chunk processing
   */
  private scheduleNextChunk(): void {
    if (!this.isRecording) return;

    setTimeout(() => {
      if (this.mediaRecorder?.state === 'recording') {
        this.mediaRecorder.stop();
        
        // Restart recording for continuous capture
        setTimeout(() => {
          if (this.isRecording && this.mediaRecorder) {
            this.mediaRecorder.start();
            this.scheduleNextChunk();
          }
        }, 100);
      }
    }, this.config.chunkDuration);
  }

  /**
   * Process collected audio chunks and send for transcription
   */
  private async processAudioChunks(): Promise<void> {
    if (this.audioChunks.length === 0) return;

    // Rate limiting check
    const now = Date.now();
    if (now - this.lastTranscriptionTime < this.config.minInterval) {
      console.log('⏱️ Rate limiting transcription');
      this.audioChunks = []; // Clear chunks
      return;
    }

    // Check chunk count limit
    this.chunkCount++;
    if (this.chunkCount > this.config.maxChunksPerMinute) {
      console.warn('⚠️ Rate limit exceeded');
      this.handleError('Rate limit exceeded. Please wait before continuing.');
      this.audioChunks = [];
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
        this.audioChunks = [];
        return;
      }

      this.lastTranscriptionTime = now;
      
      // Send to transcription API
      const transcript = await this.sendToTranscriptionAPI(audioBlob);
      
      if (transcript && this.isValidTranscript(transcript)) {
        // Create transcript message
        const message: TranscriptMessage = {
          id: `transcript_${Date.now()}`,
          timestamp: new Date(),
          speaker: 'You',
          text: transcript,
        };

        // Call transcript callback
        if (this.onTranscriptCallback) {
          this.onTranscriptCallback(message);
        }
        
        console.log('✅ Transcribed:', transcript);
      }

      // Clear processed chunks
      this.audioChunks = [];

    } catch (error) {
      console.error('❌ Transcription failed:', error);
      this.handleError(`Transcription failed: ${error instanceof Error ? error.message : String(error)}`);
      this.audioChunks = [];
    }
  }

  /**
   * Send audio blob to transcription API
   */
  private async sendToTranscriptionAPI(audioBlob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append('audio', audioBlob, `audio_${Date.now()}.webm`);
    formData.append('model', this.config.transcriptionModel);
    formData.append('speaker', 'User');

    const response = await fetch(this.config.transcriptionApiUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Transcription API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    // Handle server response format: { text, speaker, timestamp, model }
    if (result.text) return result.text;
    if (result.transcript) return result.transcript;
    if (typeof result === 'string') return result;
    
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
}

// Type definitions for Electron API
declare global {
  interface Window {
    electronAPI?: {
      requestMediaAccess(): Promise<boolean>;
      startAudioCapture(): Promise<void>;
      stopAudioCapture(): Promise<void>;
      transcribeAudio(audioData: any): Promise<any>;
      getCoachingSuggestions(context: any): Promise<any>;
    };
  }
}