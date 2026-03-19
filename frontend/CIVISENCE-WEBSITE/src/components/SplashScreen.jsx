import CiviSenseLogo from './branding/CiviSenseLogo';

export default function SplashScreen() {
    return (
        <div
            className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6"
            role="status"
            aria-live="polite"
        >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.18),transparent_28%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(2,132,199,0.72),rgba(15,118,110,0.62))]" />
            <div className="absolute inset-0 opacity-30 bg-[linear-gradient(rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.14)_1px,transparent_1px)] [background-size:90px_90px]" />

            <div className="relative flex max-w-xl flex-col items-center gap-5 text-center text-white">
                <div className="rounded-[2rem] border border-white/20 bg-white/10 p-4 shadow-[0_30px_80px_-28px_rgba(14,165,233,0.9)] backdrop-blur-2xl">
                    <CiviSenseLogo size={96} className="animate-[float_4s_ease-in-out_infinite]" />
                </div>
                <div className="space-y-2">
                    <p className="font-display text-sm font-semibold uppercase tracking-[0.38em] text-sky-200">
                        Civic Operations Platform
                    </p>
                    <h1 className="text-5xl font-bold sm:text-6xl">CiviSense</h1>
                    <p className="mx-auto max-w-md text-sm text-slate-200 sm:text-base">
                        Opening the complaint reporting and tracking portal for citizens, officers, and administrators.
                    </p>
                </div>

                <div className="flex items-center gap-2" aria-hidden="true">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-300" />
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-200 [animation-delay:150ms]" />
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-200 [animation-delay:300ms]" />
                </div>
            </div>
        </div>
    );
}
