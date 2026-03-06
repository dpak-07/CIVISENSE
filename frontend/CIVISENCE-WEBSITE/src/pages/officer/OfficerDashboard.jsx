import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import StatsCard from '../../components/StatsCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';
import ReportCard from '../../components/ReportCard';
import Modal from '../../components/Modal';
import {
    getComplaints,
    getComplaintById,
    updateComplaintStatus,
    reportComplaintUser
} from '../../api/complaints';
import {
    formatDateTime,
    getErrorMessage,
    sortComplaintsByPriorityAndDate
} from '../../utils/helpers';
import { isDemoSession } from '../../utils/authStorage';
import { DEMO_COMPLAINTS } from '../../constants/demoData';
import '../citizen/CitizenDashboard.css';
import './OfficerDashboard.css';
import {
    HiOutlineDocumentText,
    HiOutlineCheckCircle,
    HiOutlineClock,
    HiOutlineExclamationTriangle,
    HiOutlineBellAlert
} from 'react-icons/hi2';

const UPDATABLE_STATUSES = new Set(['reported', 'unassigned', 'assigned', 'in_progress']);
const DEFAULT_RESOLUTION_REMARK = 'Issue resolved by municipal office.';
const REFRESH_INTERVAL_MS = 20000;

const toStatusText = (status) =>
    (status || 'reported').replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());

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

const toPriorityClass = (priorityLevel) => {
    const normalized = String(priorityLevel || 'low').toLowerCase();
    if (['critical', 'high', 'medium', 'low'].includes(normalized)) return normalized;
    return 'low';
};

