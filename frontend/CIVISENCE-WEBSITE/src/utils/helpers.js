export function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

export function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function formatTimeAgo(dateString) {
    if (!dateString) return '';
    const seconds = Math.floor((Date.now() - new Date(dateString)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return formatDate(dateString);
}

export function msToHours(ms) {
    if (!ms) return '0';
    return (ms / (1000 * 60 * 60)).toFixed(1);
}

export function getErrorMessage(error) {
    if (error.response?.data?.message) return error.response.data.message;
    if (error.message) return error.message;
    return 'An unexpected error occurred';
}

export function getRolePath(role) {
    const paths = { citizen: '/citizen', officer: '/officer', admin: '/admin', super_admin: '/admin' };
    return paths[role] || '/login';
}

export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

export function formatRoleLabel(role) {
    const normalized = String(role || '').replace(/_/g, ' ').trim();
    if (!normalized) return 'User';
    return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatCompactNumber(value) {
    return new Intl.NumberFormat('en-IN', {
        notation: 'compact',
        maximumFractionDigits: 1
    }).format(Number(value || 0));
}

export const PRIORITY_ORDER = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
};

export function sortComplaintsByPriorityAndDate(complaints = []) {
    return [...complaints].sort((a, b) => {
        const aPriority = PRIORITY_ORDER[a?.priority?.level] || 0;
        const bPriority = PRIORITY_ORDER[b?.priority?.level] || 0;
        if (aPriority !== bPriority) return bPriority - aPriority;

        const aTime = new Date(a?.createdAt || 0).getTime();
        const bTime = new Date(b?.createdAt || 0).getTime();
        return bTime - aTime;
    });
}
