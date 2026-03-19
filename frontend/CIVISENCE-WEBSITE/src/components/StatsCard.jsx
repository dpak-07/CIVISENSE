export default function StatsCard({ icon, label, value, color = 'primary', trend }) {
    const toneMap = {
        primary: {
            ring: 'border-sky-200',
            icon: 'bg-sky-600 text-white',
            glow: 'from-sky-50 to-white',
            accent: 'bg-sky-500'
        },
        success: {
            ring: 'border-emerald-200',
            icon: 'bg-emerald-600 text-white',
            glow: 'from-emerald-50 to-white',
            accent: 'bg-emerald-500'
        },
        warning: {
            ring: 'border-amber-200',
            icon: 'bg-amber-500 text-white',
            glow: 'from-amber-50 to-white',
            accent: 'bg-amber-400'
        },
        danger: {
            ring: 'border-rose-200',
            icon: 'bg-rose-600 text-white',
            glow: 'from-rose-50 to-white',
            accent: 'bg-rose-500'
        },
        info: {
            ring: 'border-cyan-200',
            icon: 'bg-cyan-600 text-white',
            glow: 'from-cyan-50 to-white',
            accent: 'bg-cyan-500'
        }
    };

    const tone = toneMap[color] || toneMap.primary;

    return (
        <article
            className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br ${tone.glow} p-5 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.5)] transition duration-200 hover:-translate-y-1 ${tone.ring}`}
        >
            <span className={`absolute inset-x-0 top-0 h-1 ${tone.accent}`} />
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl shadow-lg ${tone.icon}`}>
                        {icon}
                    </div>
                    <div>
                        <p className="text-3xl font-extrabold text-slate-950">{value}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{label}</p>
                    </div>
                </div>

                {trend !== undefined ? (
                    <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            trend >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}
                    >
                        {trend >= 0 ? '+' : '-'}
                        {Math.abs(trend)}%
                    </span>
                ) : null}
            </div>
        </article>
    );
}
