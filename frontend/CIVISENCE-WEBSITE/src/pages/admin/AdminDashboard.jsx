import { useEffect, useMemo, useState } from 'react';
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
    Tooltip
} from 'recharts';

const CHART_COLORS = ['#0f62fe', '#16d5d5', '#10b981', '#f59e0b', '#ef4444', '#22c0ff'];

const toShortOfficeName = (name = '') => {
    if (name.length <= 18) return name;
    return `${name.slice(0, 16)}..`;
};

export default function AdminDashboard() {
    const [metrics, setMetrics] = useState(null);
    const [offices, setOffices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        void loadData();
    }, []);

    const loadData = async () => {
        try {
            const [metricsRes, officesRes] = await Promise.all([
                getDashboardMetrics(),
                getOffices()
            ]);
            setMetrics(metricsRes.data.data);
            setOffices(officesRes.data.data || []);
        } catch (err) {
            if (isDemoSession()) {
                setMetrics(DEMO_ADMIN_METRICS);
                setOffices(DEMO_OFFICES || []);
                setError('');
                return;
            }
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

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

    return (
        <DashboardLayout>
            <div className="page-header">
                <div>
                    <h1>Admin Dashboard</h1>
                    <p>Office capacity board, global complaint status, and resolution tracking.</p>
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
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={98}
                                    dataKey="value"
                                    label={({ name, value }) => `${name}: ${value}`}
                                >
                                    {statusData.map((_, i) => (
                                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {officeCapacityData.length > 0 && (
                    <div className="chart-card card">
                        <h3>Top Office Capacity Usage</h3>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={officeCapacityData.slice(0, 8)}>
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

