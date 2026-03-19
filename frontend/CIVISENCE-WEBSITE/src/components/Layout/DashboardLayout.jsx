import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    HiOutlineArrowRightOnRectangle,
    HiOutlineBars3,
    HiOutlineBell,
    HiOutlineBuildingOffice,
    HiOutlineChartBar,
    HiOutlineDocumentText,
    HiOutlineHome,
    HiOutlineMapPin,
    HiOutlinePlusCircle,
    HiOutlineSparkles,
    HiOutlineXMark
} from 'react-icons/hi2';
import { getNotifications, markAsRead } from '../../api/notifications';
import CiviSenseLogo from '../branding/CiviSenseLogo';
import { useAuth } from '../../context/AuthContext';
import { formatRoleLabel, formatTimeAgo } from '../../utils/helpers';

const navItems = {
    citizen: [
        { path: '/citizen', icon: <HiOutlineHome />, label: 'Home', exact: true },
        { path: '/citizen/report', icon: <HiOutlinePlusCircle />, label: 'New Complaint' },
        { path: '/citizen/complaints', icon: <HiOutlineDocumentText />, label: 'My Complaints' }
    ],
    officer: [
        { path: '/officer', icon: <HiOutlineHome />, label: 'Dashboard', exact: true },
        { path: '/officer/complaints', icon: <HiOutlineDocumentText />, label: 'Complaints' }
    ],
    admin: [
        { path: '/admin', icon: <HiOutlineHome />, label: 'Dashboard', exact: true },
        { path: '/admin/complaints', icon: <HiOutlineDocumentText />, label: 'Complaints' },
        { path: '/admin/offices', icon: <HiOutlineBuildingOffice />, label: 'Offices' },
        { path: '/admin/zones', icon: <HiOutlineMapPin />, label: 'Zones' },
        { path: '/admin/analytics', icon: <HiOutlineChartBar />, label: 'Analytics' }
    ],
    super_admin: [
        { path: '/admin', icon: <HiOutlineHome />, label: 'Dashboard', exact: true },
        { path: '/admin/complaints', icon: <HiOutlineDocumentText />, label: 'Complaints' },
        { path: '/admin/offices', icon: <HiOutlineBuildingOffice />, label: 'Offices' },
        { path: '/admin/zones', icon: <HiOutlineMapPin />, label: 'Zones' },
        { path: '/admin/analytics', icon: <HiOutlineChartBar />, label: 'Analytics' }
    ]
};

const roleCopy = {
    citizen: {
        title: 'Citizen Portal',
        description: 'View your complaints, report new issues, and follow progress updates.'
    },
    officer: {
        title: 'Officer Portal',
        description: 'View assigned complaints, check evidence, and update action status.'
    },
    admin: {
        title: 'Admin Portal',
        description: 'View complaint status, office workload, and city-level reports.'
    },
    super_admin: {
        title: 'Admin Portal',
        description: 'View complaint status, office workload, and city-level reports.'
    }
};

