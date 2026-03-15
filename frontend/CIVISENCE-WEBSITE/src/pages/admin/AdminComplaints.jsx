import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';
import ReportCard from '../../components/ReportCard';
import Modal from '../../components/Modal';
import {
    HiOutlineBellAlert,
    HiOutlineCheckCircle,
    HiOutlineClock,
    HiOutlineExclamationTriangle
} from 'react-icons/hi2';
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
import './AdminComplaints.css';

const UPDATABLE_STATUSES = new Set(['reported', 'unassigned', 'assigned', 'in_progress']);
const DEFAULT_RESOLUTION_REMARK = 'Issue resolved by administration.';
const REFRESH_INTERVAL_MS = 20000;

const toCoordinates = (complaint) => {
    const coordinates = complaint?.location?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
        return null;
    }
    const [longitude, latitude] = coordinates;
    if (typeof longitude !== 'number' || typeof latitude !== 'number') {
        return null;
    }
    return { longitude, latitude };
};

const toStatusText = (status) =>
    (status || 'reported').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const toCoordinatesLabel = (complaint) => {
    const coordinates = toCoordinates(complaint);
    if (!coordinates) {
        return 'Location not available';
    }
    return `${Number(coordinates.latitude).toFixed(5)}, ${Number(coordinates.longitude).toFixed(5)}`;
};

const getPriorityReason = (complaint) =>
    complaint?.priority?.reasonSentence ||
    complaint?.priority?.reason ||
    'Priority reason not available';

const toMapsUrl = (complaint) => {
    const coordinates = toCoordinates(complaint);
    if (!coordinates) {
        return '';
    }
    return `https://www.google.com/maps?q=${coordinates.latitude},${coordinates.longitude}`;
};

