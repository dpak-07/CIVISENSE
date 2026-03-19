import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRolePath } from '../../utils/helpers';
import './LogsLayout.css';

export default function LogsLayout({ children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const handleDashboard = () => {
        if (!user?.role) return;
        navigate(getRolePath(user.role));
    };

    return (
        <div className="logs-layout">
            <header className="logs-layout__header">
                <button className="logs-layout__brand" onClick={() => navigate('/logs')} type="button">
                    <span className="logs-layout__brand-icon">CS</span>
                    <div>
                        <strong>CiviSense Logs</strong>
                        <span>Independent monitoring console</span>
                    </div>
                </button>

                <div className="logs-layout__actions">
                    {user?.role && (
                        <button className="btn btn-secondary btn-sm" onClick={handleDashboard} type="button">
                            Back to Dashboard
                        </button>
                    )}
                    <div className="logs-layout__user">
                        <div className="logs-layout__avatar">
                            {user?.profilePhotoUrl ? (
                                <img src={user.profilePhotoUrl} alt={user.name} />
                            ) : (
                                <span>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                            )}
                        </div>
                        <div className="logs-layout__user-info">
                            <span>{user?.name || 'User'}</span>
                            <small>{user?.role || 'role'}</small>
                        </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={handleLogout} type="button">
                        Logout
                    </button>
                </div>
            </header>

            <main className="logs-layout__content">{children}</main>
        </div>
    );
}
