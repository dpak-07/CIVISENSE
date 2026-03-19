import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HiOutlineArrowLeft, HiOutlineShieldCheck, HiOutlineSparkles } from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage, getRolePath } from '../../utils/helpers';
import CiviSenseLogo from '../../components/branding/CiviSenseLogo';

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
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.14),transparent_24%),linear-gradient(180deg,#f8fbff_0%,#edf4fb_100%)] px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
                <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-sky-700">
                    <HiOutlineArrowLeft />
                    Back to home
                </Link>

                <div className="mt-6 grid overflow-hidden rounded-[2rem] border border-white/60 bg-white/85 shadow-[0_36px_100px_-42px_rgba(15,23,42,0.5)] lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="relative overflow-hidden bg-[linear-gradient(145deg,rgba(15,23,42,0.98),rgba(14,116,144,0.88))] p-8 text-white lg:p-10">
                        <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:72px_72px]" />
                        <div className="relative space-y-8">
                            <div className="flex items-center gap-3">
                                <div className="rounded-2xl border border-white/20 bg-white/10 p-1.5 backdrop-blur">
                                    <CiviSenseLogo size={44} />
                                </div>
                                <div>
                                    <p className="font-display text-2xl font-bold text-white">CiviSense</p>
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-100">
                                        AI civic operations
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <span className="section-tag border-white/20 bg-white/10 text-sky-100">
                                    <HiOutlineSparkles />
                                    Sign in
                                </span>
                                <h1 className="text-4xl font-bold text-white sm:text-5xl">Welcome back to the portal.</h1>
                                <p className="max-w-xl text-base leading-8 text-slate-200">
                                    Access the citizen, officer, or admin portal with a layout optimized for real-world reporting and operations.
                                </p>
                            </div>

                            <div className="grid gap-3">
                                {[
                                    'Production-ready responsive UI for mobile and desktop',
                                    'Complaint tracking, triage, and analytics in one platform',
                                    'Separate role experiences for citizens, municipal staff, and administrators'
                                ].map((item) => (
                                    <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/12 bg-white/10 px-4 py-3 text-sm leading-7 text-slate-100">
                                        <HiOutlineShieldCheck className="mt-1 text-sky-200" />
                                        {item}
                                    </div>
                                ))}
                            </div>

                            {portalMode !== 'citizen' ? (
                                <div className="rounded-3xl border border-amber-300/25 bg-amber-300/10 px-5 py-4 text-sm leading-7 text-amber-50">
                                    Demo access is enabled for municipal and admin roles with login ID <strong>abc</strong> and password <strong>1234</strong>.
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="p-8 lg:p-10">
                        <div className="max-w-xl space-y-6">
                            <div>
                                <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-700">Portal access</p>
                                <h2 className="mt-2 text-4xl font-bold text-slate-950">Choose your role and continue.</h2>
                                <p className="mt-3 text-sm leading-7 text-slate-600">
                                    Citizens sign in with email. Municipal and admin access also supports office IDs without manually typing <code>@gmail.com</code>.
                                </p>
                            </div>

                            {error ? <div className="auth-error">{error}</div> : null}

                            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-slate-100 p-1.5" role="tablist" aria-label="Portal mode">
                                {portalModes.map((mode) => (
                                    <button
                                        key={mode.id}
                                        type="button"
                                        className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                                            portalMode === mode.id
                                                ? 'bg-white text-slate-950 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-950'
                                        }`}
                                        onClick={() => setPortalMode(mode.id)}
                                    >
                                        {mode.label}
                                    </button>
                                ))}
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="input-group">
                                    <label htmlFor="email">Email or office ID</label>
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
                                        <p className="text-sm text-slate-500">
                                            If <code>@</code> is missing, the system automatically appends <code>@gmail.com</code>.
                                        </p>
                                    ) : null}
                                </div>

                                <div className="input-group">
                                    <label htmlFor="password">Password</label>
                                    <div className="relative">
                                        <input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            className="input pr-24"
                                            placeholder="Enter your password"
                                            value={password}
                                            onChange={(event) => setPassword(event.target.value)}
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-2 right-2 rounded-full bg-slate-100 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
                                            onClick={() => setShowPassword((prev) => !prev)}
                                        >
                                            {showPassword ? 'Hide' : 'Show'}
                                        </button>
                                    </div>
                                </div>

                                <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
                                    {loading ? 'Signing in...' : `Sign in as ${roleLabelMap[portalMode]}`}
                                </button>
                            </form>

                            <p className="text-sm text-slate-500">
                                Do not have an account?{' '}
                                <Link to="/register" className="font-semibold text-sky-700 transition hover:text-sky-800">
                                    Create one
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
