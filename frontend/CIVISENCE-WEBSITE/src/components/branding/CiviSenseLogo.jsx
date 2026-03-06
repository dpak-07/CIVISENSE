import { useId } from 'react';

export default function CiviSenseLogo({ size = 80, className = '', title = 'CiviSense logo' }) {
    const uid = useId().replace(/:/g, '');
    const logoBg = `logoBg-${uid}`;
    const pinBg = `pinBg-${uid}`;

    return (
        <svg
            viewBox="0 0 80 80"
            width={size}
            height={size}
            className={className}
            role="img"
            aria-label={title}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id={logoBg} x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#4F46E5" />
                    <stop offset="100%" stopColor="#7C3AED" />
                </linearGradient>
                <linearGradient id={pinBg} x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#818CF8" />
                    <stop offset="100%" stopColor="#A78BFA" />
                </linearGradient>
            </defs>

            <rect width="80" height="80" rx="22" fill={`url(#${logoBg})`} />

            <rect x="10" y="38" width="12" height="26" rx="3" fill="rgba(255,255,255,0.25)" />
            <rect x="24" y="28" width="14" height="36" rx="3" fill="rgba(255,255,255,0.35)" />
            <rect x="40" y="22" width="16" height="42" rx="3" fill="#FFFFFF" />
            <rect x="58" y="32" width="12" height="32" rx="3" fill="rgba(255,255,255,0.3)" />

            <circle cx="48" cy="19" r="9" fill={`url(#${pinBg})`} opacity="0.95" />
            <circle cx="48" cy="17" r="3.5" fill="#FFFFFF" />
            <path d="M48 24L44 30" stroke={`url(#${pinBg})`} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
            <circle cx="48" cy="17" r="6" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.5" />

            <rect x="8" y="62" width="64" height="2.5" rx="1.25" fill="rgba(255,255,255,0.2)" />
        </svg>
    );
}
