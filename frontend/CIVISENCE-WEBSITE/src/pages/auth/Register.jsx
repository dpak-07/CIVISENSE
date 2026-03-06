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
        <div className="auth-page auth-page--app">
            <div className="auth-card auth-card--app glass auth-card--split">
                <div className="auth-left">
                    <div className="auth-brand-row">
                        <div className="auth-logo-pill">
                            <CiviSenseLogo size={28} />
                        </div>
                        <span className="auth-brand-name">CiviSense</span>
                    </div>
                    <h1>Create Account</h1>
                    <p>Join citizens helping make the city better.</p>

                    <div className="auth-photo-box">
                        <label className="auth-avatar__button" htmlFor="profilePhoto">
                            {profilePreview ? (
                                <img src={profilePreview} alt="Profile preview" />
                            ) : (
                                <span>+</span>
                            )}
                        </label>
                        <input
                            id="profilePhoto"
                            type="file"
                            accept="image/*"
                            onChange={(event) => setProfilePhoto(event.target.files?.[0] || null)}
                        />
                        <span className="auth-avatar__hint">Add profile photo (optional)</span>
                    </div>
                </div>

                <div className="auth-right">
                    <div className="auth-right__top">
                        <Link to="/" className="auth-back">
                            Back to home
                        </Link>
                    </div>

                    {error && <div className="auth-error">{error}</div>}
                    {info && <div className="auth-info">{info}</div>}

                    <form onSubmit={handleSubmit} className="auth-form">
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
                            <div className="auth-strength">
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
                                            className="auth-strength__bar"
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

                        <div className="auth-otp">
                            <div className="auth-otp__row">
                                <div className="input-group auth-otp__input">
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
                                    className="btn btn-ghost btn-sm auth-otp__btn"
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
                            <p className="auth-otp__hint">
                                We will send the OTP to your Gmail address to verify your account.
                            </p>
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>
                    </form>

                    <p className="auth-footer">
                        Already have an account? <Link to="/login">Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
