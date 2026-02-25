import './StatusBadge.css';

const STATUS_MAP = {
    reported: { label: 'Reported', class: 'info' },
    assigned: { label: 'Assigned', class: 'primary' },
    in_progress: { label: 'In Progress', class: 'warning' },
    resolved: { label: 'Resolved', class: 'success' },
    rejected: { label: 'Rejected', class: 'danger' },
    unassigned: { label: 'Unassigned', class: 'muted' }
};

export default function StatusBadge({ status }) {
    const config = STATUS_MAP[status] || { label: status, class: 'muted' };
    return (
        <span className={`status-badge status-badge--${config.class}`}>
            <span className="status-badge__dot" />
            {config.label}
        </span>
    );
}
