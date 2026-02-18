import { useState } from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import Login from './Login'
import Signup from './Signup'
import PatientDashboard from './PatientDashboard'
import StaffDashboard from './StaffDashboard'
import ErrorBoundary from "./ErrorBoundary/ErrorBoundary";
import './App.css'

function AppContent() {
  const { user, loading } = useAuth();
  const [showSignup, setShowSignup] = useState(false);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    if (showSignup) {
      return <Signup onSwitchToLogin={() => setShowSignup(false)} />;
    }
    return <Login onSwitchToSignup={() => setShowSignup(true)} />;
  }

  if (user.user_type === 'staff') {
    return <StaffDashboard />;
  }

  return <PatientDashboard />;
}

function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </AuthProvider>
  );
}

export default App
