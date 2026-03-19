import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HiOutlineArrowLeft, HiOutlineCamera, HiOutlineShieldCheck, HiOutlineSparkles } from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';
import { requestRegisterOtp } from '../../api/auth';
import { getErrorMessage, getRolePath } from '../../utils/helpers';
import CiviSenseLogo from '../../components/branding/CiviSenseLogo';

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

    const strengthTone =
        passwordStrength <= 1 ? 'bg-rose-500' : passwordStrength <= 3 ? 'bg-amber-500' : 'bg-emerald-500';

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.14),transparent_24%),linear-gradient(180deg,#f8fbff_0%,#edf4fb_100%)] px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
                <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-sky-700">
                    <HiOutlineArrowLeft />
                    Back to home
                </Link>

                <div className="mt-6 grid overflow-hidden rounded-[2rem] border border-white/60 bg-white/85 shadow-[0_36px_100px_-42px_rgba(15,23,42,0.5)] lg:grid-cols-[0.92fr_1.08fr]">
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
                                        Citizen onboarding
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <span className="section-tag border-white/20 bg-white/10 text-sky-100">
                                    <HiOutlineSparkles />
                                    Create account
                                </span>
                                <h1 className="text-4xl font-bold text-white sm:text-5xl">Start reporting issues with a clearer citizen experience.</h1>
                                <p className="max-w-xl text-base leading-8 text-slate-200">
                                    Create your account, verify your email with OTP, and start tracking civic complaints from one place.
                                </p>
                            </div>

                            <label
                                htmlFor="profilePhoto"
                                className="flex cursor-pointer flex-col items-center gap-4 rounded-[2rem] border border-white/12 bg-white/10 p-6 text-center backdrop-blur transition hover:border-white/25"
                            >
                                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10">
                                    {profilePreview ? (
                                        <img src={profilePreview} alt="Profile preview" className="h-full w-full object-cover" />
                                    ) : (
                                        <HiOutlineCamera className="text-4xl text-sky-100" />
                                    )}
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-white">Add a profile photo</p>
                                    <p className="mt-2 text-sm text-slate-200">Optional, but helpful for a more personal citizen profile.</p>
                                </div>
                            </label>
                            <input
                                id="profilePhoto"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(event) => setProfilePhoto(event.target.files?.[0] || null)}
                            />

                            <div className="grid gap-3">
                                {[
                                    'Email OTP verification before account creation',
                                    'Complaint history and status tracking after signup',
                                    'Responsive dashboard experience across devices'
                                ].map((item) => (
                                    <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/12 bg-white/10 px-4 py-3 text-sm leading-7 text-slate-100">
                                        <HiOutlineShieldCheck className="mt-1 text-sky-200" />
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-8 lg:p-10">
                        <div className="max-w-xl space-y-6">
                            <div>
                                <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-700">Registration form</p>
                                <h2 className="mt-2 text-4xl font-bold text-slate-950">Create your citizen account.</h2>
                                <p className="mt-3 text-sm leading-7 text-slate-600">
                                    Use a valid email address for OTP verification. The account becomes active immediately after successful registration.
                                </p>
                            </div>

                            {error ? <div className="auth-error">{error}</div> : null}
                            {info ? <div className="auth-info">{info}</div> : null}

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="input-group">
                                    <label htmlFor="name">Full name</label>
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

                                <div className="grid gap-5 sm:grid-cols-2">
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
                                        <div className="grid grid-cols-4 gap-2">
                                            {[1, 2, 3, 4].map((item) => (
                                                <span
                                                    key={item}
                                                    className={`h-2 rounded-full ${passwordStrength >= item ? strengthTone : 'bg-slate-200'}`}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="input-group">
                                        <label htmlFor="confirmPassword">Confirm password</label>
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

                                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                                        <div className="input-group flex-1">
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
                                            className="btn btn-secondary sm:self-end"
                                            onClick={handleSendOtp}
                                            disabled={otpSending || otpCooldown > 0}
                                        >
                                            {otpSending ? 'Sending...' : otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Send OTP'}
                                        </button>
                                    </div>
                                    <p className="mt-3 text-sm text-slate-500">
                                        The OTP is sent to your email address to confirm account ownership before registration.
                                    </p>
                                </div>

                                <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
                                    {loading ? 'Creating account...' : 'Create account'}
                                </button>
                            </form>

                            <p className="text-sm text-slate-500">
                                Already have an account?{' '}
                                <Link to="/login" className="font-semibold text-sky-700 transition hover:text-sky-800">
                                    Sign in
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
