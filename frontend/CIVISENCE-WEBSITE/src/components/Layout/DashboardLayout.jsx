import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import './DashboardLayout.css';
import {
    HiOutlineHome,
    HiOutlineDocumentText,
    HiOutlineBuildingOffice,
    HiOutlineMapPin,
    HiOutlineChartBar,
    HiOutlineBell,
    HiOutlineArrowRightOnRectangle,
    HiOutlineMoon,
    HiOutlineSun
} from 'react-icons/hi2';
import { useState, useEffect, useRef } from 'react';
import { getNotifications, markAsRead } from '../../api/notifications';
import { formatTimeAgo } from '../../utils/helpers';

const navItems = {
    citizen: [
        { path: '/citizen', icon: <HiOutlineHome />, label: 'Profile', exact: true },
        { path: '/citizen/complaints', icon: <HiOutlineDocumentText />, label: 'My Reports' }
    ],
    officer: [
        { path: '/officer', icon: <HiOutlineHome />, label: 'Dashboard', exact: true },
        { path: '/officer/complaints', icon: <HiOutlineDocumentText />, label: 'Complaints' }
    ],
    admin: [
        { path: '/admin', icon: <HiOutlineHome />, label: 'Dashboard', exact: true },
        { path: '/admin/complaints', icon: <HiOutlineDocumentText />, label: 'All Complaints' },
        { path: '/admin/offices', icon: <HiOutlineBuildingOffice />, label: 'Offices' },
        { path: '/admin/zones', icon: <HiOutlineMapPin />, label: 'Zones' },
        { path: '/admin/analytics', icon: <HiOutlineChartBar />, label: 'Analytics' }
    ],
    super_admin: [
        { path: '/admin', icon: <HiOutlineHome />, label: 'Dashboard', exact: true },
        { path: '/admin/complaints', icon: <HiOutlineDocumentText />, label: 'All Complaints' },
        { path: '/admin/offices', icon: <HiOutlineBuildingOffice />, label: 'Offices' },
        { path: '/admin/zones', icon: <HiOutlineMapPin />, label: 'Zones' },
        { path: '/admin/analytics', icon: <HiOutlineChartBar />, label: 'Analytics' }
    ]
};

export default function DashboardLayout({ children }) {
    const { user, logout } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const hasNotificationBaseline = useRef(false);
    const seenNotificationIds = useRef(new Set());

    const items = navItems[user?.role] || [];
    const unreadCount = notifications.filter((n) => !n.read).length;

    useEffect(() => {
        loadNotifications();
        const intervalId = window.setInterval(loadNotifications, 8000);
        return () => window.clearInterval(intervalId);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !('Notification' in window)) return;
        if (window.Notification.permission === 'default') {
            window.Notification.requestPermission().catch(() => {
                /* ignore */
            });
        }
    }, []);

    const loadNotifications = async () => {
        try {
            const { data } = await getNotifications();
            const nextNotifications = data.data || [];
            setNotifications(nextNotifications);

            const nextIds = new Set(nextNotifications.map((item) => item._id));
            if (!hasNotificationBaseline.current) {
                seenNotificationIds.current = nextIds;
                hasNotificationBaseline.current = true;
                return;
            }

            if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
                const unreadNewItems = nextNotifications.filter(
                    (item) => !item.read && !seenNotificationIds.current.has(item._id)
                );

                unreadNewItems.slice(0, 3).forEach((item) => {
                    try {
                        // Browser-level toast notification for live complaint updates.
                        new window.Notification(item.title, {
                            body: item.message,
                            tag: item._id
                        });
                    } catch {
                        /* ignore */
                    }
                });
            }

            seenNotificationIds.current = nextIds;
        } catch {
            /* ignore */
        }
    };

    const handleMarkRead = async (id) => {
        try {
            await markAsRead(id);
            setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
        } catch {
            /* ignore */
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="dashboard-layout">
            <div className="dashboard-main">
                <header className="topbar">
                    <div className="topbar__top">
                        <button
                            type="button"
                            className="topbar__brand"
                            onClick={() => navigate(items[0]?.path || '/')}
                        >
                            <span className="topbar__brand-icon">CS</span>
                            <span className="topbar__brand-text">CiviSense</span>
                        </button>

                        <div className="topbar__right">
                            <button type="button" className="topbar__theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
                                {isDark ? <HiOutlineSun /> : <HiOutlineMoon />}
                            </button>
                            <div className="topbar__notifications">
                                <button
                                    className="topbar__bell"
                                    onClick={() => setShowNotifications(!showNotifications)}
                                >
                                    <HiOutlineBell />
                                    {unreadCount > 0 && <span className="topbar__badge">{unreadCount}</span>}
                                </button>

                                {showNotifications && (
                                    <div className="notifications-dropdown">
                                        <div className="notifications-dropdown__header">
                                            <h4>Notifications</h4>
                                            <span className="notifications-dropdown__count">{unreadCount} unread</span>
                                        </div>
                                        <div className="notifications-dropdown__list">
                                            {notifications.length === 0 ? (
                                                <p className="notifications-dropdown__empty">No notifications</p>
                                            ) : (
                                                notifications.slice(0, 10).map((n) => (
                                                    <div
                                                        key={n._id}
                                                        className={`notification-item ${n.read ? '' : 'unread'}`}
                                                        onClick={() => handleMarkRead(n._id)}
                                                    >
                                                        <div className="notification-item__content">
                                                            <strong>{n.title}</strong>
                                                            <p>{n.message}</p>
                                                        </div>
                                                        <span className="notification-item__time">
                                                            {formatTimeAgo(n.createdAt)}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="topbar__user">
                                <div className="topbar__avatar">
                                    {user?.profilePhotoUrl ? (
                                        <img src={user.profilePhotoUrl} alt={user.name} />
                                    ) : (
                                        <span>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                                    )}
                                </div>
                                <div className="topbar__user-info">
                                    <span className="topbar__user-name">{user?.name}</span>
                                    <span className="topbar__user-role">{user?.role}</span>
                                </div>
                            </div>

                            <button className="topbar__logout" onClick={handleLogout}>
                                <HiOutlineArrowRightOnRectangle />
                                <span>Logout</span>
                            </button>
                        </div>
                    </div>

                    <div className="topbar__nav-wrap">
                        <nav className="topbar__nav">
                            {items.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    end={Boolean(item.exact)}
                                    className={({ isActive }) => `topbar__nav-link ${isActive ? 'active' : ''}`}
                                >
                                    <span className="topbar__nav-icon">{item.icon}</span>
                                    <span>{item.label}</span>
                                </NavLink>
                            ))}
                        </nav>
                    </div>
                </header>

                <main className="dashboard-content">{children}</main>
            </div>
        </div>
    );
}

