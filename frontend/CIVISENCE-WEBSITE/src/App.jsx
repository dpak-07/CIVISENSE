import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
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
import NewComplaint from './pages/citizen/NewComplaint';

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
import Logs from './pages/logs/Logs';

const pageVariants = {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
    exit: { opacity: 0, y: -12, transition: { duration: 0.25, ease: 'easeInOut' } }
};

const PageTransition = ({ children }) => (
    <motion.div className="page-transition" variants={pageVariants} initial="initial" animate="animate" exit="exit">
        {children}
    </motion.div>
);

const withTransition = (node) => <PageTransition>{node}</PageTransition>;

function AnimatedRoutes() {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                {/* Public */}
                <Route path="/" element={withTransition(<Home />)} />
                <Route path="/about" element={withTransition(<About />)} />
                <Route path="/developers" element={withTransition(<Developers />)} />
                <Route path="/contact" element={withTransition(<Contact />)} />

                {/* Auth */}
                <Route path="/login" element={withTransition(<Login />)} />
                <Route path="/register" element={withTransition(<Register />)} />

                {/* Citizen */}
                <Route path="/citizen" element={withTransition(<ProtectedRoute allowedRoles={['citizen']}><CitizenDashboard /></ProtectedRoute>)} />
                <Route path="/citizen/report" element={withTransition(<ProtectedRoute allowedRoles={['citizen']}><NewComplaint /></ProtectedRoute>)} />
                <Route path="/citizen/complaints" element={withTransition(<ProtectedRoute allowedRoles={['citizen']}><CitizenComplaints /></ProtectedRoute>)} />
                <Route path="/citizen/complaint/:id" element={withTransition(<ProtectedRoute allowedRoles={['citizen', 'admin', 'super_admin']}><ComplaintDetail /></ProtectedRoute>)} />

                {/* Officer */}
                <Route path="/officer" element={withTransition(<ProtectedRoute allowedRoles={['officer']}><OfficerDashboard /></ProtectedRoute>)} />
                <Route path="/officer/complaints" element={withTransition(<ProtectedRoute allowedRoles={['officer']}><OfficerDashboard /></ProtectedRoute>)} />
                <Route path="/officer/complaint/:id" element={withTransition(<ProtectedRoute allowedRoles={['officer', 'admin', 'super_admin']}><OfficerComplaintManage /></ProtectedRoute>)} />

                {/* Admin */}
                <Route path="/admin" element={withTransition(<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminDashboard /></ProtectedRoute>)} />
                <Route path="/admin/complaints" element={withTransition(<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminComplaints /></ProtectedRoute>)} />
                <Route path="/admin/complaint/:id" element={withTransition(<ProtectedRoute allowedRoles={['admin', 'super_admin']}><ComplaintDetail /></ProtectedRoute>)} />
                <Route path="/admin/offices" element={withTransition(<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminOffices /></ProtectedRoute>)} />
                <Route path="/admin/zones" element={withTransition(<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminZones /></ProtectedRoute>)} />
                <Route path="/admin/analytics" element={withTransition(<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminAnalytics /></ProtectedRoute>)} />
                <Route path="/devs" element={withTransition(<ProtectedRoute allowedRoles={['super_admin']}><DevTools /></ProtectedRoute>)} />
                <Route path="/logs" element={withTransition(<ProtectedRoute allowedRoles={['admin', 'super_admin']}><Logs /></ProtectedRoute>)} />

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </AnimatePresence>
    );
}

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
                        <AnimatedRoutes />
                    </AuthProvider>
                </BrowserRouter>
            )}
        </ThemeProvider>
    );
}
