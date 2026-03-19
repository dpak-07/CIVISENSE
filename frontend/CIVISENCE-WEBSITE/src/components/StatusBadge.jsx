const STATUS_MAP = {
    reported: {
        label: 'Reported',
        wrapper: 'border-slate-200 bg-slate-100 text-slate-700',
        dot: 'bg-slate-500'
    },
    assigned: {
        label: 'Assigned',
        wrapper: 'border-sky-200 bg-sky-50 text-sky-700',
        dot: 'bg-sky-500'
    },
    in_progress: {
        label: 'In Progress',
        wrapper: 'border-amber-200 bg-amber-50 text-amber-700',
        dot: 'bg-amber-500'
    },
    resolved: {
        label: 'Resolved',
        wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        dot: 'bg-emerald-500'
    },
    rejected: {
        label: 'Rejected',
        wrapper: 'border-rose-200 bg-rose-50 text-rose-700',
        dot: 'bg-rose-500'
    },
    unassigned: {
        label: 'Unassigned',
        wrapper: 'border-slate-200 bg-white text-slate-500',
        dot: 'bg-slate-400'
    }
};

export default function StatusBadge({ status }) {
    const config = STATUS_MAP[status] || {
        label: String(status || 'Unknown').replace(/_/g, ' '),
        wrapper: 'border-slate-200 bg-white text-slate-600',
        dot: 'bg-slate-400'
    };

    return (
        <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${config.wrapper}`}
        >
            <span className={`h-2 w-2 rounded-full ${config.dot}`} />
            {config.label}
        </span>
    );
}
