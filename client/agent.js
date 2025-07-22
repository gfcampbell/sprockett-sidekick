// agent.js - AI monitoring system for WebRTC connections
// Handles quality monitoring, trust validation, and fallback strategies

import Trust from './trust.js';

class OblivnAgent {
  constructor(pc, dc, showMessageCallback = null) {
    this.pc = pc;
    this.dc = dc;
    this.isAudioOnly = false;
    this.trustToken = null;
    this.lastTokenCheck = 0;
    this.showMessage = showMessageCallback; // Accept showMessage as dependency injection
  }

  start() {
    // Generate initial trust token
    Trust._hash("bootstrap").then(initialHash => {
      this.trustToken = Trust.generateToken({ key: "bootstrap", sessionId: "session-" + Date.now(), issuedAt: Date.now(), prevHash: null });
    });

    this.loop = setInterval(async () => {
      const now = Date.now();
      if (now - this.lastTokenCheck > 60000) { // rotate every 60s
        const newToken = Trust.rotate(this.trustToken);
        Promise.resolve(newToken).then(t => {
          this.trustToken = t;
          this.lastTokenCheck = now;
        });
      }

      const stats = await this.pc.getStats();
      const report = this.extract(stats);
      this.dc.send(JSON.stringify({
        type: "agent-stats",
        metrics: report,
        trust: this.trustToken
      }));
    }, 5000);

    this.dc.onmessage = async (e) => {
      const data = JSON.parse(e.data);
      const remote = data?.metrics;
      if (!remote) return;

      // Validate trust token if present
      if (data.trust) {
        Trust.validateToken(data.trust, this.trustToken).then(isValid => {
          if (!isValid) {
            console.warn("🚨 Trust validation failed. Dropping call.");
            if (this.showMessage) {
              this.showMessage("Security threat detected. Call terminated.", "error");
            }
            this.pc.close();
          } else {
            console.log("🔐 Trust token validated.");
            if (this.showMessage) {
              this.showMessage("Session token revalidated.", "success");
            }
          }
        });
      }

      this.lastRemote = remote;

      const local = this.extract(await this.pc.getStats());

      if (!this.isAudioOnly && this.shouldFallback(local, remote)) {
        this.fallbackToAudioOnly();
        this.isAudioOnly = true;
      } else if (this.isAudioOnly && this.shouldRecover(local, remote)) {
        this.restoreVideo();
        this.isAudioOnly = false;
      }
    };
  }

  extract(stats) {
    const metrics = {
      packetLoss: null,
      jitter: null,
      rtt: null,
      fps: null,
      frameWidth: null,
      frameHeight: null
    };

    stats.forEach(report => {
      if (report.type === "inbound-rtp" && report.kind === "video") {
        metrics.packetLoss = report.packetsLost / report.packetsReceived || 0;
        metrics.jitter = report.jitter;
        metrics.fps = report.framesPerSecond;
      }
      if (report.type === "candidate-pair" && report.state === "succeeded") {
        metrics.rtt = report.currentRoundTripTime;
      }
      if (report.type === "track" && report.frameWidth) {
        metrics.frameWidth = report.frameWidth;
        metrics.frameHeight = report.frameHeight;
      }
    });

    return metrics;
  }

  stop() {
    clearInterval(this.loop);
  }

  reduceVideoQuality() {
    const sender = this.pc.getSenders().find(s => s.track?.kind === 'video');
    if (sender && sender.track) {
      sender.track.applyConstraints({
        width: { max: 640 },
        height: { max: 360 },
        frameRate: { max: 15 }
      }).then(() => {
        console.log("🎚️ Agent reduced local video quality to conserve bandwidth.");
      }).catch(err => {
        console.error("❌ Failed to reduce video quality:", err);
      });
    }
  }

  fallbackToAudioOnly() {
    const videoSender = this.pc.getSenders().find(s => s.track?.kind === "video");

    if (videoSender && videoSender.track) {
      videoSender.track.stop();
      console.warn("🔇 Agent triggered audio-only fallback due to poor connection.");
      
      // Optional: notify UI layer
      if (this.showMessage) {
        this.showMessage("Switched to audio-only mode to preserve call quality.", "warning");
      }
    }
  }

  shouldFallback(local, remote) {
    return (
      (local.packetLoss > 0.08 || remote.packetLoss > 0.08) ||
      (local.jitter > 75 || remote.jitter > 75) ||
      (local.rtt > 400 || remote.rtt > 400)
    );
  }

  shouldRecover(local, remote) {
    return (
      local.packetLoss < 0.02 &&
      remote.packetLoss < 0.02 &&
      local.jitter < 20 &&
      remote.jitter < 20 &&
      local.rtt < 150 &&
      remote.rtt < 150
    );
  }

  restoreVideo() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      const track = stream.getVideoTracks()[0];
      const sender = this.pc.getSenders().find(s => s.track?.kind === "video");
      if (sender) sender.replaceTrack(track);
      console.log("🎥 Agent restored video after connection improved.");
      if (this.showMessage) {
        this.showMessage("Restored full video", "success");
      }
    }).catch(err => {
      console.warn("Could not restore video:", err);
    });
  }

  async getPeerFingerprint() {
    const stats = await this.pc.getStats();
    for (const report of stats.values()) {
      if (report.type === "certificate" && report.fingerprint) {
        return report.fingerprint; // SHA-256 fingerprint
      }
    }
    return null;
  }
}

// 🆕 PHASE 2: ES6 Module Export
export default OblivnAgent; 