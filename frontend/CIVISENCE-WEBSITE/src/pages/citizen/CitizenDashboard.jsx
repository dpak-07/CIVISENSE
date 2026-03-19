import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    HiOutlineCheckCircle,
    HiOutlineClock,
    HiOutlineDocumentText,
    HiOutlineExclamationTriangle,
    HiOutlinePlusCircle,
    HiOutlineSparkles
} from 'react-icons/hi2';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import StatsCard from '../../components/StatsCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import ReportCard from '../../components/ReportCard';
import { useAuth } from '../../context/AuthContext';
import { getComplaints } from '../../api/complaints';
import { sortComplaintsByPriorityAndDate } from '../../utils/helpers';

const REFRESH_INTERVAL_MS = 20000;

export default function CitizenDashboard() {
    const { user } = useAuth();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadComplaints = useCallback(async ({ silent = false } = {}) => {
        if (!user?.id) {
            setComplaints([]);
            setLoading(false);
            return;
        }
        if (!silent) {
            setLoading(true);
        }
        try {
            const { data } = await getComplaints({ reportedBy: user.id });
            setComplaints(data.data || []);
        } catch {
            /* ignore */
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [user?.id]);

    useEffect(() => {
        void loadComplaints();

        const onWindowFocus = () => {
            void loadComplaints({ silent: true });
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void loadComplaints({ silent: true });
            }
        };
        const intervalId = window.setInterval(() => {
            void loadComplaints({ silent: true });
        }, REFRESH_INTERVAL_MS);

        window.addEventListener('focus', onWindowFocus);
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', onWindowFocus);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [loadComplaints]);

    const total = complaints.length;
    const resolved = complaints.filter((item) => item.status === 'resolved').length;
    const pending = complaints.filter((item) => ['reported', 'assigned', 'in_progress', 'unassigned'].includes(item.status)).length;
    const rejected = complaints.filter((item) => item.status === 'rejected').length;
    const highPriority = complaints.filter((item) => ['high', 'critical'].includes(item?.priority?.level)).length;
    const prioritizedRecent = sortComplaintsByPriorityAndDate(complaints).slice(0, 6);
    const completionRate = total ? Math.round((resolved / total) * 100) : 0;

    if (loading) return <DashboardLayout><LoadingSpinner fullPage /></DashboardLayout>;

    return (
        <DashboardLayout>
            <section className="mb-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] lg:p-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-4">
                            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-2xl font-bold text-slate-700">
                                {user?.profilePhotoUrl ? (
                                    <img src={user.profilePhotoUrl} alt={user?.name || 'Citizen'} className="h-full w-full object-cover" />
                                ) : (
                                    <span>{user?.name?.charAt(0)?.toUpperCase() || 'C'}</span>
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-700">Citizen portal</p>
                                <h1 className="mt-2 text-4xl font-bold text-slate-950">Welcome back, {user?.name || 'Citizen'}.</h1>
                                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                                    Track the issues you have reported, see what needs follow-up, and submit new complaints from the web portal.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Link to="/citizen/report" className="btn btn-primary">
                                <HiOutlinePlusCircle />
                                Report issue
                            </Link>
                            <Link to="/citizen/complaints" className="btn btn-secondary">
                                <HiOutlineDocumentText />
                                View all reports
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(14,116,144,0.9))] p-6 text-white shadow-[0_26px_80px_-42px_rgba(15,23,42,0.7)]">
                    <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-200">Progress snapshot</p>
                    <div className="mt-4 flex items-end justify-between">
                        <div>
                            <p className="text-5xl font-extrabold text-white">{completionRate}%</p>
                            <p className="mt-2 text-sm text-slate-200">Resolved complaint rate</p>
                        </div>
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
                            Live
                        </span>
                    </div>
                    <div className="mt-6 h-3 rounded-full bg-white/10">
                        <div className="h-3 rounded-full bg-gradient-to-r from-sky-300 to-emerald-300" style={{ width: `${completionRate}%` }} />
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-white/10 p-4">
                            <p className="text-2xl font-extrabold text-white">{pending}</p>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Open items</p>
                        </div>
                        <div className="rounded-2xl bg-white/10 p-4">
                            <p className="text-2xl font-extrabold text-white">{highPriority}</p>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">High priority</p>
                        </div>
                    </div>
                </div>
            </section>

            <div className="stats-grid">
                <StatsCard icon={<HiOutlineDocumentText />} label="Total Reports" value={total} color="primary" />
                <StatsCard icon={<HiOutlineCheckCircle />} label="Resolved" value={resolved} color="success" />
                <StatsCard icon={<HiOutlineClock />} label="Pending" value={pending} color="warning" />
                <StatsCard icon={<HiOutlineExclamationTriangle />} label="Rejected" value={rejected} color="danger" />
            </div>

            <section className="mb-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-xl text-sky-700">
                            <HiOutlineSparkles />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-950">What needs your attention</h2>
                            <p className="text-sm text-slate-500">A quick read of your current complaint activity.</p>
                        </div>
                    </div>
                    <div className="mt-6 space-y-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                            <strong className="block text-slate-950">{pending} complaint(s) are still active</strong>
                            Monitor newly assigned and in-progress cases for updates.
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                            <strong className="block text-slate-950">{highPriority} complaint(s) are marked high priority</strong>
                            These usually deserve closer follow-up if they remain unresolved.
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                            <strong className="block text-slate-950">{resolved} complaint(s) have been closed</strong>
                            Your dashboard keeps them available as part of your reporting history.
                        </div>
                    </div>
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-950">Recent reports</h2>
                            <p className="text-sm text-slate-500">Your latest complaints, sorted by urgency and recency.</p>
                        </div>
                        <Link to="/citizen/complaints" className="btn btn-ghost btn-sm">
                            View all
                        </Link>
                    </div>

                    <div className="mt-6 space-y-3">
                        {prioritizedRecent.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                                No reports yet. Start by creating your first complaint.
                            </div>
                        ) : (
                            prioritizedRecent.slice(0, 4).map((item) => (
                                <Link
                                    key={item._id}
                                    to={`/citizen/complaint/${item._id}`}
                                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-sky-200 hover:bg-sky-50/50"
                                >
                                    <div>
                                        <p className="font-semibold text-slate-950">{item.title}</p>
                                        <p className="mt-1 text-sm text-slate-500">{item.category || 'Uncategorized'}</p>
                                    </div>
                                    <span className={`priority-tag priority-tag--${item?.priority?.level || 'low'}`}>
                                        {item?.priority?.level || 'low'}
                                    </span>
                                </Link>
                            ))
                        )}
                    </div>
                </div>
            </section>

            <div className="section-title">
                <h2>Complaint cards</h2>
                <Link to="/citizen/report" className="btn btn-primary btn-sm">
                    <HiOutlinePlusCircle />
                    New report
                </Link>
            </div>

            {complaints.length === 0 ? (
                <EmptyState
                    title="No reports yet"
                    message="Your submitted reports will appear here once available."
                />
            ) : (
                <div className="reports-grid">
                    {prioritizedRecent.map((item) => (
                        <ReportCard
                            key={item._id}
                            complaint={item}
                            detailPath={`/citizen/complaint/${item._id}`}
                        />
                    ))}
                </div>
            )}
        </DashboardLayout>
    );
}
