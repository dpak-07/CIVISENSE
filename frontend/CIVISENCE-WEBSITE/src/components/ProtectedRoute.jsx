import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedRoute({ children, allowedRoles }) {
    const { user, loading, isAuthenticated } = useAuth();

    if (loading) return <LoadingSpinner fullPage />;

    if (!isAuthenticated) return <Navigate to="/login" replace />;

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        const roleRedirects = {
            citizen: '/citizen',
            officer: '/officer',
            admin: '/admin',
            super_admin: '/admin'
        };
        return <Navigate to={roleRedirects[user.role] || '/login'} replace />;
    }

    return children;
}
