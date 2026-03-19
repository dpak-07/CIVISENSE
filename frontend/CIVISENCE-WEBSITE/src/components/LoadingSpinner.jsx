export default function LoadingSpinner({ fullPage, size = 40, label = 'Loading...' }) {
    const spinner = (
        <div className="flex flex-col items-center justify-center gap-3 text-center">
            <div
                className="animate-spin rounded-full border-[3px] border-slate-200 border-t-sky-600"
                style={{ width: size, height: size }}
            />
            <p className="text-sm font-medium text-slate-500">{label}</p>
        </div>
    );

    if (fullPage) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/70">
                {spinner}
            </div>
        );
    }

    return spinner;
}
