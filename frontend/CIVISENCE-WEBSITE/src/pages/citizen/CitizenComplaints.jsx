import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import ReportCard from '../../components/ReportCard';
import { useAuth } from '../../context/AuthContext';
import { getComplaints } from '../../api/complaints';
import { sortComplaintsByPriorityAndDate } from '../../utils/helpers';
import '../citizen/CitizenDashboard.css';

export default function CitizenComplaints() {
    const { user } = useAuth();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

    useEffect(() => {
        loadComplaints();
        const intervalId = window.setInterval(loadComplaints, 12000);
        return () => window.clearInterval(intervalId);
    }, [statusFilter, categoryFilter, user?.id]);

    const loadComplaints = async () => {
        setLoading(true);
        try {
            const params = { reportedBy: user.id };
            if (statusFilter) params.status = statusFilter;
            if (categoryFilter) params.category = categoryFilter;
            const { data } = await getComplaints(params);
            setComplaints(data.data || []);
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    };

    const categories = [...new Set(complaints.map((c) => c.category))];
    const sortedComplaints = sortComplaintsByPriorityAndDate(complaints);

    return (
        <DashboardLayout>
            <div className="page-header">
                <div>
                    <h1>My Reports</h1>
                    <p>View all reports submitted from your citizen account</p>
                </div>
            </div>

            <div className="filters-bar">
                <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">All Statuses</option>
                    <option value="reported">Reported</option>
                    <option value="assigned">Assigned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="rejected">Rejected</option>
                    <option value="unassigned">Unassigned</option>
                </select>
                <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <LoadingSpinner />
            ) : complaints.length === 0 ? (
                <EmptyState title="No reports found" message="Adjust your filters to see matching reports" />
            ) : (
                <div className="reports-grid">
                    {sortedComplaints.map((c) => (
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
