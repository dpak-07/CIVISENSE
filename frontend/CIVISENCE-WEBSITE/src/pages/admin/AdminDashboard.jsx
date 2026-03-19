import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import {
    HiOutlineBuildingOffice,
    HiOutlineCheckCircle,
    HiOutlineDocumentText,
    HiOutlineExclamationTriangle,
    HiOutlineSparkles,
    HiOutlineUserGroup
} from 'react-icons/hi2';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import StatsCard from '../../components/StatsCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getDashboardMetrics } from '../../api/admin';
import { getOffices } from '../../api/offices';
import { formatCompactNumber, getErrorMessage } from '../../utils/helpers';
import { isDemoSession } from '../../utils/authStorage';
import { DEMO_ADMIN_METRICS, DEMO_OFFICES } from '../../constants/demoData';

const CHART_COLORS = ['#0f6dff', '#14b8a6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
const REFRESH_INTERVAL_MS = 20000;

const toShortOfficeName = (name = '') => {
    if (name.length <= 18) return name;
    return `${name.slice(0, 16)}..`;
};

const prettyLabel = (value) => String(value || '').replace(/_/g, ' ');

export default function AdminDashboard() {
    const [metrics, setMetrics] = useState(null);
    const [offices, setOffices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const isMountedRef = useRef(true);

    const loadData = useCallback(async ({ silent = false } = {}) => {
        if (!silent && isMountedRef.current) {
            setLoading(true);
        }
        try {
            const [metricsRes, officesRes] = await Promise.all([getDashboardMetrics(), getOffices()]);
            if (!isMountedRef.current) return;
            setMetrics(metricsRes.data.data);
            setOffices(officesRes.data.data || []);
            setError('');
        } catch (err) {
            if (!isMountedRef.current) return;
            if (isDemoSession()) {
                setMetrics(DEMO_ADMIN_METRICS);
                setOffices(DEMO_OFFICES || []);
                setError('');
                return;
            }
            setError(getErrorMessage(err));
        } finally {
            if (!silent && isMountedRef.current) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        isMountedRef.current = true;

        void loadData();
        const onWindowFocus = () => {
            void loadData({ silent: true });
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void loadData({ silent: true });
            }
        };
        const intervalId = window.setInterval(() => {
            void loadData({ silent: true });
        }, REFRESH_INTERVAL_MS);

        window.addEventListener('focus', onWindowFocus);
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            isMountedRef.current = false;
            window.clearInterval(intervalId);
            window.removeEventListener('focus', onWindowFocus);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [loadData]);

    const statusData = metrics?.statusBreakdown
        ? Object.entries(metrics.statusBreakdown).map(([name, value]) => ({ name, value }))
        : [];

    const officeCapacityData = useMemo(() => {
        const mapped = (offices || []).map((office) => {
            const workload = Number(office.workload || 0);
            const maxCapacity = Number(office.maxCapacity || 0);
            const usagePct = maxCapacity > 0 ? Number(((workload / maxCapacity) * 100).toFixed(1)) : 0;
            return {
                id: office._id,
                name: office.name,
                shortName: toShortOfficeName(office.name),
                workload,
                maxCapacity,
                usagePct,
                active: office.isActive !== false
            };
        });

        return mapped.sort((a, b) => b.usagePct - a.usagePct);
    }, [offices]);

    if (loading) return <DashboardLayout><LoadingSpinner fullPage /></DashboardLayout>;
    if (error) return <DashboardLayout><div className="auth-error">{error}</div></DashboardLayout>;

    const totalReports = metrics?.totalReports || metrics?.totalComplaints || 0;
    const resolvedReports = metrics?.resolvedReports || metrics?.resolvedComplaints || 0;
    const highPriorityCount = (metrics?.priorityBreakdown?.critical || 0) + (metrics?.priorityBreakdown?.high || 0);
    const totalUsers = metrics?.totalUsers || 0;
    const totalOffices = metrics?.totalOffices || offices.length || 0;
    const avgResolutionHours = Number(metrics?.avgResolutionHours || 0).toFixed(1);
    const backlogCount = Math.max(totalReports - resolvedReports, 0);
    const overloadedCount = officeCapacityData.filter((office) => office.usagePct >= 90).length;
    const resolutionRate = totalReports ? Math.round((resolvedReports / totalReports) * 100) : 0;
    const lastSnapshotText = metrics?.snapshotAt ? new Date(metrics.snapshotAt).toLocaleString() : 'Live';
    const resolutionHealth = resolutionRate >= 80 ? 'Healthy' : resolutionRate >= 60 ? 'Watch' : 'At risk';
    const attentionItems = [
        {
            label: 'Open backlog',
            value: formatCompactNumber(backlogCount),
            tone: backlogCount > 50 ? 'bg-rose-100 text-rose-700' : backlogCount > 15 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
            note: 'Complaints awaiting resolution or closure.'
        },
        {
            label: 'High priority queue',
            value: formatCompactNumber(highPriorityCount),
            tone: highPriorityCount > 10 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700',
            note: 'Critical and high urgency reports.'
        },
        {
            label: 'Offices under pressure',
            value: overloadedCount,
            tone: overloadedCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
            note: 'Offices above 90% of capacity.'
        },
        {
            label: 'Resolution health',
            value: `${resolutionRate}%`,
            tone: resolutionRate >= 80 ? 'bg-emerald-100 text-emerald-700' : resolutionRate >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700',
            note: `${resolutionHealth} performance trend.`
        }
    ];
    const recommendationNotes = [
        highPriorityCount > 0
            ? `Review ${highPriorityCount} high or critical complaints for faster escalation.`
            : 'No high-priority backlog right now.',
        overloadedCount > 0
            ? `Rebalance workload across ${overloadedCount} overloaded office(s).`
            : 'Office capacity looks balanced today.',
        backlogCount > 0
            ? `Backlog sits at ${formatCompactNumber(backlogCount)}. Consider reassignment or added shifts.`
            : 'Backlog is clear. Maintain current workflow cadence.'
    ];

    return (
        <DashboardLayout>
            <section className="mb-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] lg:p-8">
                    <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-700">Admin command center</p>
                    <h1 className="mt-3 text-4xl font-bold text-slate-950 lg:text-5xl">
                        Real-time oversight for complaints, offices, and response performance.
                    </h1>
                    <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600">
                        Track backlog, office capacity, and resolution speed with a single operational view.
                    </p>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Backlog</p>
                            <p className="mt-2 text-3xl font-extrabold text-slate-950">{formatCompactNumber(backlogCount)}</p>
                            <p className="mt-1 text-sm text-slate-500">Complaints still open or unresolved</p>
                        </div>
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Resolution rate</p>
                            <p className="mt-2 text-3xl font-extrabold text-slate-950">{resolutionRate}%</p>
                            <p className="mt-1 text-sm text-slate-500">Share of complaints already resolved</p>
                        </div>
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Capacity pressure</p>
                            <p className="mt-2 text-3xl font-extrabold text-slate-950">{overloadedCount}</p>
                            <p className="mt-1 text-sm text-slate-500">Office(s) above 90% workload usage</p>
                        </div>
            </div>
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(14,116,144,0.9))] p-6 text-white shadow-[0_26px_80px_-42px_rgba(15,23,42,0.7)]">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-200">Current summary</p>
                            <h2 className="mt-3 text-3xl font-bold text-white">Complaint overview</h2>
                        </div>
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
                            Live
                        </span>
            </div>
                    <div className="mt-6 space-y-4">
                        <div className="rounded-3xl bg-white/10 p-4">
                            <p className="text-5xl font-extrabold text-white">{totalReports}</p>
                            <p className="mt-2 text-sm text-slate-200">Total complaints in the platform</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl bg-white/10 p-4">
                                <p className="text-2xl font-extrabold text-white">{highPriorityCount}</p>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">High + critical</p>
                            </div>
                            <div className="rounded-2xl bg-white/10 p-4">
                                <p className="text-2xl font-extrabold text-white">{avgResolutionHours}h</p>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Average resolution</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-200">Last snapshot: {lastSnapshotText}</p>
            </div>
                </div>
            </section>

            <div className="stats-grid">
                <StatsCard icon={<HiOutlineDocumentText />} label="Total Reports" value={totalReports} color="primary" />
                <StatsCard icon={<HiOutlineCheckCircle />} label="Resolved Reports" value={resolvedReports} color="success" />
                <StatsCard icon={<HiOutlineExclamationTriangle />} label="High + Critical" value={highPriorityCount} color="danger" />
                <StatsCard icon={<HiOutlineBuildingOffice />} label="Offices" value={totalOffices} color="info" />
                <StatsCard icon={<HiOutlineUserGroup />} label="Users" value={totalUsers} color="primary" />
                <StatsCard icon={<HiOutlineSparkles />} label="Avg Resolution" value={`${avgResolutionHours}h`} color="warning" />
            </div>

            <section className="mb-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-700">Operational priorities</p>
                            <h2 className="mt-2 text-2xl font-bold text-slate-950">Today's focus areas</h2>
                        </div>
                        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-sky-700">
                            Live
                        </span>
            </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {attentionItems.map((item) => (
                            <div key={item.label} className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${item.tone}`}>
                                        {item.value}
                                    </span>
                                </div>
                                <p className="mt-2 text-sm text-slate-600">{item.note}</p>
                            </div>
                        ))}
            </div>
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-xl text-sky-700">
                            <HiOutlineSparkles />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-950">Recommended actions</h2>
                            <p className="text-sm text-slate-500">A quick checklist based on live metrics.</p>
                        </div>
            </div>
                    <div className="mt-5 space-y-3">
                        {recommendationNotes.map((note) => (
                            <div key={note} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                {note}
                            </div>
                        ))}
            </div>
                </div>
            </section>

            <section className="mb-6 grid gap-5 xl:grid-cols-2">
                {statusData.length > 0 ? (
                    <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]">
                        <h2 className="text-2xl font-bold text-slate-950">Complaint status chart</h2>
                        <p className="mt-2 text-sm text-slate-500">Current complaint distribution by status.</p>
                        <div className="mt-6 h-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="44%"
                                        innerRadius={64}
                                        outerRadius={94}
                                        dataKey="value"
                                        label={false}
                                        labelLine={false}
                                    >
                                        {statusData.map((_, index) => (
                                            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend
                                        formatter={(value) => prettyLabel(value)}
                                        verticalAlign="bottom"
                                        iconType="circle"
                                        wrapperStyle={{ fontSize: '12px', lineHeight: 1.6 }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
            </div>
                ) : null}

                {officeCapacityData.length > 0 ? (
                    <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]">
                        <h2 className="text-2xl font-bold text-slate-950">Office workload chart</h2>
                        <p className="mt-2 text-sm text-slate-500">Offices with the highest complaint load compared to available capacity.</p>
                        <div className="mt-6 h-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={officeCapacityData.slice(0, 8)} margin={{ top: 8, right: 12, left: -12, bottom: 24 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                                    <XAxis dataKey="shortName" tick={{ fill: '#64748b', fontSize: 11 }} />
                                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <Tooltip
                                        formatter={(value, key) => [value, key === 'usagePct' ? 'Usage %' : 'Value']}
                                        contentStyle={{
                                            background: '#ffffff',
                                            border: '1px solid rgba(148,163,184,0.25)',
                                            borderRadius: '16px',
                                            color: '#0f172a'
                                        }}
                                    />
                                    <Bar dataKey="usagePct" fill="#0f6dff" radius={[8, 8, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
            </div>
                ) : null}
            </section>

            <section className="mb-4 flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-950">Office workload details</h2>
                    <p className="mt-2 text-sm text-slate-500">Current complaint load for each office.</p>
                </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {officeCapacityData.slice(0, 12).map((office) => (
                    <article
                        key={office.id}
                        className="rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-bold text-slate-950">{office.name}</h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    {office.workload} active workload / {office.maxCapacity || 0} capacity
                                </p>
                            </div>
                            <span
                                className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${
                                    office.active
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-slate-100 text-slate-500'
                                }`}
                            >
                                {office.active ? 'Active' : 'Inactive'}
                            </span>
                        </div>

                        <div className="mt-6">
                            <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-600">
                                <span>Usage</span>
                                <span>{office.usagePct}%</span>
                            </div>
                            <div className="h-3 rounded-full bg-slate-100">
                                <div
                                    className={`h-3 rounded-full ${
                                        office.usagePct >= 90
                                            ? 'bg-rose-500'
                                            : office.usagePct >= 70
                                            ? 'bg-amber-500'
                                            : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${Math.min(100, office.usagePct)}%` }}
                                />
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </DashboardLayout>
    );
}






