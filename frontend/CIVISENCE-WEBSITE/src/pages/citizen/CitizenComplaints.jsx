import { useState, useEffect, useCallback } from 'react';
import { HiOutlineAdjustmentsHorizontal, HiOutlinePlusCircle } from 'react-icons/hi2';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import ReportCard from '../../components/ReportCard';
import { useAuth } from '../../context/AuthContext';
import { getComplaints } from '../../api/complaints';
import { sortComplaintsByPriorityAndDate } from '../../utils/helpers';

const REFRESH_INTERVAL_MS = 20000;

export default function CitizenComplaints() {
    const { user } = useAuth();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

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
            const params = { reportedBy: user.id };
            if (statusFilter) params.status = statusFilter;
            if (categoryFilter) params.category = categoryFilter;
            const { data } = await getComplaints(params);
            setComplaints(data.data || []);
        } catch {
            /* ignore */
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [categoryFilter, statusFilter, user?.id]);

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

    const categories = [...new Set(complaints.map((item) => item.category).filter(Boolean))];
    const sortedComplaints = sortComplaintsByPriorityAndDate(complaints);

    return (
        <DashboardLayout>
            <div className="page-header">
                <div>
                    <h1>My complaints</h1>
                    <p>Filter your complaints by status and category, then open any case to see full details.</p>
                </div>
                <Link to="/citizen/report" className="btn btn-primary btn-sm">
                    <HiOutlinePlusCircle />
                    New complaint
                </Link>
            </div>

            <div className="filters-bar">
                <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
                    <HiOutlineAdjustmentsHorizontal className="text-lg text-sky-700" />
                    Filters
                </div>
                <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="">All statuses</option>
                    <option value="reported">Reported</option>
                    <option value="assigned">Assigned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="rejected">Rejected</option>
                    <option value="unassigned">Unassigned</option>
                </select>
                <select className="input" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                    <option value="">All categories</option>
                    {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <LoadingSpinner />
            ) : complaints.length === 0 ? (
                <EmptyState title="No reports found" message="Adjust your filters or create a new report to get started." />
            ) : (
                <div className="reports-grid">
                    {sortedComplaints.map((item) => (
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
