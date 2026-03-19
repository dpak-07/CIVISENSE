import { useEffect, useMemo, useState } from 'react';
import {
    Area,
    AreaChart,
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
import DashboardLayout from '../../components/Layout/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getDashboardMetrics } from '../../api/admin';
import { getErrorMessage } from '../../utils/helpers';
import { isDemoSession } from '../../utils/authStorage';
import { DEMO_ADMIN_METRICS } from '../../constants/demoData';

const COLORS = ['#2563eb', '#06b6d4', '#16a34a', '#f59e0b', '#ef4444', '#0f766e', '#ec4899'];
const REFRESH_INTERVAL_MS = 30000;

const toChartEntries = (value = {}) =>
    Object.entries(value).map(([name, count]) => ({ name, value: Number(count || 0) }));

const formatNumber = (value) => Number(value || 0).toLocaleString();
const prettyLabel = (value) => String(value || '').replace(/_/g, ' ');
const shortLabel = (value, max = 12) => {
    const text = String(value || '');
    if (text.length <= max) return text;
    return `${text.slice(0, max - 3)}...`;
};

export default function AdminAnalytics() {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        let intervalId = null;

        const pull = async ({ silent = false } = {}) => {
            if (!silent && active) {
                setLoading(true);
            }
            try {
                const metricsRes = await getDashboardMetrics();
                if (!active) return;
                setMetrics(metricsRes?.data?.data || null);
                setError('');
            } catch (err) {
                if (!active) return;
                if (isDemoSession()) {
                    setMetrics(DEMO_ADMIN_METRICS);
                    setError('');
                } else {
                    setError(getErrorMessage(err));
                }
            } finally {
                if (active && !silent) {
                    setLoading(false);
                }
            }
        };

        void pull();
        intervalId = window.setInterval(() => {
            void pull({ silent: true });
        }, REFRESH_INTERVAL_MS);

        return () => {
            active = false;
            if (intervalId) window.clearInterval(intervalId);
        };
    }, []);

    const safeMetrics = metrics || {};

    const statusData = useMemo(
        () => toChartEntries(safeMetrics.statusBreakdown || {}),
        [safeMetrics.statusBreakdown]
    );

    const categoryData = useMemo(
        () => (safeMetrics.categoryBreakdown || safeMetrics.topCategories || []).map((entry) => ({
            name: entry._id || entry.category || 'other',
            count: Number(entry.count || 0)
        })),
        [safeMetrics.categoryBreakdown, safeMetrics.topCategories]
    );

    const trendData = useMemo(
        () => (Array.isArray(safeMetrics.dailyTrend) ? safeMetrics.dailyTrend : []),
        [safeMetrics.dailyTrend]
    );

    const priorityData = useMemo(() => {
        const breakdown = safeMetrics.priorityBreakdown || {};
        return [
            { name: 'critical', value: Number(breakdown.critical || 0) },
            { name: 'high', value: Number(breakdown.high || 0) },
            { name: 'medium', value: Number(breakdown.medium || 0) },
            { name: 'low', value: Number(breakdown.low || 0) }
        ];
    }, [safeMetrics.priorityBreakdown]);

    const totalReportsCount = Number(safeMetrics.totalReports || safeMetrics.totalComplaints || 0);
    const resolvedReportsCount = Number(safeMetrics.resolvedReports || safeMetrics.resolvedComplaints || 0);
    const pendingReportsCount = Number(safeMetrics.pendingReports || safeMetrics.pendingComplaints || 0);
    const rejectedReportsCount = Number(safeMetrics.rejectedReports || 0);
    const highCount =
        Number(safeMetrics?.priorityBreakdown?.critical || 0) +
        Number(safeMetrics?.priorityBreakdown?.high || 0);
    const mediumCount = Number(safeMetrics?.priorityBreakdown?.medium || 0);
    const resolutionRate = totalReportsCount
        ? ((resolvedReportsCount / totalReportsCount) * 100).toFixed(1)
        : '0.0';
    const lastSnapshot = safeMetrics?.snapshotAt ? new Date(safeMetrics.snapshotAt).toLocaleString() : 'Live';

    const globalSnapshotData = [
        { name: 'Total', count: totalReportsCount },
        { name: 'High+Critical', count: highCount },
        { name: 'Medium', count: mediumCount },
        { name: 'Pending', count: pendingReportsCount },
        { name: 'Resolved', count: resolvedReportsCount }
    ];

    const kpiCards = [
        { label: 'Total Reports', value: formatNumber(totalReportsCount) },
        { label: 'Resolved Reports', value: formatNumber(resolvedReportsCount) },
        { label: 'Pending Reports', value: formatNumber(pendingReportsCount) },
        { label: 'High + Critical', value: formatNumber(highCount) },
        { label: 'Rejected Reports', value: formatNumber(rejectedReportsCount) },
        { label: 'Resolution Rate', value: `${resolutionRate}%` },
        { label: 'Avg Resolution', value: `${Number(safeMetrics?.avgResolutionHours || 0).toFixed(1)}h` },
        { label: 'Total Users', value: formatNumber(safeMetrics?.totalUsers || 0) }
    ];

    if (loading) return <DashboardLayout><LoadingSpinner fullPage /></DashboardLayout>;
    if (error) return <DashboardLayout><div className="auth-error">{error}</div></DashboardLayout>;

    return (
        <DashboardLayout>
            <section className="mb-6 rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(14,116,144,0.9))] p-6 text-white shadow-[0_26px_80px_-42px_rgba(15,23,42,0.7)] lg:p-8">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-200">Analytics and reports</p>
                        <h1 className="mt-3 text-4xl font-bold text-white lg:text-5xl">Understand complaint flow, urgency, and city response performance.</h1>
                        <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-200">
                            A fuller operational view across status distribution, issue categories, trend movement, and priority pressure.
                        </p>
                    </div>
                    <div className="rounded-3xl bg-white/10 px-5 py-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Last update</p>
                        <p className="mt-2 text-lg font-bold text-white">{lastSnapshot}</p>
                    </div>
                </div>
            </section>

            <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {kpiCards.map((item) => (
                    <article
                        key={item.label}
                        className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]"
                    >
                        <p className="text-3xl font-extrabold text-slate-950">{item.value}</p>
                        <p className="mt-2 text-sm font-semibold text-slate-500">{item.label}</p>
                    </article>
                ))}
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
                <article className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)] xl:col-span-2">
                    <h2 className="text-2xl font-bold text-slate-950">14-day complaint trend</h2>
                    <p className="mt-2 text-sm text-slate-500">Daily created, resolved, and high-priority complaint movement.</p>
                    <div className="mt-6 h-[340px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{
                                        background: '#ffffff',
                                        border: '1px solid rgba(148,163,184,0.25)',
                                        borderRadius: '16px',
                                        color: '#0f172a'
                                    }}
                                />
                                <Legend formatter={prettyLabel} wrapperStyle={{ fontSize: '12px' }} />
                                <Area type="monotone" dataKey="total" stroke="#2563eb" fill="rgba(37,99,235,0.2)" />
                                <Area type="monotone" dataKey="resolved" stroke="#16a34a" fill="rgba(22,163,74,0.18)" />
                                <Area type="monotone" dataKey="highPriority" stroke="#ef4444" fill="rgba(239,68,68,0.16)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </article>

                <article className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]">
                    <h2 className="text-2xl font-bold text-slate-950">Status distribution</h2>
                    <p className="mt-2 text-sm text-slate-500">Current complaint state mix across the platform.</p>
                    <div className="mt-6 h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="44%"
                                    innerRadius={58}
                                    outerRadius={84}
                                    dataKey="value"
                                    label={false}
                                    labelLine={false}
                                >
                                    {statusData.map((_, index) => (
                                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
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
                </article>

                <article className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]">
                    <h2 className="text-2xl font-bold text-slate-950">Priority split</h2>
                    <p className="mt-2 text-sm text-slate-500">How complaints are distributed across urgency levels.</p>
                    <div className="mt-6 h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={priorityData}
                                    cx="50%"
                                    cy="44%"
                                    innerRadius={52}
                                    outerRadius={82}
                                    dataKey="value"
                                    label={false}
                                    labelLine={false}
                                >
                                    {priorityData.map((_, index) => (
                                        <Cell key={index} fill={COLORS[(index + 2) % COLORS.length]} />
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
                </article>

                <article className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]">
                    <h2 className="text-2xl font-bold text-slate-950">Category volume</h2>
                    <p className="mt-2 text-sm text-slate-500">Top complaint categories by report count.</p>
                    <div className="mt-6 h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={categoryData.slice(0, 10)} margin={{ top: 8, right: 12, left: -12, bottom: 44 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fill: '#64748b', fontSize: 11 }}
                                    interval={0}
                                    angle={-20}
                                    textAnchor="end"
                                    height={62}
                                    tickFormatter={(value) => shortLabel(value, 14)}
                                />
                                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                                <Tooltip
                                    formatter={(value, _name, payload) => [value, prettyLabel(payload?.payload?.name || 'Category')]}
                                    contentStyle={{
                                        background: '#ffffff',
                                        border: '1px solid rgba(148,163,184,0.25)',
                                        borderRadius: '16px',
                                        color: '#0f172a'
                                    }}
                                />
                                <Bar dataKey="count" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </article>

                <article className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]">
                    <h2 className="text-2xl font-bold text-slate-950">Global snapshot</h2>
                    <p className="mt-2 text-sm text-slate-500">Quick comparison of major queue buckets.</p>
                    <div className="mt-6 h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={globalSnapshotData} margin={{ top: 8, right: 12, left: -12, bottom: 18 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fill: '#64748b', fontSize: 11 }}
                                    tickFormatter={(value) => shortLabel(value, 12)}
                                />
                                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{
                                        background: '#ffffff',
                                        border: '1px solid rgba(148,163,184,0.25)',
                                        borderRadius: '16px',
                                        color: '#0f172a'
                                    }}
                                />
                                <Bar dataKey="count" fill="#2563eb" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </article>
            </section>
        </DashboardLayout>
    );
}