export default function DashboardLayout({ children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const hasNotificationBaseline = useRef(false);
    const seenNotificationIds = useRef(new Set());
    const notificationPanelRef = useRef(null);

    const items = navItems[user?.role] || [];
    const currentRole = roleCopy[user?.role] || {
        title: 'Portal',
        description: 'View and manage your account information.'
    };
    const unreadCount = notifications.filter((item) => !item.read).length;

    useEffect(() => {
        void loadNotifications();
        const intervalId = window.setInterval(() => {
            void loadNotifications();
        }, 8000);

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

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationPanelRef.current && !notificationPanelRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
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
            setNotifications((prev) => prev.map((item) => (item._id === id ? { ...item, read: true } : item)));
        } catch {
            /* ignore */
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const renderNav = (onNavigate) => (
        <nav className="grid gap-2">
            {items.map((item) => (
                <NavLink
                    key={item.path}
                    to={item.path}
                    end={Boolean(item.exact)}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                        `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                            isActive
                                ? 'bg-slate-950 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                        }`
                    }
                >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                </NavLink>
            ))}
        </nav>
    );

    return (
        <div className="min-h-screen">
            <div className="mx-auto flex min-h-screen w-full max-w-[1700px]">
                <aside className="hidden w-[290px] shrink-0 border-r border-white/60 bg-white/72 p-6 backdrop-blur-2xl xl:flex xl:flex-col">
                    <button
                        type="button"
                        className="flex items-center gap-3 text-left"
                        onClick={() => navigate(items[0]?.path || '/')}
                    >
                        <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                            <CiviSenseLogo size={46} />
                        </div>
                        <div>
                            <p className="font-display text-2xl font-bold text-slate-950">CiviSense</p>
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                                {formatRoleLabel(user?.role)}
                            </p>
                        </div>
                    </button>

                    <div className="mt-8 rounded-3xl border border-sky-100 bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(15,118,110,0.12))] p-5">
                        <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-700">Portal Overview</p>
                        <h2 className="mt-2 text-2xl font-bold text-slate-950">{currentRole.title}</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{currentRole.description}</p>
                    </div>

                    <div className="mt-8 flex-1">
                        <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Navigation</p>
                        {renderNav()}
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50/90 p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Updates</p>
                        <div className="mt-4 space-y-3">
                            <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                                <span className="text-sm font-semibold text-slate-600">Live sync</span>
                                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                                    Active
                                </span>
                            </div>
                            <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                                <span className="text-sm font-semibold text-slate-600">Unread alerts</span>
                                <span className="text-lg font-bold text-slate-950">{unreadCount}</span>
                            </div>
                        </div>
                    </div>
                </aside>

                {mobileNavOpen ? (
                    <div
                        className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm xl:hidden"
                        onClick={() => setMobileNavOpen(false)}
                    >
                        <div
                            className="h-full w-[86vw] max-w-[320px] border-r border-white/60 bg-white/90 p-5 shadow-2xl"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                                        <CiviSenseLogo size={42} />
                                    </div>
                                    <div>
                                        <p className="font-display text-xl font-bold text-slate-950">CiviSense</p>
                                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                                            {formatRoleLabel(user?.role)}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600"
                                    onClick={() => setMobileNavOpen(false)}
                                >
                                    <HiOutlineXMark className="text-xl" />
                                </button>
                            </div>

                            <div className="mt-6 rounded-3xl border border-sky-100 bg-sky-50/80 p-4">
                                <p className="text-sm font-bold text-sky-700">{currentRole.title}</p>
                                <p className="mt-1 text-sm text-slate-600">{currentRole.description}</p>
                            </div>

                            <div className="mt-6">{renderNav(() => setMobileNavOpen(false))}</div>
                        </div>
                    </div>
                ) : null}

                <div className="flex min-w-0 flex-1 flex-col">
                    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/72 backdrop-blur-2xl">
                        <div className="container flex flex-col gap-4 py-4">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm xl:hidden"
                                        onClick={() => setMobileNavOpen(true)}
                                    >
                                        <HiOutlineBars3 className="text-xl" />
                                    </button>
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                                            {formatRoleLabel(user?.role)}
                                        </p>
                                        <h1 className="text-2xl font-bold text-slate-950">{currentRole.title}</h1>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 md:flex md:items-center md:gap-2">
                                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                        Updates active
                                    </div>

                                    <div className="relative" ref={notificationPanelRef}>
                                        <button
                                            type="button"
                                            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-sky-200 hover:text-sky-700"
                                            onClick={() => setShowNotifications((prev) => !prev)}
                                        >
                                            <HiOutlineBell className="text-xl" />
                                            {unreadCount > 0 ? (
                                                <span className="absolute -right-1 -top-1 min-w-[1.35rem] rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                                    {unreadCount}
                                                </span>
                                            ) : null}
                                        </button>

                                        {showNotifications ? (
                                            <div className="absolute right-0 mt-3 w-[22rem] max-w-[calc(100vw-2rem)] rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-[0_26px_70px_-36px_rgba(15,23,42,0.55)]">
                                                <div className="mb-3 flex items-center justify-between">
                                                    <div>
                                                        <p className="text-lg font-bold text-slate-950">Notifications</p>
                                                        <p className="text-sm text-slate-500">{unreadCount} unread</p>
                                                    </div>
                                                        <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                                                            New
                                                    </div>
                                                </div>

                                                <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
                                                    {notifications.length === 0 ? (
                                                        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                                                            No notifications right now.
                                                        </div>
                                                    ) : (
                                                        notifications.slice(0, 10).map((item) => (
                                                            <button
                                                                key={item._id}
                                                                type="button"
                                                                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                                                                    item.read
                                                                        ? 'border-slate-100 bg-slate-50 text-slate-600'
                                                                        : 'border-sky-100 bg-sky-50/80 text-slate-700'
                                                                }`}
                                                                onClick={() => void handleMarkRead(item._id)}
                                                            >
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div>
                                                                        <p className="font-semibold text-slate-950">{item.title}</p>
                                                                        <p className="mt-1 text-sm leading-6 text-slate-600">{item.message}</p>
                                                                    </div>
                                                                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                                                        {formatTimeAgo(item.createdAt)}
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="hidden items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm sm:flex">
                                        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                                            {user?.profilePhotoUrl ? (
                                                <img src={user.profilePhotoUrl} alt={user?.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <span>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-950">{user?.name || 'User'}</p>
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                                {formatRoleLabel(user?.role)}
                                            </p>
                                        </div>
                                    </div>

                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void handleLogout()}>
                                        <HiOutlineArrowRightOnRectangle />
                                        <span className="hidden sm:inline">Logout</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 xl:hidden">
                                {items.map((item) => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        end={Boolean(item.exact)}
                                        className={({ isActive }) =>
                                            `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                                                isActive
                                                    ? 'bg-slate-950 text-white'
                                                    : 'border border-slate-200 bg-white text-slate-600'
                                            }`
                                        }
                                    >
                                        {item.icon}
                                        {item.label}
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    </header>

                    <main className="container flex-1 py-6 sm:py-8">
                        <div className="mb-6 rounded-3xl border border-sky-100 bg-[linear-gradient(135deg,rgba(14,165,233,0.08),rgba(15,118,110,0.1))] px-5 py-4 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.4)]">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-700">Current view</p>
                                    <p className="mt-1 text-sm text-slate-600">{currentRole.description}</p>
                                </div>
                                <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700">
                                    <HiOutlineSparkles className="text-sky-600" />
                                    Live updates available
                                </div>
                            </div>
                        </div>

                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}
