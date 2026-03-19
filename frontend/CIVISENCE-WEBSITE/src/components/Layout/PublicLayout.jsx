import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    HiOutlineArrowDownTray,
    HiOutlineArrowTopRightOnSquare,
    HiOutlineBars3,
    HiOutlineShieldCheck,
    HiOutlineSparkles,
    HiOutlineXMark
} from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';
import { getRolePath } from '../../utils/helpers';
import CiviSenseLogo from '../branding/CiviSenseLogo';
import ScrollProgressBar from '../ScrollProgressBar';
import { ANDROID_APK_URL, IOS_FUNNY_NOTE } from '../../constants/appLinks';

const navItems = [
    { label: 'Home', to: '/' },
    { label: 'About', to: '/about' },
    { label: 'Developers', to: '/developers' },
    { label: 'Contact', to: '/contact' }
];

const footerHighlights = [
    'Citizen reporting with photo and location capture',
    'AI-assisted routing for faster municipal action',
    'Live dashboards for officers and administrators'
];

export default function PublicLayout({ children }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const { user, isAuthenticated } = useAuth();
    const location = useLocation();

    const closeMenu = () => setMenuOpen(false);

    const isActive = (path) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    return (
        <div className="min-h-screen text-slate-900">
            <ScrollProgressBar />
            <div className="border-b border-slate-200/60 bg-slate-950 text-white">
                <div className="container flex flex-col gap-2 py-3 text-xs font-semibold uppercase tracking-[0.24em] sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex items-center gap-2 text-slate-200">
                        <HiOutlineSparkles className="text-sm text-sky-300" />
                        Civic operations platform
                    </span>
                    <a
                        href={ANDROID_APK_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sky-200 transition hover:text-white"
                    >
                        <HiOutlineArrowDownTray />
                        Download Android app
                    </a>
                </div>
            </div>

            <header className="sticky top-0 z-50 border-b border-white/60 bg-white/75 backdrop-blur-2xl">
                <div className="container flex min-h-[5.25rem] items-center justify-between gap-4 py-3">
                    <Link to="/" className="flex items-center gap-3" onClick={closeMenu}>
                        <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                            <CiviSenseLogo size={44} />
                        </div>
                        <div>
                            <p className="font-display text-xl font-bold text-slate-950">CiviSense</p>
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                                Citizen reporting and office action
                            </p>
                        </div>
                    </Link>

                    <nav className="hidden items-center gap-1 rounded-full border border-slate-200 bg-white/90 px-2 py-2 shadow-sm lg:flex">
                        {navItems.map((item) => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                    isActive(item.to)
                                        ? 'bg-slate-950 text-white shadow-sm'
                                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                                }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="hidden items-center gap-3 lg:flex">
                        {isAuthenticated ? (
                            <Link to={getRolePath(user.role)} className="btn btn-secondary btn-sm">
                                <HiOutlineArrowTopRightOnSquare />
                                Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link to="/login" className="btn btn-ghost btn-sm">
                                    Login
                                </Link>
                                <Link to="/register" className="btn btn-primary btn-sm">
                                    Create account
                                </Link>
                            </>
                        )}
                    </div>

                    <button
                        type="button"
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
                        onClick={() => setMenuOpen((prev) => !prev)}
                        aria-label="Toggle menu"
                        aria-expanded={menuOpen}
                    >
                        {menuOpen ? <HiOutlineXMark className="text-xl" /> : <HiOutlineBars3 className="text-xl" />}
                    </button>
                </div>

                {menuOpen ? (
                    <div className="border-t border-slate-200/70 bg-white/95 lg:hidden">
                        <div className="container space-y-3 py-4">
                            <nav className="grid gap-2">
                                {navItems.map((item) => (
                                    <Link
                                        key={item.to}
                                        to={item.to}
                                        className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                                            isActive(item.to)
                                                ? 'bg-slate-950 text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                        onClick={closeMenu}
                                    >
                                        {item.label}
                                    </Link>
                                ))}
                            </nav>
                            <div className="grid gap-2 border-t border-slate-100 pt-3">
                                {isAuthenticated ? (
                                    <Link
                                        to={getRolePath(user.role)}
                                        className="btn btn-secondary"
                                        onClick={closeMenu}
                                    >
                                        Open dashboard
                                    </Link>
                                ) : (
                                    <>
                                        <Link to="/login" className="btn btn-ghost" onClick={closeMenu}>
                                            Login
                                        </Link>
                                        <Link to="/register" className="btn btn-primary" onClick={closeMenu}>
                                            Citizen sign up
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}
            </header>

            <main className="relative z-10">{children}</main>

            <footer className="mt-16 border-t border-slate-200/70 bg-white/80 backdrop-blur-xl">
                <div className="container grid gap-10 py-12 lg:grid-cols-[1.3fr_0.9fr_0.9fr]">
                    <div className="space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                                <CiviSenseLogo size={40} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-slate-950">CiviSense</h3>
                                <p className="text-sm text-slate-500">Complaint reporting and coordination for city services.</p>
                            </div>
                        </div>
                        <p className="max-w-2xl text-sm leading-7 text-slate-600">
                            Built to help citizens report issues, help officers move faster, and help administrators see how city response is performing in real time.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {footerHighlights.map((item) => (
                                <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-medium text-slate-700">
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-500">Platform</p>
                        <ul className="space-y-3 text-sm text-slate-600">
                            <li className="flex items-start gap-3">
                                <HiOutlineShieldCheck className="mt-0.5 text-sky-600" />
                                Role-based citizen, officer, and admin access
                            </li>
                            <li className="flex items-start gap-3">
                                <HiOutlineShieldCheck className="mt-0.5 text-sky-600" />
                                Complaint evidence, AI scoring, and live status tracking
                            </li>
                            <li className="flex items-start gap-3">
                                <HiOutlineShieldCheck className="mt-0.5 text-sky-600" />
                                Capacity analytics for municipal office decision-making
                            </li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-500">Access</p>
                        <div className="grid gap-3">
                            {navItems.map((item) => (
                                <Link
                                    key={`footer-${item.to}`}
                                    to={item.to}
                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
                                >
                                    {item.label}
                                </Link>
                            ))}
                            <a
                                href={ANDROID_APK_URL}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                            >
                                Download Android APK
                            </a>
                        </div>
                        <p className="text-xs leading-6 text-slate-500">{IOS_FUNNY_NOTE}</p>
                    </div>
                </div>

                <div className="border-t border-slate-200/70">
                    <div className="container flex flex-col gap-2 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                        <p>Copyright {new Date().getFullYear()} CiviSense. Built for transparent civic response.</p>
                        <p>Responsive, accessible, and easy to use on mobile and desktop.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
