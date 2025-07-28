/**
 * WebRTC Integration for Dual Audio Capture
 * This shows how to properly connect WebRTC remote streams to the DualAudioCapture system
 */

import { DualAudioCapture } from './dualAudioCapture';

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private dualAudioCapture: DualAudioCapture | null = null;
  
  constructor(dualCapture: DualAudioCapture) {
    this.dualAudioCapture = dualCapture;
  }

  /**
   * Initialize WebRTC peer connection with proper audio handling
   */
  async initializePeerConnection(configuration?: RTCConfiguration): Promise<void> {
    this.peerConnection = new RTCPeerConnection(configuration || {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    // 🎯 CRITICAL: Set up remote stream handler
    this.peerConnection.ontrack = (event: RTCTrackEvent) => {
      console.log('🎯 WebRTC track received:', event.track.kind);
      
      if (event.track.kind === 'audio' && event.streams[0]) {
        // Pass the remote audio stream to dual audio capture
        if (this.dualAudioCapture) {
          console.log('🔗 Connecting WebRTC remote stream to DualAudioCapture');
          this.dualAudioCapture.setRemoteStream(event.streams[0]);
        }
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('📡 Connection state:', this.peerConnection?.connectionState);
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', this.peerConnection?.iceConnectionState);
    };
  }

  /**
   * Add local stream to peer connection
   */
  async addLocalStream(stream: MediaStream): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    stream.getTracks().forEach(track => {
      this.peerConnection!.addTrack(track, stream);
    });
  }

  /**
   * Create offer for WebRTC connection
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });

    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  /**
   * Handle answer from remote peer
   */
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.setRemoteDescription(answer);
  }

  /**
   * Add ICE candidate
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.addIceCandidate(candidate);
  }

  /**
   * Clean up WebRTC connection
   */
  cleanup(): void {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }

  getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }
}

/**
 * Example usage in your app:
 * 
 * // 1. Initialize dual audio capture with audio mode
 * const dualCapture = new DualAudioCapture({
 *   chunkDuration: 5000,
 *   minInterval: 1000,
 *   transcriptionApiUrl: '/api/transcribe',
 *   transcriptionModel: 'whisper-1',
 *   audioMode: 'headphones' // or 'speakers'
 * });
 * 
 * // 2. Create WebRTC manager
 * const webrtcManager = new WebRTCManager(dualCapture);
 * 
 * // 3. Initialize peer connection
 * await webrtcManager.initializePeerConnection();
 * 
 * // 4. Initialize dual audio capture
 * await dualCapture.initialize();
 * 
 * // 5. Add local stream to WebRTC
 * const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
 * await webrtcManager.addLocalStream(localStream);
 * 
 * // 6. Start recording
 * await dualCapture.startRecording();
 * 
 * // The remote stream will be automatically connected when received via WebRTC
 */