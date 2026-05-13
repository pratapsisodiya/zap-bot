"use client";

import { useEffect, useState } from "react";
import {
    Video,
    Clock,
    CheckCircle2,
    Bot,
    TrendingUp,
    FileText,
    Sparkles,
    MoreVertical,
    RefreshCw,
    ArrowUpRight,
    Layers,
} from "lucide-react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const AnalyticsChart = dynamic(() => import("@/components/AnalyticsChart"), {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse rounded-xl bg-slate-100" />,
});

type Stats = {
    totalMeetings: number;
    activeMeetings: number;
    weekMeetings: number;
    recordingsCount: number;
    hoursTranscribed: number;
    completionRate: number;
    transcriptSuccessRate: number;
    summarySuccessRate: number;
    trendData: { name: string; meetings: number }[];
    botFunnel: { sent: number; joined: number; completed: number };
    usage: { plan: string; meetingsThisMonth: number; meetingsLimit: number; remainingMeetings: number };
};

const EMPTY: Stats = {
    totalMeetings: 0, activeMeetings: 0, weekMeetings: 0,
    recordingsCount: 0, hoursTranscribed: 0,
    completionRate: 0, transcriptSuccessRate: 0, summarySuccessRate: 0,
    trendData: [],
    botFunnel: { sent: 0, joined: 0, completed: 0 },
    usage: { plan: "free", meetingsThisMonth: 0, meetingsLimit: 10, remainingMeetings: 10 },
};

function Skeleton({ className }: { className?: string }) {
    return <div className={cn("animate-pulse rounded-lg bg-slate-100", className)} />;
}

function StatCard({
    icon: Icon,
    label,
    value,
    sub,
    accent,
    loading,
}: {
    icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
    label: string;
    value: string | number;
    sub?: string;
    accent: string;
    loading: boolean;
}) {
    return (
        <div className="flex flex-col gap-3 rounded-xl border border-[#e6e8ee] bg-white p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={cn("flex h-7 w-7 items-center justify-center rounded-md", accent)}>
                        <Icon size={15} strokeWidth={2.1} />
                    </div>
                    <p className="text-[15px] font-semibold text-[#1f2937]">{label}</p>
                </div>
                <MoreVertical size={16} className="text-[#9ca3af]" />
            </div>
            {loading ? (
                <>
                    <Skeleton className="h-10 w-20" />
                    <Skeleton className="h-4 w-24" />
                </>
            ) : (
                <>
                    <p className="text-[34px] font-bold leading-none text-[#111827]">{value}</p>
                    {sub && <p className="text-sm text-[#6b7280]">{sub}</p>}
                </>
            )}
        </div>
    );
}

function RateBar({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#4b5563]">{label}</span>
                <span className="text-xs font-bold text-[#111827]">{value}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                    className={cn("h-full rounded-full transition-all duration-700", color)}
                    style={{ width: `${Math.min(100, value)}%` }}
                />
            </div>
        </div>
    );
}

