/**
 * 🎯 SOURCE COMPARISON: Pure Physics Solution
 * Microphone - System Audio = Pure Host Speech
 */

export interface PendingTranscript {
  speaker: 'Host' | 'Guest';
  text: string;
  timestamp: Date;
  audioSource: 'microphone' | 'system';
}

export class SourceComparison {
  private pendingMic: PendingTranscript | null = null;
  private pendingSystem: PendingTranscript | null = null;
  private readonly SIMILARITY_THRESHOLD = 0.8;
  private readonly TIMING_WINDOW = 2000; // 2 seconds

  /**
   * Add transcription result and check for matches
   */
  addTranscript(transcript: PendingTranscript): PendingTranscript[] {
    if (transcript.audioSource === 'microphone') {
      this.pendingMic = transcript;
    } else {
      this.pendingSystem = transcript;
    }

    return this.processPendingTranscripts();
  }

  /**
   * Process pending transcripts using source comparison
   */
  private processPendingTranscripts(): PendingTranscript[] {
    if (!this.pendingMic || !this.pendingSystem) {
      return []; // Wait for both
    }

    const results: PendingTranscript[] = [];
    
    // Check timing alignment
    const timeDiff = Math.abs(this.pendingMic.timestamp.getTime() - this.pendingSystem.timestamp.getTime());
    if (timeDiff > this.TIMING_WINDOW) {
      // Too far apart - process separately
      results.push(this.pendingMic, this.pendingSystem);
      this.clearPending();
      return results;
    }

    // Source comparison: Check if mic picked up system audio
    const similarity = this.textSimilarity(this.pendingMic.text, this.pendingSystem.text);
    
    if (similarity > this.SIMILARITY_THRESHOLD) {
      // Same speech - Guest speaking, mic picked up echo
      results.push({
        speaker: 'Guest',
        text: this.pendingSystem.text, // Use cleaner system audio
        timestamp: this.pendingSystem.timestamp,
        audioSource: 'system'
      });
    } else {
      // Different speech - both people talking
      results.push(this.pendingSystem, this.pendingMic);
    }

    this.clearPending();
    return results;
  }

  /**
   * Simple text similarity using normalized comparison
   */
  private textSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    
    const normalize = (str: string) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const normA = normalize(a);
    const normB = normalize(b);
    
    if (normA === normB) return 1.0;
    
    // Simple word overlap similarity
    const wordsA = normA.split(/\s+/);
    const wordsB = normB.split(/\s+/);
    const intersection = wordsA.filter(word => wordsB.includes(word));
    
    return intersection.length / Math.max(wordsA.length, wordsB.length);
  }

  private clearPending(): void {
    this.pendingMic = null;
    this.pendingSystem = null;
  }

  /**
   * Process single transcript (no comparison needed)
   */
  processSingle(transcript: PendingTranscript): PendingTranscript {
    return transcript; // Trust single source
  }
}