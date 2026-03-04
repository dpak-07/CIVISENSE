import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage, getRolePath } from '../../utils/helpers';
import CiviSenseLogo from '../../components/branding/CiviSenseLogo';
import './Auth.css';

const portalModes = [
    { id: 'citizen', label: 'Citizen Portal', hint: 'Complaint reporting and status tracking' },
    { id: 'officer', label: 'Municipal Portal', hint: 'Assigned complaint queue for offices' },
    { id: 'admin', label: 'Admin Portal', hint: 'Admin and super-admin operations' }
];

const roleLabelMap = {
    citizen: 'Citizen Portal',
    officer: 'Municipal Portal',
    admin: 'Admin Portal'
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
            const user = await login(email, password, portalMode);
            navigate(getRolePath(user.role), { replace: true });
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#f4f8ff_0%,#eaf2fb_100%)] px-3 py-4 sm:px-4">
            <div className="pointer-events-none absolute -left-20 bottom-4 h-60 w-60 rounded-full bg-cyan-300/20 blur-3xl" />
            <div className="pointer-events-none absolute -right-20 top-3 h-72 w-72 rounded-full bg-blue-300/20 blur-3xl" />

            <div className="relative z-10 w-full max-w-4xl rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-[0_22px_70px_rgba(15,23,42,0.16)] backdrop-blur-xl sm:p-5 lg:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white">
                            <CiviSenseLogo size={22} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-900">Sign In</h1>
                            <p className="text-xs text-slate-500 sm:text-sm">Government Civic Operations Portal</p>
                        </div>
                    </div>
                    <Link to="/" className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
                        Back to home
                    </Link>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <div className="mb-4 grid gap-2 rounded-2xl border border-slate-200/90 bg-slate-100/80 p-2 sm:grid-cols-3" role="tablist" aria-label="Portal mode">
                    {portalModes.map((mode) => (
                        <button
                            key={mode.id}
                            type="button"
                            className={[
                                'rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wide transition sm:text-[11px]',
                                portalMode === mode.id
                                    ? 'bg-gradient-to-r from-blue-700 to-cyan-600 text-white shadow-md'
                                    : 'bg-white/70 text-slate-600 hover:text-slate-900'
                            ].join(' ')}
                            onClick={() => setPortalMode(mode.id)}
                            title={mode.hint}
                        >
                            {mode.label}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="grid gap-3">
                    <div className="input-group">
                        <label htmlFor="email">Email / Login ID</label>
                        <input
                            id="email"
                            type="text"
                            className="input"
                            placeholder="you@example.com or office ID"
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

                    <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
                        {loading ? 'Signing in...' : `Sign in to ${roleLabelMap[portalMode]}`}
                    </button>
                </form>

                <p className="mt-3 text-sm text-slate-600">
                    Do not have an account? <Link to="/register" className="font-bold text-sky-700">Create one</Link>
                </p>
            </div>
        </div>
    );
}
