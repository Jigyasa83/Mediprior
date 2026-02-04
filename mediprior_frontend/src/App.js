// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext'; // Import AuthProvider here

// Import Components
import Sidebar from './components/Sidebar'; 

// Import Pages
import Signup from './pages/Signup';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FindDoctors from './pages/FindDoctors';
import MyConnections from './pages/MyConnections';
import PatientReportsPage from './pages/PatientReportsPage';
import ChatPage from './pages/ChatPage'; 
import CalendarPage from './pages/CalendarPage';
import LandingPage from './pages/LandingPage'; 
import ForgotPassword from './pages/ForgotPassword';
import ResetPasswordConfirm from './pages/ResetPasswordConfirm';

import './index.css'; 

const AppContent = () => {
    const location = useLocation();
    const { user } = useAuth(); 
    
    // Only show sidebar if user is logged in AND not on public pages
    const showSidebar = user && 
                        location.pathname !== '/login' && 
                        location.pathname !== '/signup' && 
                        location.pathname !== '/';

    return (
        <div className={showSidebar ? "app-layout" : ""}>
            {showSidebar && <Sidebar />}
            <main className={showSidebar ? "main-content" : "main-content-full"}>
                <Routes>
                    {/* --- Public Routes --- */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/password-reset-confirm/:uid/:token" element={<ResetPasswordConfirm />} />
                    {/* --- Protected Routes --- */}
                    <Route path="/dashboard" element={<Dashboard />} /> 
                    <Route path="/find-doctors" element={<FindDoctors />} />
                    <Route path="/connections" element={<MyConnections />} />
                    <Route path="/reports" element={<PatientReportsPage />} />
                    
                    {/* Chat Routes */}
                    <Route path="/chat" element={<ChatPage />} />
                    <Route path="/chat/:connectionId" element={<ChatPage />} />
                    
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/settings" element={<div><h1 className="theme-title">Settings (Under Construction)</h1></div>} />
                </Routes>
            </main>
        </div>
    );
};

function App() {
  return (
    <BrowserRouter>
      {/* AuthProvider MUST wrap the content so useAuth works inside */}
      <AuthProvider>
         <AppContent /> 
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;