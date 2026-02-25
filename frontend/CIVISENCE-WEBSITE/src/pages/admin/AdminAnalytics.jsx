import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getDashboardMetrics } from '../../api/admin';
import { getComplaints } from '../../api/complaints';
import { getErrorMessage } from '../../utils/helpers';
import { isDemoSession } from '../../utils/authStorage';
import { DEMO_ADMIN_METRICS, DEMO_COMPLAINTS } from '../../constants/demoData';
import './AdminDashboard.css';
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    AreaChart, Area
} from 'recharts';

const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AdminAnalytics() {
    const [metrics, setMetrics] = useState(null);
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [metricsRes, complaintsRes] = await Promise.all([
                getDashboardMetrics(),
                getComplaints()
            ]);
            setMetrics(metricsRes.data.data);
            setComplaints(complaintsRes.data.data || []);
        } catch (err) {
            if (isDemoSession()) {
                setMetrics(DEMO_ADMIN_METRICS);
                setComplaints(DEMO_COMPLAINTS);
                setError('');
                return;
            }
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <DashboardLayout><LoadingSpinner fullPage /></DashboardLayout>;
    if (error) return <DashboardLayout><div className="auth-error">{error}</div></DashboardLayout>;

    // Compute chart data
    const statusData = metrics?.statusBreakdown
        ? Object.entries(metrics.statusBreakdown).map(([name, value]) => ({ name, value }))
        : [];

    const categoryData = metrics?.topCategories
        ? metrics.topCategories.map((c) => ({ name: c._id || c.category, count: c.count }))
        : [];

    // Build monthly trend from complaints
    const monthlyMap = {};
    complaints.forEach((c) => {
        const d = new Date(c.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyMap[key]) monthlyMap[key] = { month: key, total: 0, resolved: 0 };
        monthlyMap[key].total++;
        if (c.status === 'resolved') monthlyMap[key].resolved++;
    });
    const trendData = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));

    // Priority distribution
    const priorityMap = {};
    complaints.forEach((c) => {
        const lvl = c.priority?.level || 'low';
        priorityMap[lvl] = (priorityMap[lvl] || 0) + 1;
    });
    const priorityData = Object.entries(priorityMap).map(([name, value]) => ({ name, value }));

    const totalReportsCount = metrics?.totalReports || metrics?.totalComplaints || 0;
    const resolvedReportsCount = metrics?.resolvedReports || metrics?.resolvedComplaints || 0;
    const highCount = (metrics?.priorityBreakdown?.critical || 0) + (metrics?.priorityBreakdown?.high || priorityMap.high || 0);
    const mediumCount = metrics?.priorityBreakdown?.medium || priorityMap.medium || 0;

    const resolutionRate = totalReportsCount
        ? ((resolvedReportsCount / totalReportsCount) * 100).toFixed(1)
        : 0;

    const globalSnapshotData = [
        { name: 'Global Total', count: totalReportsCount },
        { name: 'High + Critical', count: highCount },
        { name: 'Medium', count: mediumCount },
        { name: 'Resolved', count: resolvedReportsCount }
    ];

    return (
        <DashboardLayout>
            <div className="page-header">
                <div>
                    <h1>Analytics</h1>
                    <p>In-depth analysis of complaint data and system performance</p>
                </div>
            </div>

            {/* Summary row */}
            <div className="analytics-summary">
                <div className="analytics-metric card border border-indigo-400/25 shadow-[0_0_24px_rgba(99,102,241,0.18)]">
                    <span className="analytics-metric__value">{resolutionRate}%</span>
                    <span className="analytics-metric__label">Resolution Rate</span>
                </div>
                <div className="analytics-metric card border border-cyan-400/25">
                    <span className="analytics-metric__value">{totalReportsCount}</span>
                    <span className="analytics-metric__label">Global Total</span>
                </div>
                <div className="analytics-metric card border border-emerald-400/25">
                    <span className="analytics-metric__value">{highCount}</span>
                    <span className="analytics-metric__label">High + Critical</span>
                </div>
                <div className="analytics-metric card border border-violet-400/25">
                    <span className="analytics-metric__value">{mediumCount}</span>
                    <span className="analytics-metric__label">Medium Priority</span>
                </div>
                <div className="analytics-metric card border border-amber-400/25">
                    <span className="analytics-metric__value">{resolvedReportsCount}</span>
                    <span className="analytics-metric__label">Resolved Reports</span>
                </div>
                <div className="analytics-metric card border border-cyan-400/25">
                    <span className="analytics-metric__value">{metrics?.avgResolutionHours?.toFixed(1) || 0}h</span>
                    <span className="analytics-metric__label">Avg Resolution Time</span>
                </div>
                <div className="analytics-metric card border border-indigo-400/25">
                    <span className="analytics-metric__value">{metrics?.totalUsers || 0}</span>
                    <span className="analytics-metric__label">Total Users</span>
                </div>
            </div>

            <div className="charts-grid">
                {globalSnapshotData.length > 0 && (
                    <div className="chart-card card" style={{ gridColumn: 'span 2' }}>
                        <h3>Global Priority Snapshot</h3>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={globalSnapshotData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)' }} />
                                <Bar dataKey="count" fill="#6366f1" radius={[5, 5, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Monthly trend */}
                {trendData.length > 0 && (
                    <div className="chart-card card" style={{ gridColumn: 'span 2' }}>
                        <h3>Monthly Trend</h3>
                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)' }} />
                                <Legend />
                                <Area type="monotone" dataKey="total" stroke="#6366f1" fill="rgba(99,102,241,0.2)" />
                                <Area type="monotone" dataKey="resolved" stroke="#10b981" fill="rgba(16,185,129,0.2)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Status pie */}
                {statusData.length > 0 && (
                    <div className="chart-card card">
                        <h3>Status Distribution</h3>
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                                    {statusData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Priority donut */}
                {priorityData.length > 0 && (
                    <div className="chart-card card">
                        <h3>Priority Levels</h3>
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie data={priorityData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label>
                                    {priorityData.map((_, i) => (<Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Top Categories */}
                {categoryData.length > 0 && (
                    <div className="chart-card card">
                        <h3>Top Categories</h3>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={categoryData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} interval={0} angle={-15} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)' }} />
                                <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
