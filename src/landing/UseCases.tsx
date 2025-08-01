import LandingLayout from './components/LandingLayout';

export default function UseCases() {
  return (
    <LandingLayout title="Smart Calls Use Cases">
      <div className="intro">
        See how Sprockett's real-time AI coaching transforms different types of conversations. 
        From sales calls to job interviews, get the right guidance exactly when you need it.
      </div>

      <div className="use-cases-grid">
        <div className="use-case">
          <div className="use-case-header">
            <h2 className="use-case-title">🎯 Sales Conversations</h2>
            <p className="use-case-subtitle">Close more deals with real-time coaching</p>
          </div>
          <div className="use-case-content">
            <h3>What Sprockett Does</h3>
            <ul>
              <li>Detects buying signals and interest levels</li>
              <li>Suggests timing for asks and closes</li>
              <li>Helps handle objections with empathy</li>
              <li>Guides price and timeline discussions</li>
            </ul>
            <h3>Example Coaching</h3>
            <blockquote>
              "They just mentioned budget constraints - acknowledge this concern first, then focus on ROI and value rather than price."
            </blockquote>
          </div>
        </div>

        <div className="use-case">
          <div className="use-case-header">
            <h2 className="use-case-title">💼 Job Interviews</h2>
            <p className="use-case-subtitle">Show your best self with confidence</p>
          </div>
          <div className="use-case-content">
            <h3>What Sprockett Does</h3>
            <ul>
              <li>Helps you give complete, structured answers</li>
              <li>Reminds you to ask insightful questions</li>
              <li>Suggests examples that highlight your experience</li>
              <li>Guides conversation toward your strengths</li>
            </ul>
            <h3>Example Coaching</h3>
            <blockquote>
              "Great start - now add a specific example of how you led that project and the measurable results you achieved."
            </blockquote>
          </div>
        </div>

        <div className="use-case">
          <div className="use-case-header">
            <h2 className="use-case-title">🤝 Negotiations</h2>
            <p className="use-case-subtitle">Find win-win solutions</p>
          </div>
          <div className="use-case-content">
            <h3>What Sprockett Does</h3>
            <ul>
              <li>Identifies underlying interests vs. positions</li>
              <li>Suggests creative solutions and alternatives</li>
              <li>Helps maintain relationship while advocating</li>
              <li>Guides timing for concessions and asks</li>
            </ul>
            <h3>Example Coaching</h3>
            <blockquote>
              "They're focused on timeline - explore if there's flexibility on scope or resources that could meet both your needs."
            </blockquote>
          </div>
        </div>

        <div className="use-case">
          <div className="use-case-header">
            <h2 className="use-case-title">❤️ Customer Support</h2>
            <p className="use-case-subtitle">Build trust and resolve issues</p>
          </div>
          <div className="use-case-content">
            <h3>What Sprockett Does</h3>
            <ul>
              <li>Helps de-escalate frustrated customers</li>
              <li>Suggests empathetic responses and acknowledgments</li>
              <li>Guides toward solutions and next steps</li>
              <li>Ensures follow-through and accountability</li>
            </ul>
            <h3>Example Coaching</h3>
            <blockquote>
              "They're expressing frustration - start by acknowledging their experience, then focus on what you can do to help."
            </blockquote>
          </div>
        </div>
      </div>
    </LandingLayout>
  );
}