export default function AnalyticsPage() {
    const [stats, setStats] = useState<Stats>(EMPTY);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    async function load(showRefresh = false) {
        if (showRefresh) setRefreshing(true);
        else setIsLoading(true);
        try {
            const r = await fetch("/api/meetings/stats");
            if (r.ok) {
                const { data } = await r.json();
                setStats({ ...EMPTY, ...data });
            }
        } catch {}
        finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }

    useEffect(() => { void load(); }, []);

    const usagePct = stats.usage.meetingsLimit > 0
        ? Math.min(100, Math.round((stats.usage.meetingsThisMonth / stats.usage.meetingsLimit) * 100))
        : 0;

    const funnelTotal = Math.max(1, stats.botFunnel.sent);
    const funnelSteps = [
        { label: "Bots Sent",  value: stats.botFunnel.sent,      pct: 100,                                                                   color: "bg-sky-500" },
        { label: "Joined",     value: stats.botFunnel.joined,     pct: Math.round((stats.botFunnel.joined / funnelTotal) * 100),    color: "bg-violet-500" },
        { label: "Completed",  value: stats.botFunnel.completed,  pct: Math.round((stats.botFunnel.completed / funnelTotal) * 100), color: "bg-emerald-500" },
    ];

    return (
        <div className="flex h-[calc(100vh-64px)] md:h-[calc(100vh-80px)] w-full flex-col overflow-hidden bg-[#f7f8fb] px-4 py-4 md:px-6 md:py-5">
            <div className="custom-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto pr-1">

                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm font-medium text-[#6b7280]">
                    <span>Main Menu</span>
                    <span>{">"}</span>
                    <span className="text-[#111827]">Analytics</span>
                </div>

                {/* Toolbar */}
                <div className="flex items-center justify-between rounded-xl border border-[#e6e8ee] bg-white p-3">
                    <div>
                        <h1 className="text-[22px] font-semibold text-[#111827]">Analytics</h1>
                        <p className="text-sm text-[#6b7280]">Meeting activity and bot performance</p>
                    </div>
                    <button
                        onClick={() => void load(true)}
                        disabled={refreshing}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-xs font-semibold text-[#374151] hover:bg-slate-50 transition disabled:opacity-50"
                    >
                        <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
                        Refresh
                    </button>
                </div>

                {/* KPI row */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard icon={Video}        label="Total Meetings"    value={stats.totalMeetings}       sub={`${stats.weekMeetings} this week`}      accent="bg-sky-100 text-sky-600"      loading={isLoading} />
                    <StatCard icon={Clock}        label="Hours Transcribed" value={`${stats.hoursTranscribed}h`} sub="from completed meetings"            accent="bg-violet-100 text-violet-600" loading={isLoading} />
                    <StatCard icon={CheckCircle2} label="Recordings Stored" value={stats.recordingsCount}    sub={`${stats.completionRate}% completion`}  accent="bg-emerald-100 text-emerald-600" loading={isLoading} />
                    <StatCard icon={Bot}          label="Active Bots"       value={stats.activeMeetings}     sub="currently in meetings"                  accent="bg-orange-100 text-orange-600"  loading={isLoading} />
                </div>

                {/* Main chart + sidebar */}
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">

                    {/* Activity chart */}
                    <div className="flex flex-col rounded-xl border border-[#e6e8ee] bg-white p-4 xl:col-span-2">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-[15px] font-semibold text-[#111827]">Meeting Activity</h3>
                                <p className="text-sm text-[#6b7280]">Last 7 days</p>
                            </div>
                            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                <ArrowUpRight size={11} /> {stats.weekMeetings} this week
                            </span>
                        </div>
                        <div className="h-52 w-full">
                            {isLoading ? (
                                <div className="flex h-full items-end gap-2 px-2">
                                    {[40, 65, 30, 80, 55, 70, 45].map((h, i) => (
                                        <div key={i} className="flex-1 animate-pulse rounded-t-lg bg-slate-100" style={{ height: `${h}%` }} />
                                    ))}
                                </div>
                            ) : (
                                <AnalyticsChart data={stats.trendData} />
                            )}
                        </div>
                    </div>

                    {/* Processing health */}
                    <div className="flex flex-col gap-4 rounded-xl border border-[#e6e8ee] bg-white p-4">
                        <h3 className="text-[15px] font-semibold text-[#111827]">Processing Health</h3>
                        {isLoading ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map(i => <Skeleton key={i} className="h-8" />)}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <RateBar label="Bot Completion Rate"  value={stats.completionRate}        color="bg-sky-500" />
                                <RateBar label="Transcript Success"   value={stats.transcriptSuccessRate} color="bg-violet-500" />
                                <RateBar label="AI Summary Rate"      value={stats.summarySuccessRate}    color="bg-emerald-500" />
                            </div>
                        )}
                        <div className="mt-auto space-y-2 border-t border-[#e6e8ee] pt-4">
                            {[
                                { color: "bg-sky-500",     label: "Completion" },
                                { color: "bg-violet-500",  label: "Transcript" },
                                { color: "bg-emerald-500", label: "AI Summary" },
                            ].map(l => (
                                <div key={l.label} className="flex items-center gap-2">
                                    <div className={cn("h-2 w-2 rounded-full flex-shrink-0", l.color)} />
                                    <span className="text-xs text-[#6b7280]">{l.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Bottom row */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

                    {/* Bot funnel */}
                    <div className="rounded-xl border border-[#e6e8ee] bg-white p-4">
                        <div className="mb-4 flex items-center gap-2">
                            <Layers size={14} className="text-[#9ca3af]" />
                            <h3 className="text-[15px] font-semibold text-[#111827]">Bot Funnel</h3>
                        </div>
                        {isLoading ? (
                            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10" />)}</div>
                        ) : (
                            <div className="space-y-3">
                                {funnelSteps.map((step) => (
                                    <div key={step.label}>
                                        <div className="mb-1 flex items-center justify-between">
                                            <span className="text-xs font-medium text-[#4b5563]">{step.label}</span>
                                            <span className="text-xs font-bold text-[#111827]">{step.value}</span>
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                            <div
                                                className={cn("h-full rounded-full transition-all duration-700", step.color)}
                                                style={{ width: `${step.pct}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Plan usage */}
                    <div className="rounded-xl border border-[#e6e8ee] bg-white p-4">
                        <div className="mb-4 flex items-center gap-2">
                            <TrendingUp size={14} className="text-[#9ca3af]" />
                            <h3 className="text-[15px] font-semibold text-[#111827]">Plan Usage</h3>
                        </div>
                        {isLoading ? (
                            <Skeleton className="h-20" />
                        ) : (
                            <>
                                <div className="mb-3 flex items-end gap-2">
                                    <span className="text-[34px] font-bold leading-none text-[#111827]">{stats.usage.meetingsThisMonth}</span>
                                    <span className="mb-1 text-sm text-[#6b7280]">
                                        / {stats.usage.meetingsLimit === -1 ? "∞" : stats.usage.meetingsLimit} meetings
                                    </span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all duration-700",
                                            usagePct >= 90 ? "bg-red-500" : usagePct >= 70 ? "bg-orange-400" : "bg-sky-500"
                                        )}
                                        style={{ width: `${stats.usage.meetingsLimit === -1 ? 0 : usagePct}%` }}
                                    />
                                </div>
                                <div className="mt-3 flex items-center justify-between">
                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold capitalize text-[#4b5563]">
                                        {stats.usage.plan}
                                    </span>
                                    {stats.usage.meetingsLimit !== -1 && (
                                        <span className="text-xs text-[#6b7280]">
                                            {stats.usage.remainingMeetings} remaining
                                        </span>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* AI insights */}
                    <div className="rounded-xl border border-[#e6e8ee] bg-white p-4">
                        <div className="mb-4 flex items-center gap-2">
                            <Sparkles size={14} className="text-[#9ca3af]" />
                            <h3 className="text-[15px] font-semibold text-[#111827]">AI Insights</h3>
                        </div>
                        {isLoading ? (
                            <div className="space-y-2">
                                <Skeleton className="h-4" />
                                <Skeleton className="h-4 w-3/4" />
                            </div>
                        ) : (
                            <>
                                <p className="text-sm leading-relaxed text-[#6b7280]">
                                    {stats.totalMeetings > 0
                                        ? `${stats.totalMeetings} meetings processed — ${stats.hoursTranscribed}h transcribed across ${stats.recordingsCount} recordings. Bot completion at ${stats.completionRate}%.`
                                        : "No meetings yet. Schedule your first bot and transcripts will appear here."}
                                </p>
                                <div className="mt-4 grid grid-cols-2 gap-3">
                                    <div className="rounded-lg border border-[#e6e8ee] bg-[#f7f8fb] p-3">
                                        <FileText size={13} className="mb-1.5 text-sky-500" />
                                        <p className="text-[34px] font-bold leading-none text-[#111827]">{stats.transcriptSuccessRate}%</p>
                                        <p className="mt-1 text-xs text-[#6b7280]">Transcript rate</p>
                                    </div>
                                    <div className="rounded-lg border border-[#e6e8ee] bg-[#f7f8fb] p-3">
                                        <Sparkles size={13} className="mb-1.5 text-violet-500" />
                                        <p className="text-[34px] font-bold leading-none text-[#111827]">{stats.summarySuccessRate}%</p>
                                        <p className="mt-1 text-xs text-[#6b7280]">Summary rate</p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #d9dfeb; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            `}</style>
        </div>
    );
}
