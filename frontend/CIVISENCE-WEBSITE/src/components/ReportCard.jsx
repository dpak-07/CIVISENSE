import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { formatDate } from '../utils/helpers';
import './ReportCard.css';

function getImagePath(complaint) {
    return complaint?.images?.[0]?.url || '';
}

function compactPath(url) {
    if (!url) return 'No image uploaded';
    try {
        const parsed = new URL(url);
        return `${parsed.host}${parsed.pathname}`;
    } catch {
        return url;
    }
}

export default function ReportCard({
    complaint,
    detailPath,
    showReporter = false,
    showStatusControl = false,
    showReviewButton = false,
    onStatusChange,
    isUpdating = false,
    onDelete,
    onReview
}) {
    const imageUrl = getImagePath(complaint);
    const priorityLevel = complaint?.priority?.level || 'low';

    return (
        <article className="report-card card ring-1 ring-indigo-300/20 hover:-translate-y-1 transition-all duration-300">
            <div className="report-card__media-wrap">
                {imageUrl ? (
                    <img src={imageUrl} alt={complaint.title} className="report-card__media" />
                ) : (
                    <div className="report-card__media report-card__media--placeholder bg-gradient-to-br from-indigo-500/10 to-cyan-500/10">
                        No Image
                    </div>
                )}
                <span className={`priority-tag priority-tag--${priorityLevel} report-card__priority`}>
                    {priorityLevel}
                </span>
            </div>

            <div className="report-card__body">
                <div className="report-card__head">
                    <Link to={detailPath} className="complaint-link">{complaint.title}</Link>
                    <StatusBadge status={complaint.status} />
                </div>

                <div className="report-card__meta">
                    <span className="category-tag">{complaint.category}</span>
                    <span className="text-muted">{formatDate(complaint.createdAt)}</span>
                    {showReporter && <span className="text-muted">By {complaint.reportedBy?.name || '-'}</span>}
                </div>

                {complaint.resolutionRemark && (
                    <p className="report-card__note report-card__note--ok">
                        Resolution Remark: {complaint.resolutionRemark}
                    </p>
                )}
                {complaint.rejectionReason && (
                    <p className="report-card__note report-card__note--warn">
                        Rejection Reason: {complaint.rejectionReason}
                    </p>
                )}

                <div className="report-card__path">
                    <span className="text-muted">Image Path:</span>
                    {imageUrl ? (
                        <a href={imageUrl} target="_blank" rel="noreferrer" className="report-card__path-link">
                            {compactPath(imageUrl)}
                        </a>
                    ) : (
                        <span className="text-muted">{compactPath(imageUrl)}</span>
                    )}
                </div>

                {(showStatusControl || showReviewButton || onDelete) && (
                    <div className="report-card__actions">
                        {showStatusControl && (
                            <select
                                className="input status-select"
                                value={complaint.status}
                                onChange={(e) => onStatusChange?.(complaint._id, e.target.value)}
                                disabled={isUpdating}
                            >
                                <option value="reported">Reported</option>
                                <option value="assigned">Assigned</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        )}
                        {showReviewButton && (
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm report-card__review-btn"
                                onClick={() => onReview?.(complaint)}
                            >
                                Review &amp; Update
                            </button>
                        )}
                        {onDelete && (
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(complaint._id)}>
                                Delete
                            </button>
                        )}
                    </div>
                )}
            </div>
        </article>
    );
}
