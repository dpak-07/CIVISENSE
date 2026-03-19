import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineArrowTopRightOnSquare, HiOutlinePhoto, HiOutlineSparkles } from 'react-icons/hi2';
import StatusBadge from './StatusBadge';
import Modal from './Modal';
import { formatDate, formatDateTime } from '../utils/helpers';

function getImagePath(complaint) {
    return complaint?.images?.[0]?.url || '';
}

function getLocationLabel(complaint) {
    const coordinates = complaint?.location?.coordinates;
    if (Array.isArray(coordinates) && coordinates.length === 2) {
        const [longitude, latitude] = coordinates;
        return `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
    }

    return 'Location not available';
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
    const aiDetectedImageUrl =
        complaint?.aiMeta?.aiOutputImageUrl || complaint?.aiMeta?.aiGeneratedOutputPath || '';
    const priorityLevel = complaint?.priority?.level || 'low';
    const [previewImageUrl, setPreviewImageUrl] = useState('');
    const [previewImageTitle, setPreviewImageTitle] = useState('');
    const complaintCode = String(complaint?._id || '').slice(-6).toUpperCase() || 'N/A';
    const assignedOffice = complaint?.assignedMunicipalOffice?.name || 'Not assigned yet';
    const updatedAt = complaint?.updatedAt || complaint?.createdAt;
    const priorityReason = complaint?.priority?.reasonSentence || complaint?.priority?.reason || 'No priority note available';

    const openImagePreview = (url, title) => {
        if (!url) return;
        setPreviewImageUrl(url);
        setPreviewImageTitle(title || 'Image Preview');
    };

    const closeImagePreview = () => {
        setPreviewImageUrl('');
        setPreviewImageTitle('');
    };

    const priorityTone = {
        critical: 'priority-tag--critical',
        high: 'priority-tag--high',
        medium: 'priority-tag--medium',
        low: 'priority-tag--low'
    }[priorityLevel] || 'priority-tag--low';

    return (
        <>
            <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.55)] transition duration-200 hover:-translate-y-1 hover:border-sky-200">
                <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                    {imageUrl ? (
                        <img src={imageUrl} alt={complaint.title} className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_28%),linear-gradient(135deg,#f8fafc,#e2e8f0)] text-slate-500">
                            <div className="flex flex-col items-center gap-2">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl text-sky-600 shadow-sm">
                                    <HiOutlinePhoto />
                                </div>
                                <span className="text-sm font-semibold">No image attached</span>
                            </div>
                        </div>
                    )}
                    <span className={`priority-tag absolute left-4 top-4 ${priorityTone}`}>
                        {priorityLevel}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 to-transparent px-5 pb-4 pt-10">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Complaint</p>
                        <h3 className="mt-1 text-xl font-bold text-white">{complaint.title}</h3>
                    </div>
                </div>

                <div className="space-y-5 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="category-tag">{complaint.category || 'Uncategorized'}</span>
                                <span className="text-sm text-slate-500">{formatDate(complaint.createdAt)}</span>
                            </div>
                            {showReporter ? (
                                <p className="text-sm text-slate-500">
                                    Reported by{' '}
                                    <span className="font-semibold text-slate-700">{complaint.reportedBy?.name || 'Unknown user'}</span>
                                </p>
                            ) : null}
                        </div>
                        <StatusBadge status={complaint.status} />
                    </div>

                    <p className="text-sm leading-6 text-slate-600">
                        {complaint.description
                            ? complaint.description.length > 180
                                ? `${complaint.description.slice(0, 180)}...`
                                : complaint.description
                            : 'No description provided for this complaint yet.'}
                    </p>

                    <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 sm:grid-cols-2">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Complaint No.</p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">#{complaintCode}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Last updated</p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">{formatDateTime(updatedAt)}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Assigned office</p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">{assignedOffice}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Location</p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">{getLocationLabel(complaint)}</p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm text-sky-900">
                        <strong className="block font-semibold">Priority note</strong>
                        <span>{priorityReason}</span>
                    </div>

                    {complaint.resolutionRemark ? (
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
                            <strong className="block font-semibold">Resolution note</strong>
                            <span>{complaint.resolutionRemark}</span>
                        </div>
                    ) : null}
                    {complaint.rejectionReason ? (
                        <div className="rounded-2xl border border-rose-100 bg-rose-50/80 px-4 py-3 text-sm text-rose-800">
                            <strong className="block font-semibold">Rejection reason</strong>
                            <span>{complaint.rejectionReason}</span>
                        </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Evidence</span>
                        <div className="flex flex-wrap items-center gap-2">
                            {imageUrl ? (
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => openImagePreview(imageUrl, 'Complaint Image')}
                                >
                                    <HiOutlinePhoto />
                                    View Image
                                </button>
                            ) : (
                                <span className="text-sm text-slate-500">No image uploaded</span>
                            )}
                            {aiDetectedImageUrl ? (
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => openImagePreview(aiDetectedImageUrl, 'AI Detected Image')}
                                >
                                    <HiOutlineSparkles />
                                    View AI Image
                                </button>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Link to={detailPath} className="btn btn-secondary btn-sm">
                            <HiOutlineArrowTopRightOnSquare />
                            Open Details
                        </Link>

                        {(showStatusControl || showReviewButton || onDelete) ? (
                            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                                {showStatusControl ? (
                                    <select
                                        className="input status-select"
                                        value={complaint.status}
                                        onChange={(event) => onStatusChange?.(complaint._id, event.target.value)}
                                        disabled={isUpdating}
                                    >
                                        <option value="reported">Reported</option>
                                        <option value="assigned">Assigned</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="resolved">Resolved</option>
                                        <option value="rejected">Rejected</option>
                                    </select>
                                ) : null}
                                {showReviewButton ? (
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => onReview?.(complaint)}
                                    >
                                        Review &amp; Update
                                    </button>
                                ) : null}
                                {onDelete ? (
                                    <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(complaint._id)}>
                                        Delete
                                    </button>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </div>
            </article>

            <Modal
                isOpen={Boolean(previewImageUrl)}
                onClose={closeImagePreview}
                title={previewImageTitle || complaint.title || 'Complaint Image'}
                size="lg"
                bodyScrollable={false}
            >
                {previewImageUrl ? (
                    <div className="flex items-center justify-center rounded-3xl bg-slate-950/5 p-2">
                        <img
                            src={previewImageUrl}
                            alt={complaint.title}
                            className="max-h-[70vh] w-auto rounded-2xl object-contain"
                        />
                    </div>
                ) : null}
            </Modal>
        </>
    );
}
