import LandingLayout from './components/LandingLayout';

export default function Privacy() {
  return (
    <LandingLayout title="Privacy Policy">
      <div style={{ maxWidth: '800px', margin: '0 auto', lineHeight: '1.6' }}>
        <p style={{ marginBottom: '2rem', fontSize: '1.1rem', color: 'var(--secondary-text)' }}>
          Last updated: January 2025
        </p>

        <section style={{ marginBottom: '2rem' }}>
          <h2>Our Privacy Commitment</h2>
          <p>
            Sprockett is built privacy-first. We believe your conversations are yours, and our technology is designed 
            to respect that fundamental principle. This policy explains how we handle your data.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2>What We Collect</h2>
          <h3>Account Information</h3>
          <ul>
            <li>Email address for account creation and communication</li>
            <li>Password (encrypted and never stored in plain text)</li>
            <li>Usage preferences and settings</li>
          </ul>
          
          <h3>Session Data</h3>
          <ul>
            <li>Audio transcriptions (processed in real-time, not permanently stored)</li>
            <li>AI coaching suggestions generated during your calls</li>
            <li>Session duration and basic usage metrics</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2>What We Don't Do</h2>
          <ul>
            <li><strong>We don't record your calls</strong> - Audio is processed in real-time and discarded</li>
            <li><strong>We don't store conversation content</strong> - Transcriptions are temporary</li>
            <li><strong>We don't share with third parties</strong> - Your data stays with us</li>
            <li><strong>We don't train AI on your conversations</strong> - Your content remains private</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2>How We Protect Your Data</h2>
          <ul>
            <li>End-to-end encryption for all call data</li>
            <li>Secure cloud infrastructure with enterprise-grade security</li>
            <li>Regular security audits and updates</li>
            <li>Limited employee access on a need-to-know basis</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2>Your Rights</h2>
          <ul>
            <li>Access your account data</li>
            <li>Delete your account and associated data</li>
            <li>Export your data</li>
            <li>Opt out of AI processing at any time</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2>Contact Us</h2>
          <p>
            Questions about privacy? Email us at <a href="mailto:privacy@sprockett.ai">privacy@sprockett.ai</a>
          </p>
        </section>
      </div>
    </LandingLayout>
  );
}