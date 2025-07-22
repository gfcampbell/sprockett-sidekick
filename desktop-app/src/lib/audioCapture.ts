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
  private micRecorder: MediaRecorder | null = null;
  private systemRecorder: MediaRecorder | null = null;
  private micStream: MediaStream | null = null;
  private systemStream: MediaStream | null = null;
  private isRecording = false;
  private micChunks: Blob[] = [];
  private systemChunks: Blob[] = [];
  private lastTranscriptionTime = 0;
  private chunkCount = 0;
  private config: AudioCaptureConfig;
  private onTranscriptCallback?: (message: TranscriptMessage) => void;
  private onErrorCallback?: (error: string) => void;

  constructor(config: AudioCaptureConfig) {
    this.config = config;
  }

  /**
   * Initialize dual audio capture (microphone + system audio)
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

      // Get microphone stream (Host)
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false
      });

      // Get system audio stream (Visitor)
      try {
        this.systemStream = await navigator.mediaDevices.getDisplayMedia({
          video: false,
          audio: {
            echoCancellation: false, // We want to capture the raw system audio
            noiseSuppression: false,
            autoGainControl: false,
          }
        });
        console.log('🔊 System audio capture initialized');
      } catch (systemError) {
        console.warn('⚠️ System audio capture failed - continuing with microphone only:', systemError);
        // Continue with mic-only mode if system audio fails
      }

      console.log('🎤 Audio capture initialized successfully');
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize audio capture:', error);
      this.handleError(`Failed to initialize audio: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Start recording audio from both microphone and system
   */
  async startRecording(): Promise<boolean> {
    if (!this.micStream) {
      this.handleError('Audio not initialized. Call initialize() first.');
      return false;
    }

    if (this.isRecording) {
      console.log('🎤 Already recording');
      return true;
    }

    try {
      // Create MediaRecorder for microphone (Host)
      this.micRecorder = new MediaRecorder(this.micStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.micRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.micChunks.push(event.data);
        }
      };

      this.micRecorder.onstop = () => {
        this.processAudioChunks('Host');
      };

      // Create MediaRecorder for system audio (Visitor) if available
      if (this.systemStream) {
        this.systemRecorder = new MediaRecorder(this.systemStream, {
          mimeType: 'audio/webm;codecs=opus'
        });

        this.systemRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.systemChunks.push(event.data);
          }
        };

        this.systemRecorder.onstop = () => {
          this.processAudioChunks('Visitor');
        };
      }

      // Set up error handlers
      this.micRecorder.onerror = (event) => {
        console.error('❌ Microphone MediaRecorder error:', event.error);
        this.handleError(`Mic recording error: ${event.error?.message || 'Unknown error'}`);
      };

      if (this.systemRecorder) {
        this.systemRecorder.onerror = (event) => {
          console.error('❌ System MediaRecorder error:', event.error);
          this.handleError(`System recording error: ${event.error?.message || 'Unknown error'}`);
        };
      }

      // Start recording both streams
      this.micRecorder.start();
      if (this.systemRecorder) {
        this.systemRecorder.start();
      }
      
      this.isRecording = true;

      // Set up chunk processing interval
      this.scheduleNextChunk();

      console.log('🎤 Started dual audio recording');
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
      // Stop microphone recorder
      if (this.micRecorder && this.micRecorder.state === 'recording') {
        this.micRecorder.stop();
      }
      
      // Stop system audio recorder
      if (this.systemRecorder && this.systemRecorder.state === 'recording') {
        this.systemRecorder.stop();
      }
      
      this.isRecording = false;
      console.log('🛑 Stopped dual audio recording');

      // Clean up microphone stream
      if (this.micStream) {
        this.micStream.getTracks().forEach(track => track.stop());
      }
      
      // Clean up system audio stream
      if (this.systemStream) {
        this.systemStream.getTracks().forEach(track => track.stop());
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
      // Stop both recorders if they're recording
      if (this.micRecorder?.state === 'recording') {
        this.micRecorder.stop();
      }
      
      if (this.systemRecorder?.state === 'recording') {
        this.systemRecorder.stop();
      }
        
      // Restart recording for continuous capture
      setTimeout(() => {
        if (this.isRecording) {
          if (this.micRecorder && this.micRecorder.state !== 'recording') {
            this.micRecorder.start();
          }
          
          if (this.systemRecorder && this.systemRecorder.state !== 'recording') {
            this.systemRecorder.start();
          }
          
          this.scheduleNextChunk();
        }
      }, 100);
    }, this.config.chunkDuration);
  }

  /**
   * Process collected audio chunks and send for transcription
   */
  private async processAudioChunks(speaker: 'Host' | 'Visitor'): Promise<void> {
    // Get the appropriate chunk array based on speaker
    const chunks = speaker === 'Host' ? this.micChunks : this.systemChunks;
    
    if (chunks.length === 0) return;

    // Rate limiting check
    const now = Date.now();
    if (now - this.lastTranscriptionTime < this.config.minInterval) {
      console.log(`⏱️ Rate limiting transcription for ${speaker}`);
      chunks.length = 0; // Clear chunks
      return;
    }

    // Check chunk count limit
    this.chunkCount++;
    if (this.chunkCount > this.config.maxChunksPerMinute) {
      console.warn('⚠️ Rate limit exceeded');
      this.handleError('Rate limit exceeded. Please wait before continuing.');
      chunks.length = 0;
      return;
    }

    try {
      // Combine audio chunks into single blob
      const audioBlob = new Blob(chunks, { 
        type: 'audio/webm;codecs=opus' 
      });
      
      // Skip if audio is too small (likely silence)
      if (audioBlob.size < 1000) {
        console.log(`🔇 Skipping small ${speaker} audio chunk`);
        chunks.length = 0;
        return;
      }

      this.lastTranscriptionTime = now;
      
      // Send to transcription API with speaker label
      const transcript = await this.sendToTranscriptionAPI(audioBlob, speaker);
      
      if (transcript && this.isValidTranscript(transcript)) {
        // Create transcript message with proper speaker label
        const message: TranscriptMessage = {
          id: `transcript_${Date.now()}_${speaker}`,
          timestamp: new Date(),
          speaker: speaker,
          text: transcript,
        };

        // Call transcript callback
        if (this.onTranscriptCallback) {
          this.onTranscriptCallback(message);
        }
        
        console.log(`✅ Transcribed (${speaker}):`, transcript);
      }

      // Clear processed chunks
      chunks.length = 0;

    } catch (error) {
      console.error('❌ Transcription failed:', error);
      this.handleError(`Transcription failed: ${error instanceof Error ? error.message : String(error)}`);
      // Clear the appropriate chunks array
      const chunks = speaker === 'Host' ? this.micChunks : this.systemChunks;
      chunks.length = 0;
    }
  }

  /**
   * Send audio blob to transcription API
   */
  private async sendToTranscriptionAPI(audioBlob: Blob, speaker: 'Host' | 'Visitor'): Promise<string> {
    const formData = new FormData();
    formData.append('audio', audioBlob, `audio_${Date.now()}_${speaker}.webm`);
    formData.append('model', this.config.transcriptionModel);
    formData.append('speaker', speaker);

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

  /**
   * Complete cleanup and destroy the audio capture instance
   */
  destroy(): void {
    // Stop recording if active
    if (this.isRecording) {
      this.stopRecording();
    }

    // Clean up recorders
    this.micRecorder = null;
    this.systemRecorder = null;

    // Clean up streams
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    
    if (this.systemStream) {
      this.systemStream.getTracks().forEach(track => track.stop());
      this.systemStream = null;
    }

    // Clear chunks
    this.micChunks = [];
    this.systemChunks = [];

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
      startAudioCapture(): Promise<void>;
      stopAudioCapture(): Promise<void>;
      transcribeAudio(audioData: any): Promise<any>;
      getCoachingSuggestions(context: any): Promise<any>;
    };
  }
}