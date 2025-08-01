import LandingLayout from './components/LandingLayout';

export default function Terms() {
  return (
    <LandingLayout title="Terms of Service">
      <div style={{ maxWidth: '800px', margin: '0 auto', lineHeight: '1.6' }}>
        <p style={{ marginBottom: '2rem', fontSize: '1.1rem', color: 'var(--secondary-text)' }}>
          Last updated: January 2025
        </p>

        <section style={{ marginBottom: '2rem' }}>
          <h2>Agreement to Terms</h2>
          <p>
            By using Sprockett, you agree to these terms. If you don't agree, please don't use our service.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2>Service Description</h2>
          <p>
            Sprockett provides real-time AI coaching for conversations through voice transcription and 
            intelligent suggestions. Our service is designed to help you communicate more effectively.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2>Acceptable Use</h2>
          <h3>You may use Sprockett to:</h3>
          <ul>
            <li>Improve your communication skills</li>
            <li>Get coaching during business conversations</li>
            <li>Enhance your interview and sales performance</li>
          </ul>
          
          <h3>You may not use Sprockett to:</h3>
          <ul>
            <li>Record conversations without proper consent</li>
            <li>Violate local laws regarding call recording</li>
            <li>Harass, abuse, or harm others</li>
            <li>Share access with unauthorized users</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2>Your Responsibilities</h2>
          <ul>
            <li>Ensure you have permission to record/transcribe conversations in your jurisdiction</li>
            <li>Maintain the security of your account credentials</li>
            <li>Use the service ethically and legally</li>
            <li>Respect others' privacy and consent</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2>Service Availability</h2>
          <p>
            We strive for high availability but cannot guarantee uninterrupted service. We may update, 
            modify, or discontinue features with reasonable notice.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2>Limitation of Liability</h2>
          <p>
            Sprockett provides suggestions and coaching, but you're responsible for your own decisions 
            and actions. We're not liable for outcomes of conversations or business decisions.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2>Contact</h2>
          <p>
            Questions about these terms? Email us at <a href="mailto:legal@sprockett.ai">legal@sprockett.ai</a>
          </p>
        </section>
      </div>
    </LandingLayout>
  );
}