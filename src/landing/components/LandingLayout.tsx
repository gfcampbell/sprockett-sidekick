import React from 'react';

interface LandingLayoutProps {
  children: React.ReactNode;
  title: string;
}

export default function LandingLayout({ children, title }: LandingLayoutProps) {
  return (
    <div className="landing-page">
      {/* Simple header for landing pages */}
      <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <a href="/landing" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src="/assets/sprockett_logo.png" alt="Sprockett Logo" style={{ height: '40px' }} />
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Sprockett.ai</span>
          </div>
        </a>
      </header>

      {/* Page content */}
      <div className="container">
        <h1>{title}</h1>
        {children}
      </div>

      {/* Back to main CTA */}
      <div style={{ textAlign: 'center', margin: '4rem 0' }}>
        <a 
          href="/" 
          style={{ 
            display: 'inline-block',
            padding: '12px 24px',
            backgroundColor: 'var(--accent, #387FD0)',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: 500
          }}
        >
          Start Your Smart Call →
        </a>
      </div>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '2rem', color: 'var(--secondary-text, #666)' }}>
        <div>
          <a href="/landing/use-cases" style={{ margin: '0 1rem', color: 'inherit' }}>Use Cases</a>
          <a href="/landing/privacy" style={{ margin: '0 1rem', color: 'inherit' }}>Privacy</a>
          <a href="/landing/terms" style={{ margin: '0 1rem', color: 'inherit' }}>Terms</a>
          <a href="/landing/report" style={{ margin: '0 1rem', color: 'inherit' }}>Report</a>
          <a href="/landing/about" style={{ margin: '0 1rem', color: 'inherit' }}>About</a>
        </div>
        <p style={{ marginTop: '1rem' }}>© 2025 Sprockett. Making every conversation smarter.</p>
      </footer>
    </div>
  );
}