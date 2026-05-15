"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { CalendarDays, Filter, Plus, MoreVertical, Flame, Bot, Loader2, LayoutGrid } from "lucide-react";
import dynamic from "next/dynamic";
import MeetingDialog from "@/components/MeetingDialog";
import DashboardCustomizer, { type WidgetPrefs } from "@/components/DashboardCustomizer";
import { cn } from "@/lib/utils";

// Single dynamic import for all recharts — avoids 9 separate chunks
const Charts = dynamic(() => import("@/components/DashboardCharts"), {
    ssr: false,
    loading: () => (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <div className="h-64 animate-pulse rounded-xl border border-[#e6e8ee] bg-slate-100 xl:col-span-2" />
            <div className="h-64 animate-pulse rounded-xl border border-[#e6e8ee] bg-slate-100" />
        </div>
    ),
});

type DashboardStats = {
    totalMeetings: number;
    todayMeetings: number;
    processedMeetings: number;
    pendingMeetings: number;
    openActionItems: number;
    overdue: number;
    hours: number;
    upcomingStatusCounts: { scheduled: number; needsBot: number; live: number };
};

type WeeklyPoint = { label: string; completed: number; pending: number };
type RecentMeeting = {
    id: string; title: string; startTime: string;
    platform: string; transcriptReady: boolean; hasRecording: boolean;
};

const PLATFORM_LABELS: Record<string, string> = {
    google_meet: "Google Meet", zoom: "Zoom",
    microsoft_teams: "Microsoft Teams", webex: "Webex",
    other: "Other", unknown: "Unknown",
};

