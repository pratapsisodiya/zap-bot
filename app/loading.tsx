"use client";

export default function GlobalLoading() {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#f7f8fb]">
            {/* Top accent bar */}
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500" />

            {/* Subtle dot grid */}
            <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                    backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                }}
            />

            <div className="relative flex flex-col items-center gap-6 px-6 text-center">
                {/* Logo */}
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-[#e6e8ee] bg-white shadow-sm">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <polygon points="13,2 5,13 12,13 11,22 19,11 12,11" fill="#1f2937" />
                    </svg>
                    {/* Pulse ring */}
                    <span className="absolute inset-0 rounded-2xl animate-ping border border-sky-300 opacity-40" />
                </div>

                {/* Wordmark */}
                <div>
                    <p className="text-[22px] font-bold tracking-tight text-[#111827]">ZapBot</p>
                    <p className="mt-1 text-sm text-[#6b7280]">Preparing your workspace…</p>
                </div>

                {/* Progress bar */}
                <div className="w-48 overflow-hidden rounded-full bg-[#e6e8ee] h-1">
                    <div className="h-full w-full origin-left animate-[loading_1.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-sky-500 to-violet-500" />
                </div>
            </div>

            <style>{`
                @keyframes loading {
                    0%   { transform: scaleX(0); transform-origin: left; }
                    50%  { transform: scaleX(1); transform-origin: left; }
                    50.01% { transform-origin: right; }
                    100% { transform: scaleX(0); transform-origin: right; }
                }
            `}</style>
        </div>
    );
}
