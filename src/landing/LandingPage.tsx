import { useEffect } from 'react';
import { useLandingLogic } from '../lib/useLandingLogic';
import './landing.css';

export default function LandingPage() {
  const { markLandingSeen } = useLandingLogic();

  useEffect(() => {
    // Mark that user has seen the landing page
    markLandingSeen();
  }, [markLandingSeen]);

  const handleStartCall = () => {
    // Redirect to main app instead of initiating WebRTC call
    window.location.href = '/';
  };

  return (
    <div id="landing-page-container">
      {/* Landing Page Header */}
      <header>
        <div className="header-container">
          <div className="logo">
            <img className="logo-icon" src="/assets/sprockett_logo.png" alt="Sprockett Logo" />
            Sprockett.ai
          </div>

          {/* Auth Links - TODO: Connect to existing auth system */}
          <div className="auth-header">
            <div id="auth-links" className="auth-links">
              <a href="#" className="auth-link">Sign In</a>
              <a href="#" className="auth-link">Sign Up</a>
            </div>
          </div>
        </div>
      </header>

      {/* Landing Page Hero Section */}
      <section className="hero">
        <div className="container hero-layout">
          <div className="hero-content">
            <h1>Smart Calls. Real-Time AI Coaching. Better Conversations.</h1>
            <p className="subtitle">
              Sprockett listens to your calls and whispers intelligent suggestions in real-time. Get AI coaching during
              sales calls, negotiations, interviews, and any conversation that matters.
            </p>
            <button 
              onClick={handleStartCall} 
              className="cta-button"
            >
              Start Your First Smart Call
            </button>

            <div style={{ marginTop: '1.5rem' }}>
              <a href="/landing/use-cases"
                style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500, fontSize: '1.1rem' }}>
                See Smart Calls in Action →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Landing Page Features Section */}
      <section className="features">
        <div className="container">
          <h2>AI-Powered Conversation Intelligence</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
              <h3 className="feature-title">Real-Time AI Coaching</h3>
              <p>Get intelligent suggestions during your call based on what both people are saying.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z M11 16.92c-3.94-.49-7-3.85-7-7.92h2c0 2.76 2.24 5 5 5s5-2.24 5-5h2c0 4.07-3.06 7.43-7 7.92V22h2v2H9v-2h2v-5.08z" />
                </svg>
              </div>
              <h3 className="feature-title">Dual-Stream Transcription</h3>
              <p>Captures and understands both sides of the conversation for complete context.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M9 11H7v9a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-5l-2-2H9a2 2 0 0 0-2 2z" />
                </svg>
              </div>
              <h3 className="feature-title">Custom Prompts</h3>
              <p>Tell the AI your goals: "Help me close this deal" or "Coach me through this negotiation".</p>
            </div>
          </div>
        </div>
      </section>

      {/* Landing Page How It Works Section */}
      <section className="how-it-works">
        <div className="container">
          <h2>How Smart Calls Make You Better at Conversations</h2>
          <p style={{ color: 'var(--secondary-text)', textAlign: 'center', maxWidth: '600px', margin: '0 auto 2rem' }}>
            The world's first AI-powered conversation coaching that works in real-time during your actual calls.
          </p>
          <div className="steps">
            <div className="step">
              <h3 className="step-title">Set Your Intent</h3>
              <p className="step-description">Before the call, tell the AI your goal: close a deal, nail an interview, or
                navigate a difficult conversation.</p>
            </div>
            <div className="step">
              <h3 className="step-title">AI Listens & Learns</h3>
              <p className="step-description">Sprockett captures both audio streams, transcribes everything, and understands
                the full context.</p>
            </div>
            <div className="step">
              <h3 className="step-title">Real-Time Coaching</h3>
              <p className="step-description">Get intelligent suggestions like "They're showing interest - ask about timeline"
                or "Acknowledge their concern first".</p>
            </div>
            <div className="step">
              <h3 className="step-title">Stay in Flow</h3>
              <p className="step-description">Suggestions appear only to you in a subtle sidebar. Stay natural while getting
                superhuman conversation skills.</p>
            </div>
            <div className="step">
              <h3 className="step-title">Privacy Built-In</h3>
              <p className="step-description">End-to-end encrypted calls with AI processing only what you allow. No storage
                unless you choose it.</p>
            </div>
            <div className="step">
              <h3 className="step-title">Get Better Every Call</h3>
              <p className="step-description">Learn from AI insights and become naturally better at reading people and
                navigating conversations.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Landing Page Footer */}
      <footer>
        <div className="container">
          <div className="footer-links">
            <a href="/landing/use-cases" className="footer-link">Use Cases</a>
            <a href="/landing/privacy" className="footer-link">Privacy</a>
            <a href="/landing/terms" className="footer-link">Terms</a>
            <a href="/landing/report" className="footer-link">Report</a>
            <a href="/landing/about" className="footer-link">About</a>
          </div>
          <p className="copyright">© 2025 Sprockett. Making every conversation smarter.</p>
        </div>
      </footer>
    </div>
  );
}