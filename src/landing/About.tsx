import LandingLayout from './components/LandingLayout';

export default function About() {
  return (
    <LandingLayout title="About Sprockett">
      <div style={{ maxWidth: '800px', margin: '0 auto', lineHeight: '1.6' }}>
        <section style={{ marginBottom: '3rem' }}>
          <h2>Making Every Conversation Smarter</h2>
          <p style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>
            Sprockett is the world's first real-time AI conversation coach. We believe that better 
            conversations lead to better outcomes in business and life.
          </p>
          <p>
            Our AI listens to your calls and provides intelligent, contextual suggestions exactly 
            when you need them. Whether you're closing a deal, interviewing for your dream job, or 
            navigating a difficult conversation, Sprockett helps you communicate with confidence.
          </p>
        </section>

        <section style={{ marginBottom: '3rem' }}>
          <h2>Our Mission</h2>
          <p>
            To democratize great communication skills by giving everyone access to real-time coaching 
            and conversation intelligence. We're building a future where anyone can be an exceptional communicator.
          </p>
        </section>

        <section style={{ marginBottom: '3rem' }}>
          <h2>How It Works</h2>
          <div style={{ display: 'grid', gap: '1.5rem', marginTop: '1rem' }}>
            <div>
              <h3>🎯 Set Your Goal</h3>
              <p>Tell Sprockett what you want to achieve in your conversation.</p>
            </div>
            <div>
              <h3>🎧 AI Listens</h3>
              <p>Our AI processes both sides of the conversation in real-time.</p>
            </div>
            <div>
              <h3>💡 Get Coaching</h3>
              <p>Receive intelligent suggestions that only you can see.</p>
            </div>
            <div>
              <h3>🚀 Improve</h3>
              <p>Learn and grow from every conversation with personalized insights.</p>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: '3rem' }}>
          <h2>Privacy First</h2>
          <p>
            We built Sprockett with privacy as a core principle. Your conversations are processed 
            in real-time and not stored. We believe your private conversations should stay private.
          </p>
        </section>

        <section>
          <h2>Contact Us</h2>
          <p>
            Have questions or feedback? We'd love to hear from you at{' '}
            <a href="mailto:hello@sprockett.ai">hello@sprockett.ai</a>
          </p>
        </section>
      </div>
    </LandingLayout>
  );
}