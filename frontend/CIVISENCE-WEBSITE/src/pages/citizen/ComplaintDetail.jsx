import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getComplaintById, deleteComplaint } from '../../api/complaints';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime, getErrorMessage } from '../../utils/helpers';
import './ComplaintDetail.css';

export default function ComplaintDetail() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [complaint, setComplaint] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadComplaint();
        const intervalId = window.setInterval(loadComplaint, 10000);
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

    return (
        <DashboardLayout>
            <div className="page-header">
                <div>
                    <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm" style={{ marginBottom: 8 }}>← Back</button>
                    <h1>{complaint.title}</h1>
                </div>
                {(isOwner || user.role === 'admin' || user.role === 'super_admin') && (
                    <button className="btn btn-danger btn-sm" onClick={handleDelete}>Delete</button>
                )}
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
                                    <img key={i} src={img.url} alt={`Complaint image ${i + 1}`} />
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

                    {complaint.aiMeta && (
                        <div className="detail-section">
                            <h3>AI Analysis</h3>
                            <pre className="detail-ai">{JSON.stringify(complaint.aiMeta, null, 2)}</pre>
                        </div>
                    )}
                </div>

                <div className="detail-sidebar">
                    <div className="detail-info-card card">
                        <h3>Details</h3>
                        <div className="detail-info-list">
                            <div className="detail-info-row">
                                <span>Status</span>
                                <StatusBadge status={complaint.status} />
                            </div>
                            <div className="detail-info-row">
                                <span>Category</span>
                                <span className="category-tag">{complaint.category}</span>
                            </div>
                            <div className="detail-info-row">
                                <span>Priority</span>
                                <span className={`priority-tag priority-tag--${complaint.priority?.level || 'low'}`}>
                                    {complaint.priority?.level || 'low'}
                                </span>
                            </div>
                            <div className="detail-info-row">
                                <span>Severity</span>
                                <span>{complaint.severityScore || 0}</span>
                            </div>
                            <div className="detail-info-row">
                                <span>Created</span>
                                <span className="text-muted">{formatDateTime(complaint.createdAt)}</span>
                            </div>
                            <div className="detail-info-row">
                                <span>Updated</span>
                                <span className="text-muted">{formatDateTime(complaint.updatedAt)}</span>
                            </div>
                            {complaint.resolutionRemark && (
                                <div className="detail-info-row">
                                    <span>Resolution Remark</span>
                                    <span>{complaint.resolutionRemark}</span>
                                </div>
                            )}
                            {complaint.rejectionReason && (
                                <div className="detail-info-row">
                                    <span>Rejection Reason</span>
                                    <span>{complaint.rejectionReason}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {complaint.assignedMunicipalOffice && (
                        <div className="detail-info-card card">
                            <h3>Assigned Office</h3>
                            <div className="detail-info-list">
                                <div className="detail-info-row">
                                    <span>Name</span>
                                    <span>{complaint.assignedMunicipalOffice.name || '—'}</span>
                                </div>
                                <div className="detail-info-row">
                                    <span>Type</span>
                                    <span>{complaint.assignedMunicipalOffice.type || '—'}</span>
                                </div>
                                <div className="detail-info-row">
                                    <span>Zone</span>
                                    <span>{complaint.assignedMunicipalOffice.zone || '—'}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {complaint.duplicateInfo?.isDuplicate && (
                        <div className="detail-info-card card">
                            <h3>Duplicate Info</h3>
                            <p className="text-muted" style={{ fontSize: 'var(--font-sm)' }}>
                                This complaint is a duplicate of a master complaint.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
