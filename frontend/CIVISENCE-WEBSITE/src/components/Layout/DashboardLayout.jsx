import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    HiOutlineHome,
    HiOutlineDocumentText,
    HiOutlineBuildingOffice,
    HiOutlineMapPin,
    HiOutlineChartBar,
    HiOutlineBell,
    HiOutlineArrowRightOnRectangle
} from 'react-icons/hi2';
import { useState, useEffect, useRef, useMemo } from 'react';
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
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const hasNotificationBaseline = useRef(false);
    const seenNotificationIds = useRef(new Set());

    const items = navItems[user?.role] || [];
    const unreadCount = notifications.filter((n) => !n.read).length;
    const roleLabel = useMemo(
        () =>
            (user?.role || 'user')
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (char) => char.toUpperCase()),
        [user?.role]
    );

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
        <div className="relative min-h-screen">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_6%,rgba(30,109,200,0.16),transparent_32%),radial-gradient(circle_at_92%_94%,rgba(20,184,166,0.14),transparent_34%)]" />
            <div className="relative z-10 flex min-h-screen flex-col">
                <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/86 shadow-[0_8px_32px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
                        <div className="flex min-w-0 items-center gap-3">
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/90 px-2.5 py-1.5 text-slate-900 transition hover:bg-white"
                                onClick={() => navigate(items[0]?.path || '/')}
                            >
                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 via-sky-600 to-cyan-600 text-sm font-extrabold text-white shadow-lg shadow-blue-700/30">
                                    CS
                                </span>
                                <span className="text-2xl font-black tracking-tight">CiviSense</span>
                            </button>
                            <span className="hidden rounded-full border border-sky-200 bg-sky-100/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-sky-800 md:inline-flex">
                                {roleLabel}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="relative">
                                <button
                                    className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-sky-200 hover:text-sky-700"
                                    onClick={() => setShowNotifications(!showNotifications)}
                                >
                                    <HiOutlineBell />
                                    {unreadCount > 0 && (
                                        <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-bold text-white">
                                            {unreadCount}
                                        </span>
                                    )}
                                </button>

                                {showNotifications && (
                                    <div className="absolute right-0 top-[calc(100%+8px)] z-[120] w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-2xl backdrop-blur-xl">
                                        <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3">
                                            <h4 className="text-sm font-bold text-slate-900">Notifications</h4>
                                            <span className="text-xs font-semibold text-sky-700">{unreadCount} unread</span>
                                        </div>
                                        <div className="max-h-80 overflow-y-auto">
                                            {notifications.length === 0 ? (
                                                <p className="px-4 py-8 text-center text-sm text-slate-500">No notifications</p>
                                            ) : (
                                                notifications.slice(0, 10).map((n) => (
                                                    <div
                                                        key={n._id}
                                                        className={`cursor-pointer border-b border-slate-100 px-4 py-3 transition ${
                                                            n.read ? 'bg-white' : 'bg-sky-50/70'
                                                        } hover:bg-slate-50`}
                                                        onClick={() => handleMarkRead(n._id)}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0 flex-1">
                                                                <strong className="block text-sm text-slate-900">{n.title}</strong>
                                                                <p className="truncate text-xs text-slate-600">{n.message}</p>
                                                            </div>
                                                            <span className="shrink-0 text-[11px] text-slate-500">
                                                                {formatTimeAgo(n.createdAt)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 sm:flex">
                                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-700 to-cyan-600 text-sm font-bold text-white">
                                    {user?.profilePhotoUrl ? (
                                        <img src={user.profilePhotoUrl} alt={user.name} />
                                    ) : (
                                        <span>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-semibold leading-tight text-slate-900">{user?.name}</span>
                                    <span className="text-xs font-medium capitalize text-slate-500">{roleLabel}</span>
                                </div>
                            </div>

                            <button
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-700"
                                onClick={handleLogout}
                            >
                                <HiOutlineArrowRightOnRectangle />
                                <span className="hidden sm:inline">Logout</span>
                            </button>
                        </div>
                    </div>

                    <div className="px-4 pb-3 md:px-6">
                        <nav className="flex max-w-full items-center gap-2 overflow-x-auto rounded-2xl border border-slate-200/90 bg-slate-100/80 p-1.5">
                            {items.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    end={Boolean(item.exact)}
                                    className={({ isActive }) =>
                                        [
                                            'inline-flex whitespace-nowrap items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition',
                                            isActive
                                                ? 'bg-gradient-to-r from-blue-700 to-cyan-600 text-white shadow-lg shadow-blue-700/25'
                                                : 'text-slate-700 hover:bg-white hover:text-slate-900'
                                        ].join(' ')
                                    }
                                >
                                    <span className="text-base">{item.icon}</span>
                                    <span>{item.label}</span>
                                </NavLink>
                            ))}
                        </nav>
                    </div>
                </header>

                <main className="mx-auto w-full max-w-[1380px] flex-1 px-4 py-6 md:px-6 md:py-8">
                    {children}
                </main>
            </div>
        </div>
    );
}

