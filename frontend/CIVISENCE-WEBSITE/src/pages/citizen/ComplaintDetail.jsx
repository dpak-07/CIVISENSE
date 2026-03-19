import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HiOutlineArrowLeft, HiOutlineTrash } from 'react-icons/hi2';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getComplaintById, deleteComplaint } from '../../api/complaints';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime, getErrorMessage } from '../../utils/helpers';

const priorityClassMap = {
    critical: 'priority-tag--critical',
    high: 'priority-tag--high',
    medium: 'priority-tag--medium',
    low: 'priority-tag--low'
};

export default function ComplaintDetail() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [complaint, setComplaint] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        void loadComplaint();
        const intervalId = window.setInterval(() => {
            void loadComplaint();
        }, 10000);
        return () => window.clearInterval(intervalId);
    }, [id]);

    const loadComplaint = async () => {
        try {
            const { data } = await getComplaintById(id);
            setComplaint(data.data);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this complaint?')) return;
        try {
            await deleteComplaint(id);
            navigate(-1, { replace: true });
        } catch (err) {
            setError(getErrorMessage(err));
        }
    };

    if (loading) return <DashboardLayout><LoadingSpinner fullPage /></DashboardLayout>;
    if (error) return <DashboardLayout><div className="auth-error">{error}</div></DashboardLayout>;
    if (!complaint) return null;

    const isOwner = complaint.reportedBy?._id === user.id || complaint.reportedBy === user.id;
    const priorityLevel = complaint.priority?.level || 'low';
    const priorityClass = priorityClassMap[priorityLevel] || priorityClassMap.low;
    const complaintCode = String(complaint?._id || '').slice(-6).toUpperCase() || 'N/A';
    const coordinates = complaint?.location?.coordinates;
    const locationLabel =
        Array.isArray(coordinates) && coordinates.length === 2
            ? `${Number(coordinates[1]).toFixed(5)}, ${Number(coordinates[0]).toFixed(5)}`
            : 'Location not available';
    const priorityReason = complaint?.priority?.reasonSentence || complaint?.priority?.reason || 'No priority note available';

    return (
        <DashboardLayout>
            <div className="page-header">
                <div>
                    <button type="button" onClick={() => navigate(-1)} className="btn btn-ghost btn-sm">
                        <HiOutlineArrowLeft />
                        Back
                    </button>
                    <h1 className="mt-4">{complaint.title}</h1>
                    <p>Review full complaint details, current status, and any evidence submitted with the report.</p>
                </div>
                {(isOwner || user.role === 'admin' || user.role === 'super_admin') ? (
                    <button className="btn btn-danger btn-sm" onClick={handleDelete}>
                        <HiOutlineTrash />
                        Delete
                    </button>
                ) : null}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-6">
                    <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]">
                        <div className="flex flex-wrap items-center gap-3">
                            <StatusBadge status={complaint.status} />
                            <span className={`priority-tag ${priorityClass}`}>{priorityLevel}</span>
                            <span className="category-tag">{complaint.category || 'Uncategorized'}</span>
                        </div>
                        <div className="mt-4 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 sm:grid-cols-2">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Complaint No.</p>
                                <p className="mt-1 text-sm font-semibold text-slate-800">#{complaintCode}</p>
                            </div>
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Location</p>
                                <p className="mt-1 text-sm font-semibold text-slate-800">{locationLabel}</p>
                            </div>
                        </div>
                        <div className="mt-6">
                            <h2 className="text-2xl font-bold text-slate-950">Description</h2>
                            <p className="mt-4 text-sm leading-8 text-slate-600">{complaint.description}</p>
                        </div>
                        <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-4 text-sm text-sky-900">
                            <strong className="block font-semibold">Priority note</strong>
                            <span>{priorityReason}</span>
                        </div>
                    </div>

                    {complaint.images?.length > 0 ? (
                        <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]">
                            <h2 className="text-2xl font-bold text-slate-950">Evidence images</h2>
                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                {complaint.images.map((img, index) => (
                                    <a
                                        key={index}
                                        href={img.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50 transition hover:border-sky-200"
                                    >
                                        <img src={img.url} alt={`Complaint evidence ${index + 1}`} className="h-64 w-full object-cover" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {complaint.aiMeta ? (
                        <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]">
                            <h2 className="text-2xl font-bold text-slate-950">AI analysis</h2>
                            <pre className="mt-5 overflow-x-auto rounded-[1.5rem] bg-slate-950 p-4 text-xs leading-6 text-slate-200">
                                {JSON.stringify(complaint.aiMeta, null, 2)}
                            </pre>
                        </div>
                    ) : null}
                </div>

                <div className="space-y-6">
                    <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]">
                        <h2 className="text-2xl font-bold text-slate-950">Complaint details</h2>
                        <div className="mt-5 space-y-4">
                            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                                <span className="text-sm font-semibold text-slate-500">Created</span>
                                <span className="text-sm text-slate-700">{formatDateTime(complaint.createdAt)}</span>
                            </div>
                            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                                <span className="text-sm font-semibold text-slate-500">Updated</span>
                                <span className="text-sm text-slate-700">{formatDateTime(complaint.updatedAt)}</span>
                            </div>
                            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                                <span className="text-sm font-semibold text-slate-500">Severity score</span>
                                <span className="text-sm text-slate-700">{complaint.severityScore || 0}</span>
                            </div>
                            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                                <span className="text-sm font-semibold text-slate-500">Reported by</span>
                                <span className="text-sm text-slate-700">{complaint.reportedBy?.name || 'N/A'}</span>
                            </div>
                            {complaint.resolutionRemark ? (
                                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                                    <strong className="block font-semibold">Resolution remark</strong>
                                    <span>{complaint.resolutionRemark}</span>
                                </div>
                            ) : null}
                            {complaint.rejectionReason ? (
                                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4 text-sm text-rose-800">
                                    <strong className="block font-semibold">Rejection reason</strong>
                                    <span>{complaint.rejectionReason}</span>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {complaint.assignedMunicipalOffice ? (
                        <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]">
                            <h2 className="text-2xl font-bold text-slate-950">Assigned office</h2>
                            <div className="mt-5 space-y-4">
                                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                                    <span className="text-sm font-semibold text-slate-500">Name</span>
                                    <span className="text-sm text-slate-700">{complaint.assignedMunicipalOffice.name || 'N/A'}</span>
                                </div>
                                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                                    <span className="text-sm font-semibold text-slate-500">Type</span>
                                    <span className="text-sm text-slate-700">{complaint.assignedMunicipalOffice.type || 'N/A'}</span>
                                </div>
                                <div className="flex items-start justify-between gap-4">
                                    <span className="text-sm font-semibold text-slate-500">Zone</span>
                                    <span className="text-sm text-slate-700">{complaint.assignedMunicipalOffice.zone || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {complaint.duplicateInfo?.isDuplicate ? (
                        <div className="rounded-[2rem] border border-amber-200 bg-amber-50 px-6 py-5 text-sm leading-7 text-amber-800 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]">
                            This complaint has been flagged as a duplicate of a master complaint in the system.
                        </div>
                    ) : null}
                </div>
            </div>
        </DashboardLayout>
    );
}