export default function OfficerDashboard() {
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [updating, setUpdating] = useState('');
    const [reviewOpen, setReviewOpen] = useState(false);
    const [selectedComplaint, setSelectedComplaint] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [reviewError, setReviewError] = useState('');
    const [reportingMisuse, setReportingMisuse] = useState(false);
    const [misuseMessage, setMisuseMessage] = useState('');
    const [actionModalType, setActionModalType] = useState('');
    const [actionModalInput, setActionModalInput] = useState('');
    const [imagePreviewUrl, setImagePreviewUrl] = useState('');
    const [imagePreviewTitle, setImagePreviewTitle] = useState('');

    const loadComplaints = useCallback(async ({ silent = false } = {}) => {
        if (!silent) {
            setLoading(true);
        }
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
            if (!silent) {
                setLoading(false);
            }
        }
    }, [statusFilter]);

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

    const loadComplaintDetails = async (complaint) => {
        setLoadingDetails(true);
        setReviewError('');
        setMisuseMessage('');
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
        setReviewError('');
        setMisuseMessage('');
        setActionModalType('');
        setActionModalInput('');
        setImagePreviewUrl('');
        setImagePreviewTitle('');
    };

    const openImagePreview = (imageUrl, title = 'Complaint Image') => {
        if (!imageUrl) return;
        setImagePreviewUrl(imageUrl);
        setImagePreviewTitle(title);
    };

    const closeImagePreview = () => {
        setImagePreviewUrl('');
        setImagePreviewTitle('');
    };

    const updateComplaintInState = (updatedComplaint) => {
        setComplaints((prev) => {
            const next = prev.map((item) => (item._id === updatedComplaint._id ? updatedComplaint : item));
            if (!statusFilter) return next;
            return next.filter((item) => item.status === statusFilter);
        });
        setSelectedComplaint(updatedComplaint);
    };

    const saveStatus = async (nextStatus, payload = {}) => {
        if (!selectedComplaint || updating) return;
        if (!UPDATABLE_STATUSES.has(selectedComplaint.status) && selectedComplaint.status !== nextStatus) {
            setReviewError('This complaint is already in a terminal status.');
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
            setUpdating('');
        }
    };

    const handleMarkInProgress = async () => {
        if (!selectedComplaint) return;
        const confirmed = window.confirm('Move this complaint to In Progress?');
        if (!confirmed) return;
        await saveStatus('in_progress');
    };

    const handleResolve = async () => {
        if (!selectedComplaint) return;
        const confirmed = window.confirm('Mark this complaint as resolved?');
        if (!confirmed) return;
        const remark = selectedComplaint.resolutionRemark || DEFAULT_RESOLUTION_REMARK;
        await saveStatus('resolved', { remark });
    };

    const openActionModal = (type) => {
        setReviewError('');
        setActionModalInput('');
        setActionModalType(type);
    };

    const closeActionModal = () => {
        if (updating || reportingMisuse) return;
        setActionModalType('');
        setActionModalInput('');
    };

    const handleReject = async (inputReason) => {
        const reason = String(inputReason || '').trim();
        if (!reason) {
            setReviewError('Rejection reason is required.');
            return false;
        }
        await saveStatus('rejected', { rejectionReason: reason });
        return true;
    };

    const handleReportMisuse = async (inputReason) => {
        if (!selectedComplaint || reportingMisuse) return;

        const reason = String(inputReason || '').trim();
        if (!reason) {
            setReviewError('Please enter a reason to report the user.');
            return false;
        }

        setReviewError('');
        setMisuseMessage('');
        setReportingMisuse(true);
        try {
            if (isDemoSession()) {
                setMisuseMessage('Demo: user misuse report submitted.');
                return true;
            }

            const { data } = await reportComplaintUser(selectedComplaint._id, { reason });
            const result = data?.data || {};

            setSelectedComplaint((prev) =>
                prev
                    ? {
                        ...prev,
                        reportedBy: {
                            ...(prev.reportedBy || {}),
                            misuseReportCount: result.reportCount || 0,
                            isBlacklisted: Boolean(result.blacklistTriggered)
                        }
                    }
                    : prev
            );

            if (result.blacklistTriggered) {
                setMisuseMessage(
                    `User blacklisted after ${result.reportCount}/${result.threshold} misuse reports.`
                );
            } else {
                setMisuseMessage(
                    `User reported successfully (${result.reportCount}/${result.threshold}).`
                );
            }
            return true;
        } catch (err) {
            setReviewError(getErrorMessage(err));
            return false;
        } finally {
            setReportingMisuse(false);
        }
    };

    const handleActionModalSubmit = async () => {
        if (actionModalType === 'reject') {
            const ok = await handleReject(actionModalInput);
            if (ok) closeActionModal();
            return;
        }

        if (actionModalType === 'misuse') {
            const ok = await handleReportMisuse(actionModalInput);
            if (ok) closeActionModal();
        }
    };

    const total = complaints.length;
    const assigned = complaints.filter((c) => c.status === 'assigned').length;
    const inProgress = complaints.filter((c) => c.status === 'in_progress').length;
    const resolved = complaints.filter((c) => c.status === 'resolved').length;
    const sortedComplaints = useMemo(
        () => sortComplaintsByPriorityAndDate(complaints),
        [complaints]
    );
    const statusLocked = selectedComplaint && !UPDATABLE_STATUSES.has(selectedComplaint.status);
    const aiOutputImageUrl =
        selectedComplaint?.aiMeta?.aiOutputImageUrl ||
        selectedComplaint?.aiMeta?.aiGeneratedOutputPath ||
        '';
    const aiModelNote = selectedComplaint?.aiMeta?.modelNote || '';

    return (
        <DashboardLayout>
            <div className="page-header">
                <div>
                    <h1>Officer Dashboard</h1>
                    <p>Manage and resolve complaints assigned to your department</p>
                </div>
            </div>

            <div className="stats-grid">
                <StatsCard icon={<HiOutlineDocumentText />} label="Total" value={total} color="primary" />
                <StatsCard icon={<HiOutlineClock />} label="Assigned" value={assigned} color="warning" />
                <StatsCard icon={<HiOutlineExclamationTriangle />} label="In Progress" value={inProgress} color="info" />
                <StatsCard icon={<HiOutlineCheckCircle />} label="Resolved" value={resolved} color="success" />
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
                <EmptyState title="No complaints" message="No complaints match your current filter" />
            ) : (
                <div className="reports-grid">
                    {sortedComplaints.map((c) => (
                        <ReportCard
                            key={c._id}
                            complaint={c}
                            detailPath={`/officer/complaint/${c._id}`}
                            showReporter
                            showReviewButton
                            onReview={openReviewModal}
                            isUpdating={Boolean(updating && selectedComplaint?._id === c._id)}
                        />
                    ))}
                </div>
            )}

            <Modal
                isOpen={reviewOpen}
                onClose={closeReviewModal}
                title="Sub Office Review"
                size="xl"
                className="modal--compact modal--review"
            >
                {loadingDetails ? (
                    <LoadingSpinner />
                ) : selectedComplaint ? (
                    <div className="officer-review officer-review--single card">
                        {reviewError && <div className="auth-error">{reviewError}</div>}

                        <div className="officer-review__layout">
                            <div className="officer-review__media card">
                                <div className="officer-review__media-head">
                                    <span className="officer-review__media-tag">Evidence Image</span>
                                    <span className="officer-review__case-id">
                                        #{String(selectedComplaint._id || '').slice(-6).toUpperCase() || 'NA'}
                                    </span>
                                </div>
                                {selectedComplaint.images?.[0]?.url ? (
                                    <div className="officer-review__image-frame">
                                        <img
                                            src={selectedComplaint.images[0].url}
                                            alt={selectedComplaint.title}
                                            className="officer-review__image"
                                        />
                                    </div>
                                ) : (
                                    <div className="officer-review__image-empty">No image</div>
                                )}
                                <div className="officer-review__media-actions">
                                    {selectedComplaint.images?.[0]?.url ? (
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm officer-review__image-link"
                                            onClick={() => openImagePreview(selectedComplaint.images[0].url, 'Complaint Image')}
                                        >
                                            View Image
                                        </button>
                                    ) : (
                                        <span className="officer-review__media-note">Waiting for image evidence upload.</span>
                                    )}
                                    {aiOutputImageUrl ? (
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm officer-review__image-link officer-review__image-link--ai"
                                            onClick={() => openImagePreview(aiOutputImageUrl, 'AI Output Image')}
                                        >
                                            View AI Output
                                        </button>
                                    ) : null}
                                    {aiModelNote ? <p className="officer-review__ai-note">{aiModelNote}</p> : null}
                                </div>
                            </div>

                            <div className="officer-review__content">
                                <div className="officer-review__title-row">
                                    <div>
                                        <p className="officer-review__eyebrow">Officer Case Review</p>
                                        <h3>{selectedComplaint.title}</h3>
                                    </div>
                                    <div className="officer-review__title-tags">
                                        <StatusBadge status={selectedComplaint.status} />
                                        <span
                                            className={`officer-review__priority-pill officer-review__priority-pill--${toPriorityClass(
                                                selectedComplaint.priority?.level
                                            )}`}
                                        >
                                            Priority {toStatusText(selectedComplaint.priority?.level || 'low')}
                                        </span>
                                    </div>
                                </div>

                                <div className="officer-review__description-card">
                                    <h4>Issue Summary</h4>
                                    <p className="officer-review__description">{selectedComplaint.description}</p>
                                </div>

                                <div className="officer-review__meta officer-review__meta--two-col">
                                    <div className="officer-review__meta-card">
                                        <span className="officer-review__meta-label">Category</span>
                                        <p className="officer-review__meta-value">{selectedComplaint.category || '-'}</p>
                                    </div>
                                    <div className="officer-review__meta-card">
                                        <span className="officer-review__meta-label">Assigned Office</span>
                                        <p className="officer-review__meta-value">{selectedComplaint.assignedMunicipalOffice?.name || 'Pending assignment'}</p>
                                    </div>
                                    <div className="officer-review__meta-card">
                                        <span className="officer-review__meta-label">Location</span>
                                        <p className="officer-review__meta-value">{toCoordinatesLabel(selectedComplaint)}</p>
                                    </div>
                                    <div className="officer-review__meta-card officer-review__meta-card--reason">
                                        <span className="officer-review__meta-label">Priority Reason</span>
                                        <p className="officer-review__meta-value">{getPriorityReason(selectedComplaint)}</p>
                                    </div>
                                    <div className="officer-review__meta-card">
                                        <span className="officer-review__meta-label">Created</span>
                                        <p className="officer-review__meta-value">{formatDateTime(selectedComplaint.createdAt)}</p>
                                    </div>
                                    <div className="officer-review__meta-card">
                                        <span className="officer-review__meta-label">Updated</span>
                                        <p className="officer-review__meta-value">{formatDateTime(selectedComplaint.updatedAt)}</p>
                                    </div>
                                    <div className="officer-review__meta-card">
                                        <span className="officer-review__meta-label">Reported By</span>
                                        <p className="officer-review__meta-value">{selectedComplaint.reportedBy?.name || '-'}</p>
                                    </div>
                                    <div className="officer-review__meta-card">
                                        <span className="officer-review__meta-label">Email</span>
                                        <p className="officer-review__meta-value">{selectedComplaint.reportedBy?.email || '-'}</p>
                                    </div>
                                    <div className="officer-review__meta-card">
                                        <span className="officer-review__meta-label">User Reports</span>
                                        <p className="officer-review__meta-value">{selectedComplaint.reportedBy?.misuseReportCount || 0}</p>
                                    </div>
                                </div>

                                {(selectedComplaint.resolutionRemark || selectedComplaint.rejectionReason) && (
                                    <div className="officer-review__section">
                                        <h4>Latest Decision</h4>
                                        {selectedComplaint.resolutionRemark && (
                                            <p className="officer-review__note officer-review__note--ok">
                                                Resolution Remark: {selectedComplaint.resolutionRemark}
                                            </p>
                                        )}
                                        {selectedComplaint.rejectionReason && (
                                            <p className="officer-review__note officer-review__note--warn">
                                                Rejection Reason: {selectedComplaint.rejectionReason}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {Array.isArray(selectedComplaint.statusHistory) && selectedComplaint.statusHistory.length > 0 && (
                                    <div className="officer-review__section">
                                        <h4>Status Trail</h4>
                                        <div className="officer-review__timeline">
                                            {selectedComplaint.statusHistory.slice(-1).reverse().map((entry, index) => (
                                                <div className="officer-review__timeline-item" key={`${entry.updatedAt}-${entry.status}-${index}`}>
                                                    <strong>{toStatusText(entry.status)}</strong>
                                                    <span>{formatDateTime(entry.updatedAt)}</span>
                                                    {entry.remark && <p>Remark: {entry.remark}</p>}
                                                    {entry.rejectionReason && <p>Rejection: {entry.rejectionReason}</p>}
                                                </div>
                                            ))}
                                        </div>
                                        {selectedComplaint.statusHistory.length > 1 ? (
                                            <p className="officer-review__hint">
                                                Showing latest update. {selectedComplaint.statusHistory.length - 1} older update(s) hidden.
                                            </p>
                                        ) : null}
                                    </div>
                                )}
                            </div>

                            <div className="officer-review__panel">
                                <div className="officer-review__actions">
                                    <div className="officer-review__actions-head">
                                        <h4>Resolution Actions</h4>
                                        <p>Apply the next workflow step for this complaint.</p>
                                    </div>
                                    {statusLocked ? (
                                        <p className="officer-review__locked">
                                            This complaint is already terminal ({toStatusText(selectedComplaint.status)}).
                                        </p>
                                    ) : (
                                        <>
                                            <div className="officer-review__action-row">
                                                <button
                                                    type="button"
                                                    className="officer-review__action-btn officer-review__action-btn--progress"
                                                    disabled={Boolean(updating)}
                                                    onClick={() => void handleMarkInProgress()}
                                                >
                                                    <span className="officer-review__action-icon"><HiOutlineClock /></span>
                                                    <span className="officer-review__action-copy">
                                                        <strong>{updating === 'in_progress' ? 'Saving...' : 'Mark In Progress'}</strong>
                                                        <small>Move complaint into active execution queue</small>
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="officer-review__action-btn officer-review__action-btn--resolve"
                                                    disabled={Boolean(updating)}
                                                    onClick={() => void handleResolve()}
                                                >
                                                    <span className="officer-review__action-icon"><HiOutlineCheckCircle /></span>
                                                    <span className="officer-review__action-copy">
                                                        <strong>{updating === 'resolved' ? 'Saving...' : 'Mark Resolved'}</strong>
                                                        <small>Close complaint after field confirmation</small>
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="officer-review__action-btn officer-review__action-btn--reject"
                                                    disabled={Boolean(updating) || reportingMisuse}
                                                    onClick={() => openActionModal('reject')}
                                                >
                                                    <span className="officer-review__action-icon"><HiOutlineExclamationTriangle /></span>
                                                    <span className="officer-review__action-copy">
                                                        <strong>Reject</strong>
                                                        <small>Record a clear rejection reason</small>
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="officer-review__action-btn officer-review__action-btn--misuse"
                                                    disabled={Boolean(updating) || reportingMisuse}
                                                    onClick={() => openActionModal('misuse')}
                                                >
                                                    <span className="officer-review__action-icon"><HiOutlineBellAlert /></span>
                                                    <span className="officer-review__action-copy">
                                                        <strong>{reportingMisuse ? 'Reporting...' : 'Report User'}</strong>
                                                        <small>Flag misuse attempt for moderation review</small>
                                                    </span>
                                                </button>
                                            </div>
                                            {misuseMessage ? (
                                                <p className="officer-review__success">{misuseMessage}</p>
                                            ) : null}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <EmptyState title="No complaint selected" message="Choose a complaint to review." />
                )}
            </Modal>

            <Modal
                isOpen={Boolean(actionModalType)}
                onClose={closeActionModal}
                title={actionModalType === 'reject' ? 'Reject Complaint' : 'Report User'}
                size="sm"
            >
                <div className="officer-review__popup">
                    <label htmlFor="officer-action-input">
                        {actionModalType === 'reject'
                            ? 'Enter rejection reason'
                            : 'Enter misuse report reason'}
                    </label>
                    <textarea
                        id="officer-action-input"
                        className="input"
                        rows={4}
                        value={actionModalInput}
                        onChange={(e) => setActionModalInput(e.target.value)}
                        placeholder={
                            actionModalType === 'reject'
                                ? 'Write why this complaint is rejected...'
                                : 'Write why this user should be reported...'
                        }
                        disabled={Boolean(updating) || reportingMisuse}
                    />
                    <div className="officer-review__popup-actions">
                        <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={closeActionModal}
                            disabled={Boolean(updating) || reportingMisuse}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => void handleActionModalSubmit()}
                            disabled={Boolean(updating) || reportingMisuse}
                        >
                            {updating || reportingMisuse ? 'Submitting...' : 'Submit'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={Boolean(imagePreviewUrl)}
                onClose={closeImagePreview}
                title={imagePreviewTitle || 'Complaint Image'}
                size="lg"
                className="modal--image-preview"
                bodyClassName="image-preview-modal__body"
            >
                {imagePreviewUrl ? (
                    <img
                        src={imagePreviewUrl}
                        alt={selectedComplaint?.title || 'Complaint image'}
                        className="image-preview-modal__image"
                    />
                ) : null}
            </Modal>
        </DashboardLayout>
    );
}