function formatMeetingMeta(meeting: RecentMeeting): string {
    const date = new Date(meeting.startTime);
    const dayLabel = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const timeLabel = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${dayLabel} at ${timeLabel} / ${PLATFORM_LABELS[meeting.platform] || "Meeting"}`;
}

function formatDashboardRangeLabel(): string {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 27);
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

const EMPTY_STATS: DashboardStats = {
    totalMeetings: 0, todayMeetings: 0, processedMeetings: 0,
    pendingMeetings: 0, openActionItems: 0, overdue: 0, hours: 0,
    upcomingStatusCounts: { scheduled: 0, needsBot: 0, live: 0 },
};

const WIDGETS = [
    { id: "stat-cards",      label: "Overview Stats",   desc: "4 key metrics at a glance" },
    { id: "charts",          label: "Activity Charts",  desc: "Weekly trend + bot status" },
    { id: "recent-meetings", label: "Recent Meetings",  desc: "Last 4 meetings" },
] as const;

const WIDGET_IDS = WIDGETS.map((w) => w.id);
const LS_WIDGETS_KEY = "zapbot.dashboard.widgets";

function loadWidgetPrefs(): WidgetPrefs {
    try {
        const raw = typeof window !== "undefined" ? localStorage.getItem(LS_WIDGETS_KEY) : null;
        if (!raw) return { order: [...WIDGET_IDS], hidden: [] };
        const parsed = JSON.parse(raw) as Partial<WidgetPrefs>;
        const order = Array.isArray(parsed.order) && parsed.order.every((id) => WIDGET_IDS.includes(id as any))
            ? parsed.order
            : [...WIDGET_IDS];
        const hidden = Array.isArray(parsed.hidden) ? parsed.hidden.filter((id) => WIDGET_IDS.includes(id as any)) : [];
        return { order, hidden };
    } catch {
        return { order: [...WIDGET_IDS], hidden: [] };
    }
}

export default function DashboardPage() {
    const { user } = useUser();
    const router = useRouter();
    const firstName = user?.firstName || "Operator";
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [customizerOpen, setCustomizerOpen] = useState(false);
    const [widgetPrefs, setWidgetPrefs] = useState<WidgetPrefs>({ order: [...WIDGET_IDS], hidden: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [autoJoin, setAutoJoin] = useState<boolean | null>(null);
    const [autoJoinSaving, setAutoJoinSaving] = useState(false);
    const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
    const [weeklyTrend, setWeeklyTrend] = useState<WeeklyPoint[]>([]);
    const [recentMeetings, setRecentMeetings] = useState<RecentMeeting[]>([]);
    const loadedRef = useRef(false);

    // Load widget prefs from localStorage on mount (client-only)
    useEffect(() => {
        setWidgetPrefs(loadWidgetPrefs());
    }, []);

    const handleWidgetPrefsChange = useCallback((prefs: WidgetPrefs) => {
        setWidgetPrefs(prefs);
        try { localStorage.setItem(LS_WIDGETS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
    }, []);

    const toggleAutoJoin = useCallback(async () => {
        const next = !autoJoin;
        setAutoJoin(next);
        setAutoJoinSaving(true);
        try {
            await fetch("/api/user/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ settings: { autoJoinMeetings: next } }),
            });
        } catch { setAutoJoin(!next); }
        finally { setAutoJoinSaving(false); }
    }, [autoJoin]);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Parallel fetch — no waterfall
            const [overviewRes, settingsRes] = await Promise.all([
                fetch("/api/dashboard/overview"),
                fetch("/api/user/settings"),
            ]);

            if (overviewRes.ok) {
                const { data } = await overviewRes.json();
                const weekly = Array.isArray(data.insights?.weekly) ? data.insights.weekly : [];
                setWeeklyTrend(weekly.map((p: any, i: number) => ({
                    label: p.label || p.week || `W${i + 1}`,
                    completed: p.processed || 0,
                    pending: p.pending || 0,
                })));
                setRecentMeetings(Array.isArray(data.meetingIndex) ? data.meetingIndex.slice(0, 4) : []);
                setStats({
                    totalMeetings: data.overview?.totalMeetings || 0,
                    todayMeetings: data.overview?.todayMeetings || 0,
                    processedMeetings: data.overview?.processedMeetings || 0,
                    pendingMeetings: data.overview?.pendingMeetings || 0,
                    openActionItems: data.overview?.openActionItems || 0,
                    overdue: data.insights?.overdueTasks || 0,
                    hours: Math.round(weekly.reduce((a: number, p: any) => a + (p.hours || 0), 0)),
                    upcomingStatusCounts: data.analytics?.upcomingStatusCounts || { scheduled: 0, needsBot: 0, live: 0 },
                });
            }

            if (settingsRes.ok) {
                const { data: s } = await settingsRes.json();
                setAutoJoin(s?.settings?.autoJoinMeetings ?? true);
            } else {
                setAutoJoin(true);
            }
        } catch (e) {
            console.error("Dashboard error:", e);
            setAutoJoin(true);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (loadedRef.current) return;
        loadedRef.current = true;
        void loadData();
    }, [loadData]);

    const cards = [
        { label: "Total Meetings", value: stats.totalMeetings, sub: `${stats.todayMeetings} today`, color: "bg-sky-100 text-sky-600" },
        { label: "Processed", value: stats.processedMeetings, sub: `${stats.hours} hrs captured`, color: "bg-emerald-100 text-emerald-600" },
        { label: "Pending Review", value: stats.pendingMeetings, sub: `${stats.pendingMeetings} in pipeline`, color: "bg-orange-100 text-orange-600" },
        { label: "Action Items", value: stats.openActionItems, sub: `${stats.overdue} overdue tasks`, color: "bg-fuchsia-100 text-fuchsia-600" },
    ];

    const statusBars = [
        { name: "Scheduled", value: stats.upcomingStatusCounts.scheduled, color: "#0ea5e9" },
        { name: "Needs Bot", value: stats.upcomingStatusCounts.needsBot, color: "#f97316" },
        { name: "Live", value: stats.upcomingStatusCounts.live, color: "#16a34a" },
    ];

    return (
        <div className="flex h-[calc(100vh-64px)] md:h-[calc(100vh-80px)] w-full flex-col overflow-hidden bg-[#f7f8fb] px-4 py-4 md:px-6 md:py-5">
            <div className="custom-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
                <div className="flex items-center gap-2 text-sm font-medium text-[#6b7280]">
                    <span>Main Menu</span>
                    <span>{">"}</span>
                    <span className="text-[#111827]">Dashboard</span>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-[#e6e8ee] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                    <button className="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-3 py-2 text-xs font-medium text-[#374151]">
                        <CalendarDays size={14} strokeWidth={2.2} />
                        {formatDashboardRangeLabel()}
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => void toggleAutoJoin()}
                            disabled={autoJoinSaving || autoJoin === null}
                            title={autoJoin ? "Auto-join is ON" : "Auto-join is OFF"}
                            className={cn(
                                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-all disabled:opacity-60",
                                autoJoin
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    : "border-[#e5e7eb] bg-white text-[#6b7280] hover:bg-slate-50"
                            )}
                        >
                            {autoJoinSaving ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} strokeWidth={2.2} />}
                            Bot Auto-Join {autoJoin === null ? "" : autoJoin ? "ON" : "OFF"}
                        </button>
                        <button className="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-xs font-semibold text-[#374151]">
                            <Filter size={14} strokeWidth={2.2} /> Filter
                        </button>
                        <button
                            onClick={() => setCustomizerOpen(true)}
                            className="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-xs font-semibold text-[#374151] hover:bg-[#f9fafb] transition-colors"
                        >
                            <LayoutGrid size={14} strokeWidth={2.2} /> Customize
                        </button>
                        <button
                            onClick={() => setIsDialogOpen(true)}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#1f2937] px-3 py-2 text-xs font-semibold text-white hover:bg-[#111827]"
                        >
                            Add Meeting <Plus size={14} strokeWidth={2.4} />
                        </button>
                    </div>
                </div>

                <div>
                    <h1 className="text-[34px] font-bold tracking-tight text-[#111827]">
                        Stay Organized, Stay Productive {firstName} <Flame className="inline h-7 w-7 text-orange-500" />
                    </h1>
                    <p className="mt-1 text-[15px] text-[#6b7280]">
                        Effortlessly manage meetings, track insights, and achieve goals all in one place.
                    </p>
                </div>

                {widgetPrefs.order.map((widgetId) => {
                    if (widgetPrefs.hidden.includes(widgetId)) return null;

                    if (widgetId === "stat-cards") return (
                        <div key="stat-cards" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                            {isLoading ? (
                                Array.from({ length: 4 }).map((_, idx) => (
                                    <div key={idx} className="animate-pulse rounded-xl border border-[#e6e8ee] bg-white p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="h-7 w-7 rounded-md bg-slate-200" />
                                            <div className="h-4 w-24 rounded bg-slate-200" />
                                        </div>
                                        <div className="h-10 w-16 rounded bg-slate-200" />
                                        <div className="mt-1 h-4 w-20 rounded bg-slate-200" />
                                    </div>
                                ))
                            ) : (
                                cards.map((card) => (
                                    <div key={card.label} className="rounded-xl border border-[#e6e8ee] bg-white p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={`h-7 w-7 rounded-md ${card.color}`} />
                                                <p className="text-[15px] font-semibold text-[#1f2937]">{card.label}</p>
                                            </div>
                                            <MoreVertical size={16} className="text-[#9ca3af]" />
                                        </div>
                                        <p className="mt-2 text-[34px] font-bold leading-none text-[#111827]">{card.value}</p>
                                        <p className="mt-1 text-sm text-[#6b7280]">{card.sub}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    );

                    if (widgetId === "charts") return (
                        <Charts key="charts" weeklyTrend={weeklyTrend} statusBars={statusBars} />
                    );

                    if (widgetId === "recent-meetings") return (
                        <div key="recent-meetings" className="rounded-xl border border-[#e6e8ee] bg-white p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-[22px] font-semibold text-[#111827]">Recent Meetings</h3>
                                <button
                                    onClick={() => router.push("/dashboard/meetings")}
                                    className="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-semibold text-[#4b5563]"
                                >
                                    View All
                                </button>
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
                                {isLoading ? (
                                    <p className="col-span-full text-center text-sm text-[#6b7280]">Loading meetings...</p>
                                ) : recentMeetings.length === 0 ? (
                                    <p className="col-span-full text-center text-sm text-[#6b7280]">No recent meetings found</p>
                                ) : (
                                    recentMeetings.map((meeting) => (
                                        <div key={meeting.id} className="rounded-lg border border-[#e6e8ee] bg-[#fcfcfd] p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="truncate text-sm font-semibold text-[#111827]">{meeting.title || "Untitled Meeting"}</p>
                                                <MoreVertical size={14} className="text-[#9ca3af]" />
                                            </div>
                                            <p className="mt-1 text-xs text-[#6b7280]">{formatMeetingMeta(meeting)}</p>
                                            <span className="mt-3 inline-block rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-600">
                                                {meeting.transcriptReady ? "Summary Ready" : meeting.hasRecording ? "Recording Ready" : "Scheduled"}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );

                    return null;
                })}
            </div>

            <MeetingDialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                onSuccess={() => void loadData()}
            />

            <DashboardCustomizer
                open={customizerOpen}
                widgets={WIDGETS}
                prefs={widgetPrefs}
                onChange={handleWidgetPrefsChange}
                onClose={() => setCustomizerOpen(false)}
            />

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #d9dfeb; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            `}</style>
        </div>
    );
}
