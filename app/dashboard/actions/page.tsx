"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Clock, AlertCircle, Loader2, ListTodo, RefreshCw, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type ActionItem = {
    id: string;
    text: string;
    owner: string | null;
    dueDate: string | null;
    status: "new" | "in_progress" | "done";
    meetingId: string;
    meetingTitle: string;
    meetingStartTime: string | null;
};

const STATUS_CONFIG = {
    new: { label: "To Do", icon: Circle, color: "text-slate-400", bg: "bg-slate-50 border-slate-200" },
    in_progress: { label: "In Progress", icon: Clock, color: "text-amber-500", bg: "bg-amber-50 border-amber-200" },
    done: { label: "Done", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50 border-emerald-200" },
};

type FilterState = "all" | "new" | "in_progress" | "done";

export default function ActionsPage() {
    const [items, setItems] = useState<ActionItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<FilterState>("all");
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const fetchItems = useCallback(async () => {
        try {
            const res = await fetch("/api/meetings/actions");
            if (!res.ok) throw new Error("Failed to fetch");
            const { data } = await res.json();
            setItems(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { void fetchItems(); }, [fetchItems]);

    async function updateStatus(item: ActionItem, nextStatus: ActionItem["status"]) {
        setUpdatingId(item.id);
        const parts = item.id.split("-");
        const itemIndex = parseInt(parts[parts.length - 1] ?? "0", 10);
        const meetingId = parts.slice(0, -1).join("-");

        try {
            await fetch("/api/meetings/actions", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ meetingId, itemIndex, status: nextStatus }),
            });
            setItems(prev =>
                prev.map(i => i.id === item.id ? { ...i, status: nextStatus } : i)
            );
        } catch (err) {
            console.error(err);
        } finally {
            setUpdatingId(null);
        }
    }

    const visible = useMemo(() =>
        filter === "all" ? items : items.filter(i => i.status === filter),
        [items, filter]
    );

    const counts = useMemo(() => ({
        all: items.length,
        new: items.filter(i => i.status === "new").length,
        in_progress: items.filter(i => i.status === "in_progress").length,
        done: items.filter(i => i.status === "done").length,
    }), [items]);

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <div className="rounded-2xl border border-[#e6e8ee] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#6b7280]">Action Items</p>
                        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#111827]">Task Tracker</h1>
                        <p className="mt-1 text-sm text-[#6b7280]">All action items extracted from your meeting transcripts.</p>
                    </div>
                    <button
                        onClick={() => { setIsLoading(true); void fetchItems(); }}
                        className="flex items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#f9fafb]"
                    >
                        <RefreshCw size={14} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
                {(["all", "new", "in_progress", "done"] as FilterState[]).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                            "rounded-xl px-4 py-2 text-sm font-medium transition",
                            filter === f
                                ? "bg-[#1f2937] text-white"
                                : "border border-[#e5e7eb] bg-white text-[#6b7280] hover:border-[#d8deea] hover:text-[#111827]"
                        )}
                    >
                        {f === "all" ? "All" : f === "in_progress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)}
                        <span className={cn(
                            "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                            filter === f ? "bg-white/20 text-white" : "bg-[#f1f5f9] text-[#6b7280]"
                        )}>
                            {counts[f]}
                        </span>
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="rounded-2xl border border-[#e6e8ee] bg-white shadow-sm">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-slate-400" size={28} />
                    </div>
                ) : visible.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <ListTodo className="mb-3 text-slate-300" size={40} />
                        <p className="font-medium text-[#6b7280]">No action items found</p>
                        <p className="mt-1 text-sm text-[#9ca3af]">Action items are extracted automatically from meeting transcripts.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-[#f1f5f9]">
                        {visible.map(item => {
                            const cfg = STATUS_CONFIG[item.status];
                            const Icon = cfg.icon;
                            const isUpdating = updatingId === item.id;

                            return (
                                <div key={item.id} className="flex items-start gap-4 p-4 transition hover:bg-[#fafafa]">
                                    {/* Status toggle button */}
                                    <button
                                        disabled={isUpdating}
                                        onClick={() => {
                                            const next = item.status === "new"
                                                ? "in_progress"
                                                : item.status === "in_progress"
                                                    ? "done"
                                                    : "new";
                                            void updateStatus(item, next);
                                        }}
                                        className="mt-0.5 shrink-0 transition hover:scale-110 disabled:opacity-50"
                                        title="Click to advance status"
                                    >
                                        {isUpdating
                                            ? <Loader2 size={18} className="animate-spin text-slate-400" />
                                            : <Icon size={18} className={cfg.color} />
                                        }
                                    </button>

                                    <div className="min-w-0 flex-1">
                                        <p className={cn(
                                            "text-sm font-medium text-[#111827]",
                                            item.status === "done" && "line-through text-[#9ca3af]"
                                        )}>
                                            {item.text}
                                        </p>
                                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                            <span className="text-xs text-[#6b7280]">{item.meetingTitle}</span>
                                            {item.meetingStartTime && (
                                                <span className="text-xs text-[#9ca3af]">
                                                    {format(new Date(item.meetingStartTime), "MMM d")}
                                                </span>
                                            )}
                                            {item.owner && (
                                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600">
                                                    {item.owner}
                                                </span>
                                            )}
                                            {item.dueDate && (
                                                <span className="flex items-center gap-1 text-[11px] text-amber-600">
                                                    <AlertCircle size={11} />
                                                    {item.dueDate}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <span className={cn(
                                        "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                                        cfg.bg, cfg.color
                                    )}>
                                        {cfg.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