const toPriorityClass = (priorityLevel) => {
    const normalized = String(priorityLevel || 'low').toLowerCase();
    if (['critical', 'high', 'medium', 'low'].includes(normalized)) return normalized;
    return 'low';
};

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
    const [reviewError, setReviewError] = useState('');
    const [reportingMisuse, setReportingMisuse] = useState(false);
    const [misuseMessage, setMisuseMessage] = useState('');
    const [actionModalType, setActionModalType] = useState('');
    const [actionModalInput, setActionModalInput] = useState('');
    const [imagePreviewUrl, setImagePreviewUrl] = useState('');
    const [imagePreviewTitle, setImagePreviewTitle] = useState('');
    const [mapMessage, setMapMessage] = useState('');

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
        setMapMessage('');
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
        setMapMessage('');
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

    const handleCopyMapLink = async () => {
        if (!selectedComplaint) return;
        const mapUrl = toMapsUrl(selectedComplaint);
        if (!mapUrl) {
            setMapMessage('Map link unavailable for this complaint.');
            return;
        }

        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(mapUrl);
                setMapMessage('Map link copied to clipboard.');
                return;
            }

            const textarea = document.createElement('textarea');
            textarea.value = mapUrl;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const copied = document.execCommand('copy');
            document.body.removeChild(textarea);
            setMapMessage(copied ? 'Map link copied to clipboard.' : 'Copy failed.');
        } catch {
            setMapMessage('Copy failed.');
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
        const trimmedReason = String(inputReason || '').trim();
        if (!trimmedReason) {
            setReviewError('Rejection reason is required.');
            return false;
        }
        await saveStatus('rejected', { rejectionReason: trimmedReason });
        return true;
    };

    const handleMarkInProgress = async () => {
        if (!selectedComplaint) return;
        const confirmed = window.confirm('Move this complaint to In Progress?');
        if (!confirmed) return;
        await saveStatus('in_progress');
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
    const mapUrl = selectedComplaint ? toMapsUrl(selectedComplaint) : '';

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
                            isUpdating={Boolean(updating && selectedComplaint?._id === c._id)}
                        />
                    ))}
                </div>
            )}

            <Modal
                isOpen={reviewOpen}
                onClose={closeReviewModal}
                title="Complaint Review"
                size="xl"
                className="modal--compact modal--review"
            >
                {loadingDetails ? (
                    <LoadingSpinner />
                ) : selectedComplaint ? (
                    <div className="admin-review admin-review--single card">
                        {reviewError && <div className="auth-error">{reviewError}</div>}

                        <div className="admin-review__layout">
                            <div className="admin-review__media card">
                                <div className="admin-review__media-head">
                                    <span className="admin-review__media-tag">Complaint Evidence</span>
                                    <span className="admin-review__case-id">
                                        #{String(selectedComplaint._id || '').slice(-6).toUpperCase() || 'NA'}
                                    </span>
                                </div>
                                {selectedComplaint.images?.[0]?.url ? (
                                    <div className="admin-review__image-frame">
                                        <img
                                            src={selectedComplaint.images[0].url}
                                            alt={selectedComplaint.title}
                                            className="admin-review__image"
                                        />
                                    </div>
                                ) : (
                                    <div className="admin-review__image-empty">No image</div>
                                )}
                                <div className="admin-review__media-actions">
                                    {selectedComplaint.images?.[0]?.url ? (
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm admin-review__image-link"
                                            onClick={() => openImagePreview(selectedComplaint.images[0].url, 'Complaint Image')}
                                        >
                                            View Image
                                        </button>
                                    ) : (
                                        <span className="admin-review__media-note">No evidence image attached yet.</span>
                                    )}
                                    {aiOutputImageUrl ? (
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm admin-review__image-link admin-review__image-link--ai"
                                            onClick={() => openImagePreview(aiOutputImageUrl, 'AI Output Image')}
                                        >
                                            View AI Output
                                        </button>
                                    ) : null}
                                    {aiModelNote ? <p className="admin-review__ai-note">{aiModelNote}</p> : null}
                                </div>
                            </div>

                            <div className="admin-review__content">
                                <div className="admin-review__title-row">
                                    <div>
                                        <p className="admin-review__eyebrow">Administrative Review</p>
                                        <h3>{selectedComplaint.title}</h3>
                                    </div>
                                    <div className="admin-review__title-tags">
                                        <StatusBadge status={selectedComplaint.status} />
                                        <span
                                            className={`admin-review__priority-pill admin-review__priority-pill--${toPriorityClass(
                                                selectedComplaint.priority?.level
                                            )}`}
                                        >
                                            Priority {toStatusText(selectedComplaint.priority?.level || 'low')}
                                        </span>
                                    </div>
                                </div>

                                <div className="admin-review__description-card">
                                    <h4>Issue Summary</h4>
                                    <p className="admin-review__description">{selectedComplaint.description}</p>
                                </div>

                                <div className="admin-review__meta admin-review__meta--two-col">
                                    <div className="admin-review__meta-card">
                                        <span className="admin-review__meta-label">Category</span>
                                        <p className="admin-review__meta-value">{selectedComplaint.category || '-'}</p>
                                    </div>
                                    <div className="admin-review__meta-card">
                                        <span className="admin-review__meta-label">Assigned Office</span>
                                        <p className="admin-review__meta-value">{selectedComplaint.assignedMunicipalOffice?.name || selectedComplaint.assignedOfficeType || 'Pending'}</p>
                                    </div>
                                    <div className="admin-review__meta-card admin-review__meta-card--location">
                                        <span className="admin-review__meta-label">Location</span>
                                        <p className="admin-review__meta-value">{toCoordinatesLabel(selectedComplaint)}</p>
                                        <div className="admin-review__map-actions">
                                            <a
                                                className={`btn btn-ghost btn-sm admin-review__map-btn${mapUrl ? '' : ' is-disabled'}`}
                                                href={mapUrl || '#'}
                                                target="_blank"
                                                rel="noreferrer"
                                                onClick={(event) => {
                                                    if (!mapUrl) {
                                                        event.preventDefault();
                                                    }
                                                }}
                                                aria-disabled={!mapUrl}
                                                tabIndex={mapUrl ? 0 : -1}
                                            >
                                                Open in Maps
                                            </a>
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-sm admin-review__map-btn"
                                                onClick={handleCopyMapLink}
                                                disabled={!mapUrl}
                                            >
                                                Copy Map Link
                                            </button>
                                        </div>
                                        {mapMessage ? (
                                            <p className="admin-review__map-message">{mapMessage}</p>
                                        ) : null}
                                    </div>
                                    <div className="admin-review__meta-card admin-review__meta-card--reason">
                                        <span className="admin-review__meta-label">Priority Reason</span>
                                        <p className="admin-review__meta-value">{getPriorityReason(selectedComplaint)}</p>
                                    </div>
                                    <div className="admin-review__meta-card">
                                        <span className="admin-review__meta-label">Created</span>
                                        <p className="admin-review__meta-value">{formatDateTime(selectedComplaint.createdAt)}</p>
                                    </div>
                                    <div className="admin-review__meta-card">
                                        <span className="admin-review__meta-label">Updated</span>
                                        <p className="admin-review__meta-value">{formatDateTime(selectedComplaint.updatedAt)}</p>
                                    </div>
                                    <div className="admin-review__meta-card">
                                        <span className="admin-review__meta-label">Reported By</span>
                                        <p className="admin-review__meta-value">{selectedComplaint.reportedBy?.name || '-'}</p>
                                    </div>
                                    <div className="admin-review__meta-card">
                                        <span className="admin-review__meta-label">Email</span>
                                        <p className="admin-review__meta-value">{selectedComplaint.reportedBy?.email || '-'}</p>
                                    </div>
                                    <div className="admin-review__meta-card">
                                        <span className="admin-review__meta-label">User Reports</span>
                                        <p className="admin-review__meta-value">{selectedComplaint.reportedBy?.misuseReportCount || 0}</p>
                                    </div>
                                </div>

                                {(selectedComplaint.resolutionRemark || selectedComplaint.rejectionReason) && (
                                    <div className="admin-review__section">
                                        <h4>Latest Decision</h4>
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
                                    <div className="admin-review__section">
                                        <h4>Status Trail</h4>
                                        <div className="admin-review__timeline">
                                            {selectedComplaint.statusHistory.slice(-1).reverse().map((entry, index) => (
                                                <div className="admin-review__timeline-item" key={`${entry.updatedAt}-${entry.status}-${index}`}>
                                                    <strong>{toStatusText(entry.status)}</strong>
                                                    <span>{formatDateTime(entry.updatedAt)}</span>
                                                    <p>Updated By: {toUpdatedByLabel(entry)}</p>
                                                    {entry.remark && <p>Remark: {entry.remark}</p>}
                                                    {entry.rejectionReason && <p>Rejection: {entry.rejectionReason}</p>}
                                                </div>
                                            ))}
                                        </div>
                                        {selectedComplaint.statusHistory.length > 1 ? (
                                            <p className="admin-review__hint">
                                                Showing latest update. {selectedComplaint.statusHistory.length - 1} older update(s) hidden.
                                            </p>
                                        ) : null}
                                    </div>
                                )}
                            </div>

                            <div className="admin-review__panel">
                                <div className="admin-review__actions">
                                    <div className="admin-review__actions-head">
                                        <h4>Command Actions</h4>
                                        <p>Apply municipal workflow action with audit trace.</p>
                                    </div>
                                    {statusLocked ? (
                                        <p className="admin-review__locked">
                                            This complaint is already terminal ({toStatusText(selectedComplaint.status)}).
                                        </p>
                                    ) : (
                                        <>
                                            <div className="admin-review__action-row">
                                                <button
                                                    type="button"
                                                    className="admin-review__action-btn admin-review__action-btn--progress"
                                                    disabled={Boolean(updating)}
                                                    onClick={() => void handleMarkInProgress()}
                                                >
                                                    <span className="admin-review__action-icon"><HiOutlineClock /></span>
                                                    <span className="admin-review__action-copy">
                                                        <strong>{updating === 'in_progress' ? 'Saving...' : 'Mark In Progress'}</strong>
                                                        <small>Move case into active departmental queue</small>
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="admin-review__action-btn admin-review__action-btn--resolve"
                                                    disabled={Boolean(updating)}
                                                    onClick={() => void handleResolve()}
                                                >
                                                    <span className="admin-review__action-icon"><HiOutlineCheckCircle /></span>
                                                    <span className="admin-review__action-copy">
                                                        <strong>{updating === 'resolved' ? 'Saving...' : 'Mark Resolved'}</strong>
                                                        <small>Complete case and finalize closure note</small>
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="admin-review__action-btn admin-review__action-btn--reject"
                                                    disabled={Boolean(updating) || reportingMisuse}
                                                    onClick={() => openActionModal('reject')}
                                                >
                                                    <span className="admin-review__action-icon"><HiOutlineExclamationTriangle /></span>
                                                    <span className="admin-review__action-copy">
                                                        <strong>Reject Complaint</strong>
                                                        <small>Send back with documented rejection reason</small>
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="admin-review__action-btn admin-review__action-btn--misuse"
                                                    disabled={Boolean(updating) || reportingMisuse}
                                                    onClick={() => openActionModal('misuse')}
                                                >
                                                    <span className="admin-review__action-icon"><HiOutlineBellAlert /></span>
                                                    <span className="admin-review__action-copy">
                                                        <strong>{reportingMisuse ? 'Reporting...' : 'Report User'}</strong>
                                                        <small>Escalate user misuse for blacklist workflow</small>
                                                    </span>
                                                </button>
                                            </div>
                                            {misuseMessage ? (
                                                <p className="admin-review__success">{misuseMessage}</p>
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
                <div className="admin-review__popup">
                    <label htmlFor="admin-action-input">
                        {actionModalType === 'reject'
                            ? 'Enter rejection reason'
                            : 'Enter misuse report reason'}
                    </label>
                    <textarea
                        id="admin-action-input"
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
                    <div className="admin-review__popup-actions">
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
