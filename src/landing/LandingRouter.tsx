import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './LandingPage';
import UseCases from './UseCases';
import Privacy from './Privacy';
import Terms from './Terms';
import About from './About';
import Report from './Report';

export default function LandingRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/use-cases" element={<UseCases />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/about" element={<About />} />
      <Route path="/report" element={<Report />} />
      {/* Redirect any unknown landing routes to main landing page */}
      <Route path="*" element={<Navigate to="/landing" replace />} />
    </Routes>
  );
}