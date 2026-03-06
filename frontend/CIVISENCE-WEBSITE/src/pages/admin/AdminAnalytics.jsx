import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getDashboardMetrics } from '../../api/admin';
import { getErrorMessage } from '../../utils/helpers';
import { isDemoSession } from '../../utils/authStorage';
import { DEMO_ADMIN_METRICS } from '../../constants/demoData';
import './AdminDashboard.css';
import './AdminAnalytics.css';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    AreaChart,
    Area
} from 'recharts';

const COLORS = ['#2563eb', '#06b6d4', '#16a34a', '#f59e0b', '#ef4444', '#7c3aed', '#ec4899'];
const REFRESH_INTERVAL_MS = 30000;

const toChartEntries = (value = {}) =>
    Object.entries(value).map(([name, count]) => ({ name, value: Number(count || 0) }));

const formatNumber = (value) => Number(value || 0).toLocaleString();
const prettyLabel = (value) => String(value || '').replace(/_/g, ' ');
const shortLabel = (value, max = 12) => {
    const text = String(value || '');
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
};

const getKpiColor = (type) => {
    if (type === 'success') return 'analytics-kpi-card--success';
    if (type === 'danger') return 'analytics-kpi-card--danger';
    if (type === 'warning') return 'analytics-kpi-card--warning';
    if (type === 'info') return 'analytics-kpi-card--info';
    return 'analytics-kpi-card--primary';
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

    const globalSnapshotData = [
        { name: 'Total', count: totalReportsCount },
        { name: 'High+Critical', count: highCount },
        { name: 'Medium', count: mediumCount },
        { name: 'Pending', count: pendingReportsCount },
        { name: 'Resolved', count: resolvedReportsCount }
    ];

    const kpiCards = [
        { label: 'Total Reports', value: formatNumber(totalReportsCount), tone: 'primary' },
        { label: 'Resolved Reports', value: formatNumber(resolvedReportsCount), tone: 'success' },
        { label: 'Pending Reports', value: formatNumber(pendingReportsCount), tone: 'warning' },
        { label: 'High + Critical', value: formatNumber(highCount), tone: 'danger' },
        { label: 'Rejected Reports', value: formatNumber(rejectedReportsCount), tone: 'info' },
        { label: 'Resolution Rate', value: `${resolutionRate}%`, tone: 'primary' },
        { label: 'Avg Resolution', value: `${Number(safeMetrics?.avgResolutionHours || 0).toFixed(1)}h`, tone: 'info' },
        { label: 'Total Users', value: formatNumber(safeMetrics?.totalUsers || 0), tone: 'primary' }
    ];

    if (loading) return <DashboardLayout><LoadingSpinner fullPage /></DashboardLayout>;
    if (error) return <DashboardLayout><div className="auth-error">{error}</div></DashboardLayout>;

    return (
        <DashboardLayout>
            <section className="analytics-hero card">
                <div>
                    <h1>Analytics Control Center</h1>
                    <p>Comprehensive civic operations analytics with auto-refresh every 30 seconds.</p>
                </div>
                <div className="analytics-hero__meta">
                    <span className="analytics-live-dot" />
                    <span>
                        Last update: {safeMetrics?.snapshotAt ? new Date(safeMetrics.snapshotAt).toLocaleString() : 'Live'}
                    </span>
                </div>
            </section>

            <section className="analytics-kpi-grid">
                {kpiCards.map((item) => (
                    <article key={item.label} className={`analytics-kpi-card card ${getKpiColor(item.tone)}`}>
                        <span className="analytics-kpi-card__value">{item.value}</span>
                        <span className="analytics-kpi-card__label">{item.label}</span>
                    </article>
                ))}
            </section>

            <section className="analytics-chart-grid">
                <article className="chart-card card analytics-chart-card analytics-chart-card--wide">
                    <h3>14-Day Complaint Trend</h3>
                    <p>Daily created, resolved, and high-priority complaint pattern.</p>
                    <ResponsiveContainer width="100%" height={320}>
                        <AreaChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                            <Tooltip
                                contentStyle={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 8,
                                    color: 'var(--text-primary)'
                                }}
                            />
                            <Legend formatter={prettyLabel} wrapperStyle={{ fontSize: '12px' }} />
                            <Area type="monotone" dataKey="total" stroke="#2563eb" fill="rgba(37,99,235,0.2)" />
                            <Area type="monotone" dataKey="resolved" stroke="#16a34a" fill="rgba(22,163,74,0.18)" />
                            <Area type="monotone" dataKey="highPriority" stroke="#ef4444" fill="rgba(239,68,68,0.16)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </article>

                <article className="chart-card card analytics-chart-card">
                    <h3>Status Distribution</h3>
                    <p>Current complaint status mix across all reports.</p>
                    <ResponsiveContainer width="100%" height={280}>
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
                </article>

                <article className="chart-card card analytics-chart-card">
                    <h3>Priority Split</h3>
                    <p>Critical-to-low priority ratio from AI decisions.</p>
                    <ResponsiveContainer width="100%" height={280}>
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
                </article>

                <article className="chart-card card analytics-chart-card">
                    <h3>Category Volume</h3>
                    <p>Top complaint categories by report count.</p>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={categoryData.slice(0, 10)} margin={{ top: 8, right: 12, left: -12, bottom: 44 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis
                                dataKey="name"
                                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                                interval={0}
                                angle={-20}
                                textAnchor="end"
                                height={62}
                                tickFormatter={(value) => shortLabel(value, 14)}
                            />
                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                            <Tooltip
                                formatter={(value, _name, payload) => [value, prettyLabel(payload?.payload?.name || 'Category')]}
                                contentStyle={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 8,
                                    color: 'var(--text-primary)'
                                }}
                            />
                            <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </article>

                <article className="chart-card card analytics-chart-card">
                    <h3>Global Snapshot</h3>
                    <p>Quick operational comparison of key queue buckets.</p>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={globalSnapshotData} margin={{ top: 8, right: 12, left: -12, bottom: 18 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={(value) => shortLabel(value, 12)} />
                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                            <Tooltip
                                contentStyle={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 8,
                                    color: 'var(--text-primary)'
                                }}
                            />
                            <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </article>
            </section>
        </DashboardLayout>
    );
}
