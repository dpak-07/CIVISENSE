import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import SplashScreen from './components/SplashScreen';

// Public pages
import Home from './pages/public/Home';
import About from './pages/public/About';
import Developers from './pages/public/Developers';
import Contact from './pages/public/Contact';

// Auth pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Citizen pages
import CitizenDashboard from './pages/citizen/CitizenDashboard';
import CitizenComplaints from './pages/citizen/CitizenComplaints';
import ComplaintDetail from './pages/citizen/ComplaintDetail';

// Officer pages
import OfficerDashboard from './pages/officer/OfficerDashboard';
import OfficerComplaintManage from './pages/officer/OfficerComplaintManage';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminComplaints from './pages/admin/AdminComplaints';
import AdminOffices from './pages/admin/AdminOffices';
import AdminZones from './pages/admin/AdminZones';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import DevTools from './pages/admin/DevTools';

export default function App() {
    const [showSplash, setShowSplash] = useState(true);

    useEffect(() => {
        const timerId = window.setTimeout(() => {
            setShowSplash(false);
        }, 1850);

        return () => window.clearTimeout(timerId);
    }, []);

    return (
        <ThemeProvider>
            {showSplash ? (
                <SplashScreen />
            ) : (
                <BrowserRouter>
                    <AuthProvider>
                        <Routes>
                        {/* Public */}
                        <Route path="/" element={<Home />} />
                        <Route path="/about" element={<About />} />
                        <Route path="/developers" element={<Developers />} />
                        <Route path="/contact" element={<Contact />} />

                        {/* Auth */}
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />

                        {/* Citizen */}
                        <Route path="/citizen" element={<ProtectedRoute allowedRoles={['citizen']}><CitizenDashboard /></ProtectedRoute>} />
                        <Route path="/citizen/complaints" element={<ProtectedRoute allowedRoles={['citizen']}><CitizenComplaints /></ProtectedRoute>} />
                        <Route path="/citizen/complaint/:id" element={<ProtectedRoute allowedRoles={['citizen', 'admin', 'super_admin']}><ComplaintDetail /></ProtectedRoute>} />

                        {/* Officer */}
                        <Route path="/officer" element={<ProtectedRoute allowedRoles={['officer']}><OfficerDashboard /></ProtectedRoute>} />
                        <Route path="/officer/complaints" element={<ProtectedRoute allowedRoles={['officer']}><OfficerDashboard /></ProtectedRoute>} />
                        <Route path="/officer/complaint/:id" element={<ProtectedRoute allowedRoles={['officer', 'admin', 'super_admin']}><OfficerComplaintManage /></ProtectedRoute>} />

                        {/* Admin */}
                        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminDashboard /></ProtectedRoute>} />
                        <Route path="/admin/complaints" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminComplaints /></ProtectedRoute>} />
                        <Route path="/admin/complaint/:id" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><ComplaintDetail /></ProtectedRoute>} />
                        <Route path="/admin/offices" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminOffices /></ProtectedRoute>} />
                        <Route path="/admin/zones" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminZones /></ProtectedRoute>} />
                        <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminAnalytics /></ProtectedRoute>} />
                        <Route path="/devs" element={<ProtectedRoute><DevTools /></ProtectedRoute>} />

                        {/* Catch-all */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </AuthProvider>
                </BrowserRouter>
            )}
        </ThemeProvider>
    );
}
