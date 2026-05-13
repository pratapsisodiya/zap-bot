"use client";

import Link from "next/link";
import { ArrowLeft, Home, Zap } from "lucide-react";

export default function NotFound() {
    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f7f8fb] px-6 font-sans">
            {/* Subtle dot grid */}
            <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                    backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                    maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 60%, transparent 100%)",
                }}
            />

            {/* Radial glow */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_40%,rgba(14,165,233,0.07),transparent)]" />

            <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
                {/* Logo mark */}
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#e6e8ee] bg-white shadow-sm">
                    <Zap size={24} className="text-[#1f2937]" fill="#1f2937" />
                </div>

                {/* 404 */}
                <p className="text-[96px] font-black leading-none tracking-tighter text-[#e6e8ee]">
                    404
                </p>

                <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#111827]">
                    Page not found
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-[#6b7280]">
                    We couldn't find the page you're looking for. It may have been moved or deleted.
                </p>

                {/* Actions */}
                <div className="mt-8 flex w-full flex-col gap-3">
                    <Link
                        href="/dashboard"
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1f2937] text-sm font-semibold text-white transition hover:bg-[#111827] active:scale-[0.98]"
                    >
                        <Home size={15} /> Go to Dashboard
                    </Link>
                    <Link
                        href="/"
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#e6e8ee] bg-white text-sm font-semibold text-[#374151] transition hover:bg-slate-50 active:scale-[0.98]"
                    >
                        <ArrowLeft size={15} /> Back to Home
                    </Link>
                </div>

                {/* Footer brand */}
                <div className="mt-12 flex items-center gap-2 opacity-50">
                    <div className="flex h-5 w-5 items-center justify-center rounded bg-[#1f2937]">
                        <Zap size={11} className="text-white" fill="white" />
                    </div>
                    <span className="text-xs font-bold text-[#111827]">ZapBot</span>
                    <span className="text-xs text-[#9ca3af]">· AI Meeting Assistant</span>
                </div>
            </div>
        </div>
    );
}
