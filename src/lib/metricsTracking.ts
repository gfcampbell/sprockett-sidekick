/**
 * Metrics Tracking System - Separate from coaching for better performance
 * Handles conversation analytics with configurable timing and cheaper models
 */

import { TranscriptMessage } from './audioCapture'
import { getActiveAIConfig } from './aiConfigManager'

export interface ConversationMetrics {
  warmth: number      // 1-5
  energy: number      // 1-5  
  agreeability: number // 1-5
  goal_progress: number // 0-100
}

export interface MetricsUpdate {
  metrics: ConversationMetrics
  timestamp: Date
  error?: string
}

export class MetricsTracker {
  private metricsApiUrl: string
  private isRunning: boolean = false
  private intervalId: NodeJS.Timeout | null = null
  private currentFrequency: number = 60000 // Default 60s
  
  // Callbacks
  private onMetricsCallback?: (update: MetricsUpdate) => void
  private onErrorCallback?: (error: string) => void

  constructor(metricsApiUrl: string) {
    this.metricsApiUrl = metricsApiUrl
  }

  /**
   * Set callback for metrics updates
   */
  onMetrics(callback: (update: MetricsUpdate) => void): void {
    this.onMetricsCallback = callback
  }

  /**
   * Set callback for errors
   */
  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback
  }

  /**
   * Start metrics tracking with dynamic frequency
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('📊 Metrics tracking already running')
      return
    }

    // Get initial metrics config to set frequency
    const metricsConfig = await getActiveAIConfig('metrics')
    this.currentFrequency = metricsConfig.frequency_ms

    console.log(`📊 Starting metrics tracking every ${this.currentFrequency}ms`)
    this.isRunning = true

    // Start the metrics tracking loop
    this.scheduleNextMetricsCall()
  }

  /**
   * Stop metrics tracking
   */
  stop(): void {
    if (!this.isRunning) {
      return
    }

    console.log('📊 Stopping metrics tracking')
    this.isRunning = false

    if (this.intervalId) {
      clearTimeout(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Schedule the next metrics call with dynamic frequency checking
   */
  private scheduleNextMetricsCall(): void {
    if (!this.isRunning) {
      return
    }

    this.intervalId = setTimeout(async () => {
      if (!this.isRunning) {
        return
      }

      // Check for frequency updates
      const metricsConfig = await getActiveAIConfig('metrics')
      if (metricsConfig.frequency_ms !== this.currentFrequency) {
        console.log(`📊 Metrics frequency updated: ${this.currentFrequency}ms → ${metricsConfig.frequency_ms}ms`)
        this.currentFrequency = metricsConfig.frequency_ms
      }

      // Run metrics analysis
      await this.requestMetricsAnalysis()

      // Schedule next call with updated frequency
      this.scheduleNextMetricsCall()
    }, this.currentFrequency)
  }

  /**
   * Request metrics analysis from AI
   */
  private async requestMetricsAnalysis(): Promise<void> {
    try {
      // Check if transcript messages are available
      const transcriptMessages = this.getTranscriptMessages()
      if (!transcriptMessages || transcriptMessages.length === 0) {
        console.log('📊 Skipping metrics request - transcript messages not available yet')
        return
      }

      // Get recent transcript for metrics analysis (longer window than coaching)
      const transcript = this.getRecentTranscript(transcriptMessages)
      
      // Skip if no meaningful transcript available
      if (!transcript || transcript.length < 100) {
        console.log('📊 Skipping metrics request - insufficient transcript content:', transcript.length, 'chars')
        return
      }

      // Build the metrics prompt
      const promptPayload = await this.buildMetricsPrompt(transcript)
      
      // Send to metrics API
      await this.sendToMetricsAPI(promptPayload)
      
    } catch (error) {
      console.error('❌ Error requesting metrics analysis:', error)
      this.handleError(`Failed to get conversation metrics: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Gets transcript messages from global state
   */
  private getTranscriptMessages(): TranscriptMessage[] {
    // Access the global transcript messages (same as coaching system)
    return (window as any).__transcriptMessages || []
  }

  /**
   * Gets recent transcript for metrics analysis (longer window than coaching)
   */
  private getRecentTranscript(transcriptMessages: TranscriptMessage[]): string {
    if (!transcriptMessages || transcriptMessages.length === 0) {
      return ''
    }

    const now = Date.now()
    const cutoff = now - 120000 // 2 minutes for metrics (vs 1 minute for coaching)

    // Filter to recent entries and format
    const recentEntries = transcriptMessages
      .filter(entry => entry.timestamp.getTime() > cutoff)
      .slice(-30) // More entries for better metrics analysis

    if (recentEntries.length === 0) {
      return ''
    }

    // Format transcript for metrics analysis
    const formattedTranscript = recentEntries
      .map(entry => {
        const label = entry.speaker === 'Host' ? '🙋‍♂️ You' : '👤 Guest'
        return `${label}: "${entry.text}"`
      })
      .join('\n')

    // Truncate if too long (more generous limit for metrics)
    if (formattedTranscript.length > 4000) {
      return formattedTranscript.substring(0, 4000) + '...'
    }

    return formattedTranscript
  }

  /**
   * Builds the metrics analysis prompt
   */
  private async buildMetricsPrompt(transcript: string) {
    // Get dynamic metrics configuration
    const metricsConfig = await getActiveAIConfig('metrics')
    
    // Build user message with transcript for analysis
    const userMessage = `CONVERSATION TRANSCRIPT (last 2 minutes):
${transcript}

Please analyze this conversation and provide metrics ratings.`

    return {
      model: metricsConfig.model,
      messages: [
        {
          role: 'system',
          content: metricsConfig.system_prompt
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      max_tokens: metricsConfig.max_tokens,
      temperature: metricsConfig.temperature
    }
  }

  /**
   * Sends metrics request to API
   */
  private async sendToMetricsAPI(payload: any): Promise<void> {
    try {
      const response = await fetch(this.metricsApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Metrics API error: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        // Metrics parsed successfully
        const update: MetricsUpdate = {
          metrics: result.metrics,
          timestamp: new Date()
        }

        if (this.onMetricsCallback) {
          this.onMetricsCallback(update)
        }
      } else {
        // Parsing failed but we have fallback metrics
        console.warn('⚠️ Metrics parsing failed, using fallback values')
        const update: MetricsUpdate = {
          metrics: result.metrics,
          timestamp: new Date(),
          error: result.error
        }

        if (this.onMetricsCallback) {
          this.onMetricsCallback(update)
        }
      }

    } catch (error) {
      console.error('❌ Metrics API request failed:', error)
      this.handleError(`Metrics API request failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Handle errors
   */
  private handleError(message: string): void {
    if (this.onErrorCallback) {
      this.onErrorCallback(message)
    }
  }
}