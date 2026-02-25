import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import ReportCard from '../../components/ReportCard';
import Modal from '../../components/Modal';
import {
    getComplaints,
    getComplaintById,
    updateComplaintStatus,
    deleteComplaint
} from '../../api/complaints';
import {
    formatDateTime,
    getErrorMessage,
    sortComplaintsByPriorityAndDate
} from '../../utils/helpers';
import { isDemoSession } from '../../utils/authStorage';
import { DEMO_COMPLAINTS } from '../../constants/demoData';
import '../citizen/CitizenDashboard.css';
import './AdminComplaints.css';

const UPDATABLE_STATUSES = new Set(['reported', 'unassigned', 'assigned', 'in_progress']);
const DEFAULT_RESOLUTION_REMARK = 'Issue resolved by administration.';

const toStatusText = (status) =>
    (status || 'reported').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const toCoordinatesLabel = (complaint) => {
    const coordinates = complaint?.location?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
        return 'Location not available';
    }
    const [longitude, latitude] = coordinates;
    return `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
};

const getPriorityReason = (complaint) =>
    complaint?.priority?.reasonSentence ||
    complaint?.priority?.reason ||
    'Priority reason not available';

const toUpdatedByLabel = (entry) => {
    if (entry?.updatedBy?.role === 'officer') {
        return entry.updatedBy?.municipalOfficeId?.name || entry.updatedBy?.name || 'Office Officer';
    }

    if (entry?.updatedBy?.role === 'super_admin') {
        return entry.updatedBy?.name || 'Main Admin';
    }

    if (entry?.updatedBy?.role === 'admin') {
        return entry.updatedBy?.name || 'Admin';
    }

    if (entry?.updatedBy?.name) {
        return entry.updatedBy.name;
    }

    if (entry?.updatedByRole === 'super_admin') return 'Main Admin';
    if (entry?.updatedByRole === 'admin') return 'Admin';
    if (entry?.updatedByRole === 'officer') return 'Office Officer';
    if (entry?.updatedByRole === 'citizen') return 'Citizen';
    return 'System';
};

export default function AdminComplaints() {
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [updating, setUpdating] = useState(null);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [selectedComplaint, setSelectedComplaint] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [reviewError, setReviewError] = useState('');

    useEffect(() => {
        void loadComplaints();
    }, [statusFilter]);

    const loadComplaints = async () => {
        setLoading(true);
        try {
            const params = {};
            if (statusFilter) params.status = statusFilter;
            const { data } = await getComplaints(params);
            setComplaints(data.data || []);
        } catch {
            if (isDemoSession()) {
                const filtered = statusFilter
                    ? DEMO_COMPLAINTS.filter((c) => c.status === statusFilter)
                    : DEMO_COMPLAINTS;
                setComplaints(filtered);
            }
        } finally {
            setLoading(false);
        }
    };

    const loadComplaintDetails = async (complaint) => {
        setLoadingDetails(true);
        setReviewError('');
        setRejectionReason('');
        try {
            if (isDemoSession()) {
                setSelectedComplaint(complaint);
                return;
            }
            const { data } = await getComplaintById(complaint._id);
            setSelectedComplaint(data.data);
        } catch (err) {
            setReviewError(getErrorMessage(err));
        } finally {
            setLoadingDetails(false);
        }
    };

    const openReviewModal = async (complaint) => {
        setReviewOpen(true);
        await loadComplaintDetails(complaint);
    };

    const closeReviewModal = () => {
        if (updating) return;
        setReviewOpen(false);
        setSelectedComplaint(null);
        setRejectionReason('');
        setReviewError('');
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this complaint?')) return;
        try {
            if (isDemoSession()) {
                setComplaints((prev) => prev.filter((c) => c._id !== id));
                if (selectedComplaint?._id === id) {
                    closeReviewModal();
                }
                return;
            }
            await deleteComplaint(id);
            setComplaints((prev) => prev.filter((c) => c._id !== id));
            if (selectedComplaint?._id === id) {
                closeReviewModal();
            }
        } catch (err) {
            alert(getErrorMessage(err));
        }
    };

    const updateComplaintInState = (updatedComplaint) => {
        setComplaints((prev) =>
            prev.map((item) => (item._id === updatedComplaint._id ? updatedComplaint : item))
        );
        setSelectedComplaint(updatedComplaint);
    };

    const saveStatus = async (nextStatus, payload = {}) => {
        if (!selectedComplaint || updating) return;
        if (!UPDATABLE_STATUSES.has(selectedComplaint.status) && selectedComplaint.status !== nextStatus) {
            setReviewError('Only reported, unassigned, assigned, or in-progress complaints can be updated.');
            return;
        }

        setUpdating(nextStatus);
        setReviewError('');

        try {
            if (isDemoSession()) {
                const demoUpdated = {
                    ...selectedComplaint,
                    status: nextStatus,
                    resolutionRemark: nextStatus === 'resolved' ? payload.remark : null,
                    rejectionReason: nextStatus === 'rejected' ? payload.rejectionReason : null,
                    updatedAt: new Date().toISOString()
                };
                updateComplaintInState(demoUpdated);
                return;
            }

            const { data } = await updateComplaintStatus(selectedComplaint._id, {
                status: nextStatus,
                remark: payload.remark || '',
                rejectionReason: payload.rejectionReason || ''
            });
            updateComplaintInState(data.data);
        } catch (err) {
            setReviewError(getErrorMessage(err));
        } finally {
            setUpdating(null);
        }
    };

    const handleResolve = async () => {
        if (!selectedComplaint) return;
        const confirmed = window.confirm('Mark this complaint as resolved?');
        if (!confirmed) return;
        const remark = selectedComplaint.resolutionRemark || DEFAULT_RESOLUTION_REMARK;
        await saveStatus('resolved', { remark });
    };

    const handleReject = async () => {
        const trimmedReason = rejectionReason.trim();
        if (!trimmedReason) {
            setReviewError('Rejection reason is required.');
            return;
        }
        await saveStatus('rejected', { rejectionReason: trimmedReason });
    };

    const handleMarkInProgress = async () => {
        if (!selectedComplaint) return;
        const confirmed = window.confirm('Move this complaint to In Progress?');
        if (!confirmed) return;
        await saveStatus('in_progress');
    };

    const sortedComplaints = useMemo(
        () => sortComplaintsByPriorityAndDate(complaints),
        [complaints]
    );

    const statusLocked = selectedComplaint && !UPDATABLE_STATUSES.has(selectedComplaint.status);

    return (
        <DashboardLayout>
            <div className="page-header">
                <div>
                    <h1>All Complaints</h1>
                    <p>Review each issue in a dedicated modal and update status with proper controls.</p>
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
            </div>

            {loading ? (
                <LoadingSpinner />
            ) : complaints.length === 0 ? (
                <EmptyState title="No complaints" message="No complaints match your filter" />
            ) : (
                <div className="reports-grid">
                    {sortedComplaints.map((c) => (
                        <ReportCard
                            key={c._id}
                            complaint={c}
                            detailPath={`/admin/complaint/${c._id}`}
                            showReporter
                            showReviewButton
                            onReview={openReviewModal}
                            onDelete={handleDelete}
                            isUpdating={Boolean(updating && selectedComplaint?._id === c._id)}
                        />
                    ))}
                </div>
            )}

            <Modal isOpen={reviewOpen} onClose={closeReviewModal} title="Complaint Review" size="lg">
                {loadingDetails ? (
                    <LoadingSpinner />
                ) : selectedComplaint ? (
                    <div className="admin-review">
                        {reviewError && <div className="auth-error">{reviewError}</div>}

                        <div className="admin-review__grid">
                            <div className="admin-review__section card">
                                <h3>{selectedComplaint.title}</h3>
                                <p className="admin-review__description">{selectedComplaint.description}</p>

                                <div className="admin-review__meta">
                                    <div><span>Status:</span> {toStatusText(selectedComplaint.status)}</div>
                                    <div><span>Category:</span> {selectedComplaint.category}</div>
                                    <div><span>Priority:</span> {toStatusText(selectedComplaint.priority?.level || 'low')}</div>
                                    <div><span>Created:</span> {formatDateTime(selectedComplaint.createdAt)}</div>
                                    <div><span>Updated:</span> {formatDateTime(selectedComplaint.updatedAt)}</div>
                                </div>
                            </div>

                            <div className="admin-review__section card">
                                <h4>Report Details</h4>
                                <div className="admin-review__meta">
                                    <div><span>Reported By:</span> {selectedComplaint.reportedBy?.name || '-'}</div>
                                    <div><span>Email:</span> {selectedComplaint.reportedBy?.email || '-'}</div>
                                    <div><span>Location:</span> {toCoordinatesLabel(selectedComplaint)}</div>
                                    <div><span>Priority Reason:</span> {getPriorityReason(selectedComplaint)}</div>
                                    <div><span>Assigned Office:</span> {selectedComplaint.assignedMunicipalOffice?.name || selectedComplaint.assignedOfficeType || 'Pending'}</div>
                                </div>

                                {selectedComplaint.images?.[0]?.url && (
                                    <div className="admin-review__image-wrap">
                                        <img
                                            src={selectedComplaint.images[0].url}
                                            alt={selectedComplaint.title}
                                            className="admin-review__image"
                                        />
                                        <a
                                            className="admin-review__image-link"
                                            href={selectedComplaint.images[0].url}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            Open S3 Image
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>

                        {(selectedComplaint.resolutionRemark || selectedComplaint.rejectionReason) && (
                            <div className="admin-review__section card">
                                <h4>Latest Decision Note</h4>
                                {selectedComplaint.resolutionRemark && (
                                    <p className="admin-review__note admin-review__note--ok">
                                        Resolution Remark: {selectedComplaint.resolutionRemark}
                                    </p>
                                )}
                                {selectedComplaint.rejectionReason && (
                                    <p className="admin-review__note admin-review__note--warn">
                                        Rejection Reason: {selectedComplaint.rejectionReason}
                                    </p>
                                )}
                            </div>
                        )}

                        {Array.isArray(selectedComplaint.statusHistory) && selectedComplaint.statusHistory.length > 0 && (
                            <div className="admin-review__section card">
                                <h4>Status Timeline</h4>
                                <div className="admin-review__timeline">
                                    {selectedComplaint.statusHistory.map((entry, index) => (
                                        <div className="admin-review__timeline-item" key={`${entry.updatedAt}-${entry.status}-${index}`}>
                                            <strong>{toStatusText(entry.status)}</strong>
                                            <span>{formatDateTime(entry.updatedAt)}</span>
                                            <p>Updated By: {toUpdatedByLabel(entry)}</p>
                                            {entry.remark && <p>Remark: {entry.remark}</p>}
                                            {entry.rejectionReason && <p>Rejection: {entry.rejectionReason}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="admin-review__actions card">
                            <h4>Update Status</h4>
                            {statusLocked ? (
                                <p className="admin-review__locked">
                                    This complaint is already terminal ({toStatusText(selectedComplaint.status)}).
                                </p>
                            ) : (
                                <>
                                    <div className="admin-review__action-row">
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            disabled={Boolean(updating)}
                                            onClick={() => void handleMarkInProgress()}
                                        >
                                            {updating === 'in_progress' ? 'Saving...' : 'Mark In Progress'}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-success"
                                            disabled={Boolean(updating)}
                                            onClick={() => void handleResolve()}
                                        >
                                            {updating === 'resolved' ? 'Saving...' : 'Resolve (Confirm)'}
                                        </button>
                                    </div>

                                    <div className="admin-review__reject">
                                        <label htmlFor="reject-reason">Reject Complaint (Reason Required)</label>
                                        <textarea
                                            id="reject-reason"
                                            className="input"
                                            rows={4}
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            placeholder="Enter rejection reason..."
                                            disabled={Boolean(updating)}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-danger"
                                            disabled={Boolean(updating)}
                                            onClick={() => void handleReject()}
                                        >
                                            {updating === 'rejected' ? 'Saving...' : 'Reject Complaint'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <EmptyState title="No complaint selected" message="Choose a complaint to review." />
                )}
            </Modal>
        </DashboardLayout>
    );
}
