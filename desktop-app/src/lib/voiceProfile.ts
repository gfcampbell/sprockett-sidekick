import { VoiceProfile } from '@/components/VoiceEnrollment'

const VOICE_PROFILE_KEY = 'sprockett_voice_profile'
const VOICE_PROFILES_KEY = 'sprockett_voice_profiles'

/**
 * Save the primary user's voice profile
 */
export function saveVoiceProfile(profile: VoiceProfile): void {
  try {
    localStorage.setItem(VOICE_PROFILE_KEY, JSON.stringify(profile))
    console.log('✅ Voice profile saved:', profile.name)
  } catch (error) {
    console.error('❌ Failed to save voice profile:', error)
  }
}

/**
 * Load the primary user's voice profile
 */
export function loadVoiceProfile(): VoiceProfile | null {
  try {
    const stored = localStorage.getItem(VOICE_PROFILE_KEY)
    if (stored) {
      const profile = JSON.parse(stored)
      // Convert date strings back to Date objects
      profile.createdAt = new Date(profile.createdAt)
      return profile
    }
    return null
  } catch (error) {
    console.error('❌ Failed to load voice profile:', error)
    return null
  }
}

/**
 * Check if user has completed voice enrollment
 */
export function hasVoiceProfile(): boolean {
  return loadVoiceProfile() !== null
}

/**
 * Clear voice profile (for testing or reset)
 */
export function clearVoiceProfile(): void {
  try {
    localStorage.removeItem(VOICE_PROFILE_KEY)
    localStorage.removeItem(VOICE_PROFILES_KEY)
    console.log('🗑️ Voice profiles cleared')
  } catch (error) {
    console.error('❌ Failed to clear voice profile:', error)
  }
}

/**
 * Save additional speaker profiles (for team members, clients, etc.)
 */
export function saveKnownSpeakers(speakers: Record<string, VoiceProfile>): void {
  try {
    localStorage.setItem(VOICE_PROFILES_KEY, JSON.stringify(speakers))
    console.log('✅ Known speakers saved:', Object.keys(speakers).length)
  } catch (error) {
    console.error('❌ Failed to save known speakers:', error)
  }
}

/**
 * Load all known speaker profiles
 */
export function loadKnownSpeakers(): Record<string, VoiceProfile> {
  try {
    const stored = localStorage.getItem(VOICE_PROFILES_KEY)
    if (stored) {
      const speakers = JSON.parse(stored)
      // Convert date strings back to Date objects
      for (const speakerId in speakers) {
        speakers[speakerId].createdAt = new Date(speakers[speakerId].createdAt)
      }
      return speakers
    }
    return {}
  } catch (error) {
    console.error('❌ Failed to load known speakers:', error)
    return {}
  }
}

/**
 * Simple voice matching algorithm
 * In production, this would use more sophisticated voice embeddings
 */
export function matchVoiceToProfile(
  _audioSample: string, // base64 audio data
  _knownProfiles: VoiceProfile[]
): { profileId: string | null; confidence: number } {
  
  // For now, return a mock implementation
  // In production, this would:
  // 1. Extract voice features from audioSample
  // 2. Compare against stored voice profiles
  // 3. Return best match with confidence score
  
  const primaryProfile = loadVoiceProfile()
  
  if (primaryProfile && _knownProfiles.includes(primaryProfile)) {
    // Simple heuristic: assume primary user speaks most often
    return {
      profileId: primaryProfile.id,
      confidence: 0.85 // 85% confidence for demo
    }
  }
  
  return {
    profileId: null,
    confidence: 0.0
  }
}

/**
 * Map OpenAI speaker IDs to known profiles
 */
export function mapSpeakersToProfiles(
  segments: Array<{ speaker: string; text: string }>,
  _knownProfiles: VoiceProfile[]
): Array<{ speaker: string; text: string; profile?: VoiceProfile }> {
  
  const primaryProfile = loadVoiceProfile()
  const speakerMapping = new Map<string, VoiceProfile>()
  
  // Simple mapping: assign primary user to the speaker who talks most
  const speakerCounts = new Map<string, number>()
  segments.forEach(segment => {
    speakerCounts.set(segment.speaker, (speakerCounts.get(segment.speaker) || 0) + segment.text.length)
  })
  
  if (primaryProfile && speakerCounts.size > 0) {
    // Find speaker with most content
    const mostActiveSpeaker = Array.from(speakerCounts.entries())
      .sort(([,a], [,b]) => b - a)[0][0]
    
    speakerMapping.set(mostActiveSpeaker, primaryProfile)
  }
  
  return segments.map(segment => ({
    ...segment,
    profile: speakerMapping.get(segment.speaker)
  }))
}

/**
 * Get display name for a speaker
 */
export function getSpeakerDisplayName(speaker: string, profile?: VoiceProfile): string {
  if (profile) {
    return profile.name
  }
  
  // Convert Speaker_0 to "Speaker 1" for better UX
  const match = speaker.match(/Speaker_(\d+)/)
  if (match) {
    const speakerNum = parseInt(match[1]) + 1
    return `Speaker ${speakerNum}`
  }
  
  return speaker
}

/**
 * Get speaker role/relationship
 */
export function getSpeakerRole(
  _speaker: string, 
  profile?: VoiceProfile
): string {
  if (profile) {
    const primaryProfile = loadVoiceProfile()
    if (profile.id === primaryProfile?.id) {
      return 'You'
    }
    return profile.role || 'Unknown'
  }
  
  return 'Unknown'
}