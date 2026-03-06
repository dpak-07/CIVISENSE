import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { HiOutlineBars3, HiOutlineXMark, HiOutlineArrowDownTray } from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';
import { getRolePath } from '../../utils/helpers';
import CiviSenseLogo from '../branding/CiviSenseLogo';
import { ANDROID_APK_URL, IOS_FUNNY_NOTE } from '../../constants/appLinks';
import './PublicLayout.css';

const navItems = [
    { label: 'Home', to: '/' },
    { label: 'About', to: '/about' },
    { label: 'Developers', to: '/developers' },
    { label: 'Contact', to: '/contact' }
];
const containerClass = 'container';

export default function PublicLayout({ children }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const { user, isAuthenticated } = useAuth();
    const location = useLocation();

    const closeMenu = () => setMenuOpen(false);

    return (
        <div className="public-layout">
            <header className="public-header glass">
                <div className={`${containerClass} public-header__inner`}>
                    <Link to="/" className="public-logo" onClick={closeMenu}>
                        <CiviSenseLogo size={44} className="public-logo__icon" />
                        <span className="public-logo__text-wrap">
                            <span className="public-logo__title">CiviSense</span>
                            <span className="public-logo__tag">App-aligned GovTech Theme</span>
                        </span>
                    </Link>

                    <nav className="public-nav" aria-label="Main">
                        {navItems.map((item) => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className={`public-nav__link ${location.pathname === item.to ? 'active' : ''}`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="public-actions">
                        {isAuthenticated ? (
                            <Link to={getRolePath(user.role)} className="btn btn-primary btn-sm">Dashboard</Link>
                        ) : (
                            <>
                                <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
                                <Link to="/register" className="btn btn-secondary btn-sm">Citizen Sign Up</Link>
                            </>
                        )}
                        <button
                            type="button"
                            className="public-menu-btn"
                            onClick={() => setMenuOpen((prev) => !prev)}
                            aria-label="Toggle menu"
                            aria-expanded={menuOpen}
                        >
                            {menuOpen ? <HiOutlineXMark /> : <HiOutlineBars3 />}
                        </button>
                    </div>
                </div>

                <div className={`public-mobile-menu ${menuOpen ? 'open' : ''}`}>
                    <div className={`${containerClass} public-mobile-menu__inner glass`}>
                        {navItems.map((item) => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className={`public-mobile-menu__link ${location.pathname === item.to ? 'active' : ''}`}
                                onClick={closeMenu}
                            >
                                {item.label}
                            </Link>
                        ))}
                        {!isAuthenticated && (
                            <Link to="/login" className="public-mobile-menu__link" onClick={closeMenu}>
                                Login Portal
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            <main className="public-main">{children}</main>

            <footer className="public-footer">
                <div className={`${containerClass} public-footer__grid`}>
                    <div>
                        <div className="public-footer__brand">
                            <CiviSenseLogo size={36} className="public-logo__icon" />
                            <div>
                                <h3>CiviSense</h3>
                                <p>AI civic intelligence for transparent city operations.</p>
                            </div>
                        </div>
                        <a className="public-footer__download" href={ANDROID_APK_URL} target="_blank" rel="noreferrer">
                            <HiOutlineArrowDownTray /> Download Android APK
                        </a>
                        <p className="public-footer__ios-note">{IOS_FUNNY_NOTE}</p>
                    </div>

                    <div>
                        <h4>Portals</h4>
                        <ul>
                            <li>Citizen tracking and profile status</li>
                            <li>Sub-office workload and resolution board</li>
                            <li>Admin control with analytics and offices</li>
                        </ul>
                    </div>

                    <div>
                        <h4>Navigation</h4>
                        <ul>
                            {navItems.map((item) => (
                                <li key={`f-${item.to}`}>
                                    <Link to={item.to}>{item.label}</Link>
                                </li>
                            ))}
                            <li><Link to="/login">Login</Link></li>
                        </ul>
                    </div>
                </div>
                <div className={`${containerClass} public-footer__bottom`}>
                    <p>Copyright {new Date().getFullYear()} CiviSense. Government-ready civic operations interface.</p>
                </div>
            </footer>
        </div>
    );
}
