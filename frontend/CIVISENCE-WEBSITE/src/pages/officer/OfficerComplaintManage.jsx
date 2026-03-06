import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getComplaintById, updateComplaintStatus } from '../../api/complaints';
import { formatDateTime, getErrorMessage } from '../../utils/helpers';
import '../citizen/ComplaintDetail.css';
import './OfficerDashboard.css';

const UPDATABLE_STATUSES = new Set(['reported', 'unassigned', 'assigned', 'in_progress']);
const DEFAULT_RESOLUTION_REMARK = 'Issue resolved by municipal office.';

const toStatusText = (status) =>
    (status || 'reported').replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());

export default function OfficerComplaintManage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [complaint, setComplaint] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updatingStatus, setUpdatingStatus] = useState('');
    const [loadError, setLoadError] = useState('');
    const [actionError, setActionError] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');

    useEffect(() => {
        void loadComplaint();
    }, [id]);

    const loadComplaint = async () => {
        try {
            const { data } = await getComplaintById(id);
            setComplaint(data.data);
        } catch (err) {
            setLoadError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (nextStatus) => {
        if (!complaint || complaint.status === nextStatus || updatingStatus) return;
        if (!UPDATABLE_STATUSES.has(complaint.status) && complaint.status !== nextStatus) {
            setActionError('This complaint is already in a terminal status.');
            return;
        }

        let remark = '';
        let rejectionReasonValue = '';

        if (nextStatus === 'resolved') {
            const confirmed = window.confirm('Mark this complaint as resolved?');
            if (!confirmed) return;
            remark = complaint.resolutionRemark || DEFAULT_RESOLUTION_REMARK;
        }

        if (nextStatus === 'in_progress') {
            const confirmed = window.confirm('Move this complaint to In Progress?');
            if (!confirmed) return;
        }

        if (nextStatus === 'rejected') {
            rejectionReasonValue = rejectionReason.trim();
            if (!rejectionReasonValue) {
                setActionError('Rejection reason is required.');
                return;
            }
        }

        setUpdatingStatus(nextStatus);
        setActionError('');

        try {
            const { data } = await updateComplaintStatus(id, {
                status: nextStatus,
                remark,
                rejectionReason: rejectionReasonValue
            });
            setComplaint(data.data);
            if (nextStatus === 'rejected') {
                setRejectionReason('');
            }
        } catch (err) {
            setActionError(getErrorMessage(err));
        } finally {
            setUpdatingStatus('');
        }
    };

    if (loading) return <DashboardLayout><LoadingSpinner fullPage /></DashboardLayout>;
    if (loadError) return <DashboardLayout><div className="auth-error">{loadError}</div></DashboardLayout>;
    if (!complaint) return null;

    const statusLocked = !UPDATABLE_STATUSES.has(complaint.status);

    return (
        <DashboardLayout>
            <div className="officer-detail-header">
                <div className="officer-detail-header__left">
                    <button
                        onClick={() => navigate(-1)}
                        className="btn btn-ghost btn-sm"
                        style={{ width: 'fit-content' }}
                    >
                        {'<- Back'}
                    </button>
                    <h1>{complaint.title}</h1>
                    <p className="text-muted">Updated: {formatDateTime(complaint.updatedAt)}</p>
                </div>
                <div className="officer-detail-header__right">
                    <span className="text-muted">{toStatusText(complaint.status)}</span>
                    <StatusBadge status={complaint.status} />
                </div>
            </div>

            <div className="detail-grid">
                <div className="detail-main card">
                    <div className="detail-section">
                        <h3>Description</h3>
                        <p>{complaint.description}</p>
                    </div>
                    {complaint.images?.length > 0 && (
                        <div className="detail-section">
                            <h3>Images</h3>
                            <div className="detail-images">
                                {complaint.images.map((img, i) => (
                                    <img key={i} src={img.url} alt={`Image ${i + 1}`} />
                                ))}
                            </div>
                            <div style={{ marginTop: 10, display: 'grid', gap: 4 }}>
                                {complaint.images.map((img, i) => (
                                    <a
                                        key={`path-${i}`}
                                        href={img.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-muted"
                                        style={{ fontSize: 'var(--font-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                    >
                                        S3 Path {i + 1}: {img.url}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="detail-sidebar">
                    <div className="detail-info-card card officer-detail-actions">
                        <h3>Update Status</h3>
                        {actionError && <div className="auth-error">{actionError}</div>}
                        {statusLocked ? (
                            <p className="officer-detail-actions__note">
                                This complaint is already terminal ({toStatusText(complaint.status)}).
                            </p>
                        ) : (
                            <>
                                <div className="officer-detail-actions__row">
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        disabled={Boolean(updatingStatus)}
                                        onClick={() => void handleStatusChange('in_progress')}
                                    >
                                        {updatingStatus === 'in_progress' ? 'Saving...' : 'Mark In Progress'}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-success btn-sm"
                                        disabled={Boolean(updatingStatus)}
                                        onClick={() => void handleStatusChange('resolved')}
                                    >
                                        {updatingStatus === 'resolved' ? 'Saving...' : 'Resolve (Confirm)'}
                                    </button>
                                </div>
                                <div className="input-group">
                                    <label htmlFor="officer-reject-reason-detail">Reject Complaint (Reason Required)</label>
                                    <textarea
                                        id="officer-reject-reason-detail"
                                        className="input"
                                        rows={4}
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        placeholder="Enter rejection reason"
                                        disabled={Boolean(updatingStatus)}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-danger btn-sm"
                                        disabled={Boolean(updatingStatus)}
                                        onClick={() => void handleStatusChange('rejected')}
                                    >
                                        {updatingStatus === 'rejected' ? 'Saving...' : 'Reject Complaint'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="detail-info-card card">
                        <h3>Details</h3>
                        <div className="detail-info-list">
                            <div className="detail-info-row"><span>Status</span><StatusBadge status={complaint.status} /></div>
                            <div className="detail-info-row"><span>Category</span><span className="category-tag">{complaint.category}</span></div>
                            <div className="detail-info-row"><span>Priority</span><span className={`priority-tag priority-tag--${complaint.priority?.level || 'low'}`}>{complaint.priority?.level || 'low'}</span></div>
                            <div className="detail-info-row"><span>Reported By</span><span>{complaint.reportedBy?.name || '-'}</span></div>
                            <div className="detail-info-row"><span>Email</span><span className="text-muted">{complaint.reportedBy?.email || '-'}</span></div>
                            <div className="detail-info-row"><span>Created</span><span className="text-muted">{formatDateTime(complaint.createdAt)}</span></div>
                            <div className="detail-info-row"><span>Updated</span><span className="text-muted">{formatDateTime(complaint.updatedAt)}</span></div>
                            {complaint.resolutionRemark && (
                                <div className="detail-info-row"><span>Resolution Remark</span><span>{complaint.resolutionRemark}</span></div>
                            )}
                            {complaint.rejectionReason && (
                                <div className="detail-info-row"><span>Rejection Reason</span><span>{complaint.rejectionReason}</span></div>
                            )}
                        </div>
                    </div>
                    {complaint.assignedMunicipalOffice && (
                        <div className="detail-info-card card">
                            <h3>Assigned Office</h3>
                            <div className="detail-info-list">
                                <div className="detail-info-row"><span>Name</span><span>{complaint.assignedMunicipalOffice.name}</span></div>
                                <div className="detail-info-row"><span>Type</span><span>{complaint.assignedMunicipalOffice.type}</span></div>
                                <div className="detail-info-row"><span>Zone</span><span>{complaint.assignedMunicipalOffice.zone}</span></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
