import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import StatsCard from '../../components/StatsCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import ReportCard from '../../components/ReportCard';
import { useAuth } from '../../context/AuthContext';
import { getComplaints } from '../../api/complaints';
import { sortComplaintsByPriorityAndDate } from '../../utils/helpers';
import './CitizenDashboard.css';
import {
    HiOutlineDocumentText,
    HiOutlineCheckCircle,
    HiOutlineClock,
    HiOutlineExclamationTriangle
} from 'react-icons/hi2';

export default function CitizenDashboard() {
    const { user } = useAuth();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadComplaints();
        const intervalId = window.setInterval(loadComplaints, 12000);
        return () => window.clearInterval(intervalId);
    }, [user?.id]);

    const loadComplaints = async () => {
        try {
            const { data } = await getComplaints({ reportedBy: user.id });
            setComplaints(data.data || []);
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    };

    const total = complaints.length;
    const resolved = complaints.filter((c) => c.status === 'resolved').length;
    const pending = complaints.filter((c) => ['reported', 'assigned', 'in_progress', 'unassigned'].includes(c.status)).length;
    const rejected = complaints.filter((c) => c.status === 'rejected').length;
    const prioritizedRecent = sortComplaintsByPriorityAndDate(complaints).slice(0, 6);

    if (loading) return <DashboardLayout><LoadingSpinner fullPage /></DashboardLayout>;

    return (
        <DashboardLayout>
            <div className="page-header">
                <div>
                    <h1>Citizen Profile</h1>
                    <p>View your profile details and report history</p>
                </div>
            </div>

            <div className="citizen-profile-card card">
                <div className="citizen-profile-card__avatar">
                    {user?.profilePhotoUrl ? (
                        <img src={user.profilePhotoUrl} alt={user?.name || 'Citizen'} />
                    ) : (
                        <span>{user?.name?.charAt(0)?.toUpperCase() || 'C'}</span>
                    )}
                </div>
                <div className="citizen-profile-card__info">
                    <h3>{user?.name || 'Citizen'}</h3>
                    <p>{user?.email || 'No email available'}</p>
                    <span className="citizen-profile-card__role">Role: Citizen</span>
                </div>
                <div className="citizen-profile-card__actions">
                    <Link to="/citizen/complaints" className="btn btn-secondary btn-sm">
                        View My Reports
                    </Link>
                </div>
            </div>

            <div className="stats-grid">
                <StatsCard icon={<HiOutlineDocumentText />} label="Total Reports" value={total} color="primary" />
                <StatsCard icon={<HiOutlineCheckCircle />} label="Resolved" value={resolved} color="success" />
                <StatsCard icon={<HiOutlineClock />} label="Pending" value={pending} color="warning" />
                <StatsCard icon={<HiOutlineExclamationTriangle />} label="Rejected" value={rejected} color="danger" />
            </div>

            <div className="section-title">
                <h2>Recent Reports</h2>
                <Link to="/citizen/complaints" className="btn btn-ghost btn-sm">View All</Link>
            </div>

            {complaints.length === 0 ? (
                <EmptyState
                    title="No reports yet"
                    message="Your submitted reports will appear here once available"
                />
            ) : (
                <div className="reports-grid">
                    {prioritizedRecent.map((c) => (
                        <ReportCard
                            key={c._id}
                            complaint={c}
                            detailPath={`/citizen/complaint/${c._id}`}
                        />
                    ))}
                </div>
            )}
        </DashboardLayout>
    );
}
