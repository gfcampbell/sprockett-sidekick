import LandingLayout from './components/LandingLayout';

export default function Report() {
  return (
    <LandingLayout title="Report an Issue">
      <div style={{ maxWidth: '600px', margin: '0 auto', lineHeight: '1.6' }}>
        <p style={{ marginBottom: '2rem', fontSize: '1.1rem' }}>
          We take all reports seriously and appreciate your help in making Sprockett better for everyone.
        </p>

        <section style={{ marginBottom: '2rem' }}>
          <h2>What to Report</h2>
          <ul>
            <li>Security vulnerabilities</li>
            <li>Privacy concerns</li>
            <li>Inappropriate AI suggestions</li>
            <li>Technical bugs or issues</li>
            <li>Terms of service violations</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2>How to Report</h2>
          <p>
            Send us a detailed email at <a href="mailto:report@sprockett.ai">report@sprockett.ai</a> with:
          </p>
          <ul>
            <li>Description of the issue</li>
            <li>Steps to reproduce (if applicable)</li>
            <li>Screenshots or examples (if relevant)</li>
            <li>Your contact information</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2>What Happens Next</h2>
          <ul>
            <li>We'll acknowledge your report within 24 hours</li>
            <li>Our team will investigate the issue</li>
            <li>We'll keep you updated on progress</li>
            <li>For security issues, we may work with you on responsible disclosure</li>
          </ul>
        </section>

        <section>
          <h2>Emergency Contact</h2>
          <p>
            For urgent security issues that could affect user safety, please email{' '}
            <a href="mailto:security@sprockett.ai">security@sprockett.ai</a> with "URGENT" in the subject line.
          </p>
        </section>
      </div>
    </LandingLayout>
  );
}