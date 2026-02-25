import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage, getRolePath } from '../../utils/helpers';
import CiviSenseLogo from '../../components/branding/CiviSenseLogo';
import './Auth.css';

const portalModes = [
    { id: 'citizen', label: 'Citizen' },
    { id: 'officer', label: 'Sub Office' },
    { id: 'admin', label: 'Admin' }
];

const roleLabelMap = {
    citizen: 'Citizen',
    officer: 'Sub Office',
    admin: 'Admin'
};

const demoCredentials = {
    officer: { email: 'abc', password: '1234' },
    admin: { email: 'abc', password: '1234' }
};

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [portalMode, setPortalMode] = useState('citizen');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const fillDemo = (role) => {
        const creds = demoCredentials[role];
        if (!creds) return;
        setPortalMode(role);
        setEmail(creds.email);
        setPassword(creds.password);
        setError('');
        setInfo(`${roleLabelMap[role]} demo credentials loaded.`);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setInfo('');
        setLoading(true);
        try {
            const user = await login(email, password, portalMode);
            if (user.role !== portalMode) {
                setInfo(`Signed in as ${roleLabelMap[user.role] || user.role}. Redirecting to your portal.`);
            }
            navigate(getRolePath(user.role), { replace: true });
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card glass">
                <div className="auth-card__header">
                    <Link to="/" className="auth-card__logo">
                        <CiviSenseLogo size={42} />
                        <span>CiviSense</span>
                    </Link>
                    <h1>Login Portal</h1>
                    <p>Choose your portal mode, then sign in.</p>
                </div>

                <div className="auth-portal-toggle" role="tablist" aria-label="Portal mode">
                    {portalModes.map((mode) => (
                        <button
                            key={mode.id}
                            type="button"
                            className={`auth-portal-toggle__item ${portalMode === mode.id ? 'active' : ''}`}
                            onClick={() => setPortalMode(mode.id)}
                        >
                            {mode.label}
                        </button>
                    ))}
                </div>

                {error && <div className="auth-error">{error}</div>}
                {info && <div className="auth-info">{info}</div>}

                <div className="auth-demo-card">
                    <h4>Demo Credentials</h4>
                    <p>Admin / Sub Office demo: <code>abc</code> / <code>1234</code></p>
                    <div className="auth-demo-card__actions">
                        <button type="button" onClick={() => fillDemo('officer')} className="btn btn-ghost btn-sm">
                            Use Sub Office Demo
                        </button>
                        <button type="button" onClick={() => fillDemo('admin')} className="btn btn-ghost btn-sm">
                            Use Admin Demo
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="input-group">
                        <label htmlFor="email">Email / Demo ID</label>
                        <input
                            id="email"
                            type="text"
                            className="input"
                            placeholder="you@example.com or demo id"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <div className="auth-password-wrap">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                className="input"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="auth-password-toggle"
                                onClick={() => setShowPassword((prev) => !prev)}
                            >
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
                        {loading ? 'Signing in...' : `Sign in as ${roleLabelMap[portalMode]}`}
                    </button>
                </form>

                <p className="auth-footer">
                    Do not have an account? <Link to="/register">Create one</Link>
                </p>
            </div>
        </div>
    );
}
