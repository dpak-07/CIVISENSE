import { useId } from 'react';

export default function CiviSenseLogo({ size = 80, className = '', title = 'CiviSense logo' }) {
    const uid = useId().replace(/:/g, '');
    const logoBg = `logoBg-${uid}`;
    const pinBg = `pinBg-${uid}`;
    const glow = `glow-${uid}`;
    const lineBg = `lineBg-${uid}`;

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
                    <stop offset="0%" stopColor="#0F6DFF" />
                    <stop offset="55%" stopColor="#0A6FB3" />
                    <stop offset="100%" stopColor="#0F766E" />
                </linearGradient>
                <linearGradient id={pinBg} x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#7DD3FC" />
                    <stop offset="100%" stopColor="#2DD4BF" />
                </linearGradient>
                <linearGradient id={lineBg} x1="10" y1="64" x2="72" y2="64" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
                    <stop offset="50%" stopColor="rgba(255,255,255,0.55)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0.15)" />
                </linearGradient>
                <filter id={glow} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            <rect width="80" height="80" rx="24" fill={`url(#${logoBg})`} />
            <rect x="2.5" y="2.5" width="75" height="75" rx="21.5" stroke="rgba(255,255,255,0.16)" />

            <rect x="10" y="38" width="12" height="24" rx="3.5" fill="rgba(255,255,255,0.22)" />
            <rect x="24" y="29" width="14" height="33" rx="3.5" fill="rgba(255,255,255,0.35)" />
            <rect x="40" y="21" width="16" height="41" rx="4" fill="#FFFFFF" />
            <rect x="58" y="31" width="12" height="31" rx="3.5" fill="rgba(255,255,255,0.28)" />

            <g filter={`url(#${glow})`}>
                <path
                    d="M55 19.5C55 25.59 48 33.2 48 33.2S41 25.59 41 19.5C41 15.36 44.13 12 48 12C51.87 12 55 15.36 55 19.5Z"
                    fill={`url(#${pinBg})`}
                />
                <circle cx="48" cy="19" r="3.6" fill="#FFFFFF" />
            </g>
            <circle cx="48" cy="19" r="7.6" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" strokeDasharray="3 3" />
            <path d="M48 27.5L44.5 31.5" stroke="rgba(255,255,255,0.68)" strokeWidth="2" strokeLinecap="round" />

            <rect x="8" y="64" width="64" height="2.5" rx="1.25" fill={`url(#${lineBg})`} />
        </svg>
    );
}
