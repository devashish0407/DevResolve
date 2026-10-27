import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './lib/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardLayout from './components/DashboardLayout';
import Dashboard from './pages/Dashboard';
import ChatPage from './pages/ChatPage';
import IntegrationsPage from './pages/IntegrationsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import OnboardingPage from './pages/OnboardingPage';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />

            {/* Protected routes — wrapped in dashboard layout with sidebar */}
            <Route path="/app" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="chat/:conversationId" element={<ChatPage />} />
              <Route path="integrations" element={<IntegrationsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
