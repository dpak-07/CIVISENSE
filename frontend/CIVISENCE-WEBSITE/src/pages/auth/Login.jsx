import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage, getRolePath } from '../../utils/helpers';
import CiviSenseLogo from '../../components/branding/CiviSenseLogo';
import './Auth.css';

const portalModes = [
    { id: 'citizen', label: 'Citizen' },
    { id: 'officer', label: 'Municipal' },
    { id: 'admin', label: 'Admin' }
];

const roleLabelMap = {
    citizen: 'Citizen',
    officer: 'Municipal',
    admin: 'Admin'
};

const toAutoGmailEmail = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return '';
    if (normalized.includes('@')) return normalized;
    const local = normalized.replace(/[^a-z0-9]+/g, '') || 'municipaloffice';
    return `${local}@gmail.com`;
};

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [portalMode, setPortalMode] = useState('citizen');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setLoading(true);
        try {
            const normalizedEmail =
                portalMode === 'citizen'
                    ? String(email || '').trim().toLowerCase()
                    : toAutoGmailEmail(email);
            const user = await login(normalizedEmail, password, portalMode);
            navigate(getRolePath(user.role), { replace: true });
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page auth-page--app">
            <div className="auth-page__glow auth-page__glow--one" />
            <div className="auth-page__glow auth-page__glow--two" />

            <div className="auth-card auth-card--app glass">
                <div className="auth-card__header auth-card__header--left">
                    <Link to="/" className="auth-back">
                        Back to home
                    </Link>
                    <div className="auth-brand-row">
                        <div className="auth-logo-pill">
                            <CiviSenseLogo size={28} />
                        </div>
                        <span className="auth-brand-name">CiviSense</span>
                    </div>
                    <h1>Welcome Back</h1>
                    <p>Sign in to continue reporting issues in your city.</p>
                </div>

                {error && <div className="auth-error">{error}</div>}

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

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type={portalMode === 'citizen' ? 'email' : 'text'}
                            className="input"
                            placeholder={portalMode === 'citizen' ? 'you@example.com' : 'office-id or office@gmail.com'}
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
                        {portalMode !== 'citizen' ? (
                            <small className="text-muted">
                                Auto-format enabled: if `@` is missing, `@gmail.com` is appended automatically.
                            </small>
                        ) : null}
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
