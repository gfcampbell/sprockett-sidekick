// Security Panel Component Loader
const SecurityPanel = {
  // Panel state
  state: {
    isOpen: false,
    callQuality: 85,
    securityData: {
      tlsSignaling: false,
      dtlsSrtp: false,  
      iceConnection: false,
      stunTurnServers: false,
      tokenAuthentication: false,
      httpSecurity: true,
      roomIdSecurity: true
    },
    updateInterval: null
  },
  
  // Initialize the panel
  init: () => {
    // Create panel HTML
    SecurityPanel.createPanelHTML();
    
    // Set up event handlers
    document.getElementById('panel-toggle').addEventListener('click', () => {
      SecurityPanel.togglePanel();
    });
    
    // Start monitoring mock data
    SecurityPanel.startMonitoring();
    
    return SecurityPanel;
  },
  
  // Create the panel HTML structure
  createPanelHTML: () => {
    // Add styles for the panel
    const style = document.createElement('style');
    style.textContent = `
      /* Security Panel Styles */
      .security-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        transition: all 0.3s ease;
        border-radius: 8px;
        overflow: visible;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      }
      
      .security-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #333;
        color: white;
        border: none;
        padding: 6px 10px;
        cursor: pointer;
        width: 100%;
        border-radius: 8px;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      }
      
      .security-toggle:hover {
        background: #444;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }
      
      .indicators {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .shield-icon {
        height: 28px;
        width: 24px;
      }
      
      .shield-icon.secure { color: var(--success-color); }
      .shield-icon.mixed { color: var(--warning-color); }
      .shield-icon.insecure { color: var(--error-color); }
      
      .connection-bar {
        width: 65px;
        height: 16px;
        background-color: #e0e0e0;
        border-radius: 4px;
        position: relative;
        overflow: hidden;
      }
      
      .connection-fill {
        height: 100%;
        width: 33%;
        transition: width 0.3s ease;
      }
      
      .connection-fill.good { 
        width: 100%;
        background-color: var(--success-color); 
      }
      .connection-fill.fair { 
        width: 66%;
        background-color: var(--warning-color); 
      }
      .connection-fill.poor { 
        width: 33%;
        background-color: var(--error-color); 
      }
      
      .security-indicator, .quality-indicator {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        margin-left: 8px;
        display: none;
      }
      
      .security-indicator.secure { background: var(--success-color); }
      .security-indicator.insecure { background: var(--error-color); }
      .security-indicator.mixed { background: var(--warning-color); }
      .quality-indicator.good { background: var(--success-color); }
      .quality-indicator.fair { background: var(--warning-color); }
      .quality-indicator.poor { background: var(--error-color); }
      
      .panel-content {
        position: absolute;
        top: 100%;
        right: 0;
        width: 280px;
        padding: 20px;
        color: var(--text-color);
        background: var(--foreground-color);
        border-radius: 8px;
        margin-top: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 999;
      }
      
      .status-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background-color 0.2s ease;
      }
      
      .status-item:hover {
        background-color: rgba(0,0,0,0.05);
      }
      
      .status-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        position: relative;
        transition: transform 0.2s ease;
      }
      
      .status-item:hover .status-dot {
        transform: scale(1.2);
      }
      
      .status-dot.secure { 
        background: var(--success-color);
        box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
      }
      
      .status-dot.insecure { 
        background: var(--error-color);
        box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
      }
      
      .section-title {
        margin: 0 0 16px 0;
        font-weight: 500;
        font-size: 16px;
        color: var(--accent-color);
        display: flex;
        align-items: center;
      }
      
      .section-title::before {
        content: "";
        display: inline-block;
        width: 4px;
        height: 16px;
        background: var(--accent-color);
        margin-right: 8px;
        border-radius: 2px;
      }
      
      .section-divider {
        height: 1px;
        background: linear-gradient(to right, var(--border-color), transparent);
        margin: 20px 0;
      }
      
      .meter-container {
        height: 10px;
        background: var(--muted-color);
        border-radius: 20px;
        overflow: hidden;
        margin: 12px 0;
        position: relative;
        box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
      }
      
      .meter-fill {
        height: 100%;
        transition: width 0.3s ease;
        position: relative;
        border-radius: 20px;
      }
      
      .meter-fill.good { 
        background: linear-gradient(to right, var(--success-color), #4ade80);
      }
      
      .meter-fill.fair { 
        background: linear-gradient(to right, var(--warning-color), #fbbf24);
      }
      
      .meter-fill.poor { 
        background: linear-gradient(to right, var(--error-color), #f87171);
      }
      
      .meter-fill::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(to bottom, rgba(255,255,255,0.1), rgba(255,255,255,0));
        border-radius: 20px;
      }
      
      .meter-labels {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: var(--primary-color);
        margin-bottom: 0;
      }
      
      .quality-message {
        display: none;
      }
      
      .toggle-icon {
        width: 16px;
        height: 16px;
      }
    `;
    document.head.appendChild(style);
    
    // Create panel element
    const panelDiv = document.createElement('div');
    panelDiv.id = 'security-panel';
    panelDiv.className = 'security-panel';
    
    // Set inner HTML for the panel
    panelDiv.innerHTML = `
      <button id="panel-toggle" class="security-toggle">
        <div class="indicators">
          <svg id="shield-icon" class="shield-icon insecure" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M12,2 C10,4 4,6 4,6 C4,6 3,16 12,22 C21,16 20,6 20,6 C14,4 12,2 12,2 Z" 
                  fill="currentColor" 
                  stroke="none" />
            <circle cx="12" cy="10" r="2" fill="black" />
            <rect x="11" y="10" width="2" height="4" fill="black" />
          </svg>
          <div id="connection-bar" class="connection-bar">
            <div id="connection-fill" class="connection-fill good"></div>
          </div>
        </div>
        <span id="panel-title" style="color: white; font-weight: 500; display: none;">Security & Quality</span>
        <div class="indicators" style="display: none;">
          <span id="security-indicator" class="security-indicator insecure"></span>
          <span id="quality-indicator" class="quality-indicator good"></span>
        </div>
      </button>
      <div id="panel-content" class="panel-content" style="display: none;">
        <h4 class="section-title">Security Status</h4>
        <!-- Structural Security Items (Always Green) -->
        <div style="padding-left: 12px;">
          <div class="status-item">
            <span>Website Protection</span>
            <span id="http-dot" class="status-dot secure"></span>
          </div>
          <div class="status-item">
            <span>Room Privacy</span>
            <span id="room-dot" class="status-dot secure"></span>
          </div>
          
          <!-- Variable Security Items -->
          <div class="status-item">
            <span>Connection Security</span>
            <span id="tls-dot" class="status-dot insecure"></span>
          </div>
          <div class="status-item">
            <span>Call Encryption</span>
            <span id="dtls-dot" class="status-dot insecure"></span>
          </div>
          <div class="status-item">
            <span>Network Stability</span>
            <span id="ice-dot" class="status-dot insecure"></span>
          </div>
          <div class="status-item">
            <span>Connection Servers</span>
            <span id="stun-dot" class="status-dot insecure"></span>
          </div>
          <div class="status-item">
            <span>Private Access</span>
            <span id="token-dot" class="status-dot insecure"></span>
          </div>
        </div>
        
        <div class="section-divider"></div>
        
        <h4 class="section-title">Call Quality</h4>
        <div style="padding-left: 12px;">
          <div class="meter-container">
            <div id="quality-meter" class="meter-fill good" style="width: 85%;"></div>
          </div>
          <div class="meter-labels">
            <span>Poor</span>
            <span>Excellent</span>
          </div>
        </div>
      </div>
    `;
    
    // Add to body
    document.body.appendChild(panelDiv);
  },
  
  // Toggle panel open/closed
  togglePanel: () => {
    SecurityPanel.state.isOpen = !SecurityPanel.state.isOpen;
    const panel = document.getElementById('security-panel');
    const content = document.getElementById('panel-content');
    const toggleIcon = document.getElementById('toggle-icon');
    const connectionBar = document.getElementById('connection-bar');
    const panelTitle = document.getElementById('panel-title');
    
    if (SecurityPanel.state.isOpen) {
      content.style.display = 'block';
      if (toggleIcon) toggleIcon.textContent = '▼';
      if (connectionBar) connectionBar.style.display = 'none';
      if (panelTitle) panelTitle.style.display = 'block';
    } else {
      content.style.display = 'none';
      if (toggleIcon) toggleIcon.textContent = '▲';
      if (connectionBar) connectionBar.style.display = 'block';
      if (panelTitle) panelTitle.style.display = 'none';
    }
  },
  
  // Update quality status
  updateQuality: (value) => {
    SecurityPanel.state.callQuality = value;
    
    const qualityMeter = document.getElementById('quality-meter');
    const qualityMessage = document.getElementById('quality-message');
    const qualityIndicator = document.getElementById('quality-indicator');
    
    if (!qualityMeter || !qualityMessage) return;
    
    // Update meter width
    qualityMeter.style.width = `${value}%`;
    
    // Update meter color and indicator
    if (value < 30) {
      qualityMeter.className = 'meter-fill poor';
      if (qualityIndicator) qualityIndicator.className = 'quality-indicator poor';
      qualityMessage.textContent = 'Poor Connection';
    } else if (value < 70) {
      qualityMeter.className = 'meter-fill fair';
      if (qualityIndicator) qualityIndicator.className = 'quality-indicator fair';
      qualityMessage.textContent = 'Fair Connection';
    } else {
      qualityMeter.className = 'meter-fill good';
      if (qualityIndicator) qualityIndicator.className = 'quality-indicator good';
      qualityMessage.textContent = 'Excellent Connection';
    }
  },
  
  // Update security indicators
  updateSecurityStatus: () => {
    const tlsDot = document.getElementById('tls-dot');
    const dtlsDot = document.getElementById('dtls-dot');
    const iceDot = document.getElementById('ice-dot');
    const stunDot = document.getElementById('stun-dot');
    const tokenDot = document.getElementById('token-dot');
    const httpDot = document.getElementById('http-dot');
    const roomDot = document.getElementById('room-dot');
    const securityIndicator = document.getElementById('security-indicator');
    const shieldIcon = document.getElementById('shield-icon');
    
    if (!tlsDot || !dtlsDot || !iceDot || !stunDot || !tokenDot || !httpDot || !roomDot) return;
    
    // Update individual dots
    tlsDot.className = `status-dot ${SecurityPanel.state.securityData.tlsSignaling ? 'secure' : 'insecure'}`;
    dtlsDot.className = `status-dot ${SecurityPanel.state.securityData.dtlsSrtp ? 'secure' : 'insecure'}`;
    iceDot.className = `status-dot ${SecurityPanel.state.securityData.iceConnection ? 'secure' : 'insecure'}`;
    stunDot.className = `status-dot ${SecurityPanel.state.securityData.stunTurnServers ? 'secure' : 'insecure'}`;
    tokenDot.className = `status-dot ${SecurityPanel.state.securityData.tokenAuthentication ? 'secure' : 'insecure'}`;
    httpDot.className = `status-dot ${SecurityPanel.state.securityData.httpSecurity ? 'secure' : 'insecure'}`;
    roomDot.className = `status-dot ${SecurityPanel.state.securityData.roomIdSecurity ? 'secure' : 'insecure'}`;
    
    // Count secure and insecure indicators
    const secureCount = [
      SecurityPanel.state.securityData.tlsSignaling,
      SecurityPanel.state.securityData.dtlsSrtp,
      SecurityPanel.state.securityData.iceConnection,
      SecurityPanel.state.securityData.stunTurnServers,
      SecurityPanel.state.securityData.tokenAuthentication,
      SecurityPanel.state.securityData.httpSecurity,
      SecurityPanel.state.securityData.roomIdSecurity
    ].filter(Boolean).length;
    
    const insecureCount = 7 - secureCount;
    
    // Update main indicator based on counts
    if (securityIndicator) {
      if (secureCount === 7) {
        // All green
        securityIndicator.className = 'security-indicator secure';
      } else if (insecureCount === 7) {
        // All red
        securityIndicator.className = 'security-indicator insecure';
      } else {
        // Mixed (yellow)
        securityIndicator.className = 'security-indicator mixed';
      }
    }
    
    // Update shield icon color
    if (shieldIcon) {
      if (secureCount === 7) {
        // All secure
        shieldIcon.className = 'shield-icon secure';
      } else if (insecureCount === 7) {
        // All insecure
        shieldIcon.className = 'shield-icon insecure';
      } else {
        // Mixed (yellow)
        shieldIcon.className = 'shield-icon mixed';
      }
    }
  },
  
  // Start monitoring mock data
  startMonitoring: () => {
    SecurityPanel.updateSecurityStatus();
    SecurityPanel.updateQuality(SecurityPanel.state.callQuality);
    
    // Simulate quality fluctuations
    SecurityPanel.state.updateInterval = setInterval(() => {
      // Small random fluctuation (+/- 10%)
      const fluctuation = Math.floor(Math.random() * 20) - 10;
      let newQuality = SecurityPanel.state.callQuality + fluctuation;
      
      // Keep within bounds
      newQuality = Math.max(10, Math.min(100, newQuality));
      
      SecurityPanel.updateQuality(newQuality);
    }, 3000);
    
    // Simulate security status changes after a delay (simulating a call connection)
    setTimeout(() => {
      // Simulate a call connecting
      SecurityPanel.setSecurityData({
        tlsSignaling: true,
        dtlsSrtp: true
      });
      
      // Simulate ICE connection after a short delay
      setTimeout(() => {
        SecurityPanel.setSecurityData({
          iceConnection: true
        });
        
        // Finally STUN/TURN successful
        setTimeout(() => {
          SecurityPanel.setSecurityData({
            stunTurnServers: true
          });
        }, 1500);
      }, 1500);
    }, 3000);
  },
  
  // Stop monitoring
  stopMonitoring: () => {
    if (SecurityPanel.state.updateInterval) {
      clearInterval(SecurityPanel.state.updateInterval);
      SecurityPanel.state.updateInterval = null;
    }
  },
  
  // Set real data from WebRTC
  setSecurityData: (data) => {
    // This can be called from your connection.js to update with real data
    SecurityPanel.state.securityData = {
      ...SecurityPanel.state.securityData,
      ...data
    };
    SecurityPanel.updateSecurityStatus();
  },
  
  // Set real quality data
  setQualityData: (quality) => {
    SecurityPanel.updateQuality(quality);
  },
  
  // Clean up
  destroy: () => {
    SecurityPanel.stopMonitoring();
    const panel = document.getElementById('security-panel');
    if (panel) {
      panel.remove();
    }
  }
};

// Export for global use
window.SecurityPanel = SecurityPanel; 