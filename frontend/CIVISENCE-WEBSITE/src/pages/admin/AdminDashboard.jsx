import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import StatsCard from '../../components/StatsCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getDashboardMetrics } from '../../api/admin';
import { getOffices } from '../../api/offices';
import { getErrorMessage } from '../../utils/helpers';
import { isDemoSession } from '../../utils/authStorage';
import { DEMO_ADMIN_METRICS, DEMO_OFFICES } from '../../constants/demoData';
import '../citizen/CitizenDashboard.css';
import './AdminDashboard.css';
import {
    HiOutlineDocumentText,
    HiOutlineCheckCircle,
    HiOutlineBuildingOffice,
    HiOutlineExclamationTriangle,
    HiOutlineUserGroup,
    HiOutlineSparkles
} from 'react-icons/hi2';
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
    Legend
} from 'recharts';

const CHART_COLORS = ['#0f62fe', '#16d5d5', '#10b981', '#f59e0b', '#ef4444', '#22c0ff'];
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
            const [metricsRes, officesRes] = await Promise.all([
                getDashboardMetrics(),
                getOffices()
            ]);
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
    const highPriorityCount =
        (metrics?.priorityBreakdown?.critical || 0) + (metrics?.priorityBreakdown?.high || 0);
    const lastSnapshotText = metrics?.snapshotAt
        ? new Date(metrics.snapshotAt).toLocaleString()
        : 'live';

    return (
        <DashboardLayout>
            <div className="page-header">
                <div>
                    <h1>Admin Dashboard</h1>
                    <p>
                        Office capacity board, global complaint status, and resolution tracking.
                        <span className="admin-dashboard__subhead"> Last snapshot: {lastSnapshotText}</span>
                    </p>
                </div>
            </div>

            <div className="stats-grid">
                <StatsCard icon={<HiOutlineDocumentText />} label="Total Reports" value={totalReports} color="primary" />
                <StatsCard icon={<HiOutlineCheckCircle />} label="Resolved Reports" value={resolvedReports} color="success" />
                <StatsCard icon={<HiOutlineExclamationTriangle />} label="High + Critical" value={highPriorityCount} color="danger" />
                <StatsCard icon={<HiOutlineBuildingOffice />} label="Offices" value={metrics?.totalOffices || offices.length || 0} color="info" />
                <StatsCard icon={<HiOutlineUserGroup />} label="Users" value={metrics?.totalUsers || 0} color="primary" />
                <StatsCard icon={<HiOutlineSparkles />} label="Avg Resolution" value={`${Number(metrics?.avgResolutionHours || 0).toFixed(1)}h`} color="warning" />
            </div>

            <div className="charts-grid">
                {statusData.length > 0 && (
                    <div className="chart-card card">
                        <h3>Global Status Breakdown</h3>
                        <p className="admin-dashboard__chart-meta">All complaint states across the platform.</p>
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="44%"
                                    innerRadius={60}
                                    outerRadius={84}
                                    dataKey="value"
                                    label={false}
                                    labelLine={false}
                                >
                                    {statusData.map((_, i) => (
                                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
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
                )}

                {officeCapacityData.length > 0 && (
                    <div className="chart-card card">
                        <h3>Top Office Capacity Usage</h3>
                        <p className="admin-dashboard__chart-meta">Highest load ratio offices (workload/capacity).</p>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={officeCapacityData.slice(0, 8)} margin={{ top: 8, right: 12, left: -12, bottom: 24 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="shortName" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                                <Tooltip
                                    formatter={(value, key) => [value, key === 'usagePct' ? 'Usage %' : 'Value']}
                                    contentStyle={{
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 8,
                                        color: 'var(--text-primary)'
                                    }}
                                />
                                <Bar dataKey="usagePct" fill="#0f62fe" radius={[5, 5, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            <div className="section-title">
                <h2>Office Capacity Board</h2>
            </div>

            <div className="office-capacity-grid">
                {officeCapacityData.slice(0, 12).map((office) => (
                    <article key={office.id} className="office-capacity-card card">
                        <div className="office-capacity-card__head">
                            <h4>{office.name}</h4>
                            <span className={`office-capacity-card__status ${office.active ? 'active' : 'inactive'}`}>
                                {office.active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <div className="office-capacity-card__meta">
                            <span>{office.workload} / {office.maxCapacity} workload</span>
                            <strong>{office.usagePct}%</strong>
                        </div>
                        <div className="office-capacity-card__progress">
                            <div
                                className={`office-capacity-card__progress-fill ${
                                    office.usagePct >= 90 ? 'critical' : office.usagePct >= 70 ? 'warn' : 'normal'
                                }`}
                                style={{ width: `${Math.min(100, office.usagePct)}%` }}
                            />
                        </div>
                    </article>
                ))}
            </div>
        </DashboardLayout>
    );
}

