import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { requestRegisterOtp } from '../../api/auth';
import { getErrorMessage, getRolePath } from '../../utils/helpers';
import CiviSenseLogo from '../../components/branding/CiviSenseLogo';
import './Auth.css';

const OTP_RESEND_SECONDS = 60;

export default function Register() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [profilePhoto, setProfilePhoto] = useState(null);
    const [profilePreview, setProfilePreview] = useState('');
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [loading, setLoading] = useState(false);
    const [otpSending, setOtpSending] = useState(false);
    const [otpCooldown, setOtpCooldown] = useState(0);
    const { register } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!profilePhoto) {
            setProfilePreview('');
            return;
        }
        const previewUrl = URL.createObjectURL(profilePhoto);
        setProfilePreview(previewUrl);
        return () => URL.revokeObjectURL(previewUrl);
    }, [profilePhoto]);

    useEffect(() => {
        if (otpCooldown <= 0) return;
        const timer = setInterval(() => {
            setOtpCooldown((value) => Math.max(0, value - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [otpCooldown]);

    const passwordStrength = useMemo(() => {
        let score = 0;
        if (password.length >= 8) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/[0-9]/.test(password)) score += 1;
        if (/[^A-Za-z0-9]/.test(password)) score += 1;
        return score;
    }, [password]);

    const handleSendOtp = async () => {
        setError('');
        setInfo('');

        if (!email.trim()) {
            setError('Please enter a valid email to receive the OTP.');
            return;
        }

        setOtpSending(true);
        try {
            await requestRegisterOtp({ email: email.trim().toLowerCase() });
            setInfo('OTP sent to your email. Please check your inbox.');
            setOtpCooldown(OTP_RESEND_SECONDS);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setOtpSending(false);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setInfo('');

        if (!name.trim() || !email.trim() || !password || !confirmPassword) {
            setError('Please fill in all required fields.');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        if (!otp.trim()) {
            setError('Please enter the OTP sent to your email.');
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('name', name.trim());
            formData.append('email', email.trim().toLowerCase());
            formData.append('password', password);
            formData.append('otp', otp.trim());
            if (profilePhoto) {
                formData.append('photo', profilePhoto);
            }
            const user = await register(formData);
            navigate(getRolePath(user.role), { replace: true });
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#f4f8ff_0%,#eaf2fb_100%)] px-3 py-4 sm:px-4">
            <div className="pointer-events-none absolute -left-20 bottom-4 h-60 w-60 rounded-full bg-cyan-300/30 blur-3xl" />
            <div className="pointer-events-none absolute -right-20 top-3 h-72 w-72 rounded-full bg-blue-300/30 blur-3xl" />

            <div className="relative z-10 w-full max-w-5xl rounded-3xl border border-slate-200/80 bg-white/75 p-4 shadow-[0_22px_70px_rgba(15,23,42,0.16)] backdrop-blur-xl sm:p-5 lg:p-6">
                <input
                    id="profilePhoto"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => setProfilePhoto(event.target.files?.[0] || null)}
                />

                <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white">
                            <CiviSenseLogo size={22} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-900">Create Account</h1>
                            <p className="text-xs text-slate-500 sm:text-sm">Citizen signup with OTP verification</p>
                        </div>
                    </div>
                    <Link to="/" className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
                        Back to home
                    </Link>
                </div>

                {error && <div className="auth-error">{error}</div>}
                {info && <div className="auth-info">{info}</div>}

                <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
                    <aside className="grid place-items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-3">
                        <label
                            className="inline-flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-sky-300 bg-sky-50 text-2xl font-bold text-sky-600"
                            htmlFor="profilePhoto"
                        >
                            {profilePreview ? <img src={profilePreview} alt="Profile preview" className="h-full w-full object-cover" /> : <span>+</span>}
                        </label>
                        <p className="text-center text-xs text-slate-500">Add profile photo (optional)</p>
                    </aside>

                    <div className="grid gap-3">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="input-group">
                                <label htmlFor="name">Full Name</label>
                                <input
                                    id="name"
                                    type="text"
                                    className="input"
                                    placeholder="Your name"
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label htmlFor="email">Email</label>
                                <input
                                    id="email"
                                    type="email"
                                    className="input"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="input-group">
                                <label htmlFor="password">Password</label>
                                <input
                                    id="password"
                                    type="password"
                                    className="input"
                                    placeholder="Minimum 8 characters"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    required
                                    minLength={8}
                                />
                                <div className="mt-1.5 flex gap-1">
                                    {[1, 2, 3, 4].map((item) => {
                                        const active = passwordStrength >= item;
                                        const tone =
                                            passwordStrength <= 1
                                                ? 'var(--danger)'
                                                : passwordStrength <= 3
                                                ? 'var(--warning)'
                                                : 'var(--success)';
                                        return (
                                            <span
                                                key={item}
                                                className="h-1 flex-1 rounded-full"
                                                style={{ backgroundColor: active ? tone : 'var(--border-light)' }}
                                            />
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="input-group">
                                <label htmlFor="confirmPassword">Confirm Password</label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    className="input"
                                    placeholder="Re-enter password"
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200/80 bg-white p-3">
                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                                <div className="input-group">
                                    <label htmlFor="otp">Email OTP</label>
                                    <input
                                        id="otp"
                                        type="text"
                                        className="input"
                                        placeholder="6-digit code"
                                        value={otp}
                                        onChange={(event) => setOtp(event.target.value)}
                                        maxLength={6}
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm whitespace-nowrap"
                                    onClick={handleSendOtp}
                                    disabled={otpSending || otpCooldown > 0}
                                >
                                    {otpSending
                                        ? 'Sending...'
                                        : otpCooldown > 0
                                        ? `Resend in ${otpCooldown}s`
                                        : 'Send OTP'}
                                </button>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                                OTP will be sent to your email address.
                            </p>
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>

                        <p className="text-sm text-slate-600">
                            Already have an account? <Link to="/login" className="font-bold text-sky-700">Sign in</Link>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}
