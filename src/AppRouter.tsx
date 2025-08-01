import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/authContext';
import App from './App';
import LandingRouter from './landing/LandingRouter';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Landing pages */}
          <Route path="/landing/*" element={<LandingRouter />} />
          
          {/* Main app - everything else */}
          <Route path="/*" element={<App />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}