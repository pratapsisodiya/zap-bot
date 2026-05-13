"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Loader2,
  Bot,
  Video,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  LinkIcon,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import MeetingDialog from "@/components/MeetingDialog";

type MeetingEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  meetingUrl?: string;
  attendees: string[];
  platform?: string;
  botScheduled?: boolean;
  botSent?: boolean;
  joinedConfirmed?: boolean;
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DOW_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function toKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

const STATUS_DOT: Record<string, string> = {
  live:      "bg-violet-500",
  upcoming:  "bg-blue-400",
  completed: "bg-emerald-500",
};

function getStatus(start: string, end: string): "live" | "upcoming" | "completed" {
  const now = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (now >= s && now <= e) return "live";
  if (now < s) return "upcoming";
  return "completed";
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  live:      { label: "Live",      cls: "bg-violet-50 text-violet-700 border-violet-200" },
  upcoming:  { label: "Upcoming",  cls: "bg-blue-50 text-blue-700 border-blue-200" },
  completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

// ─── Calendar grid ────────────────────────────────────────────────────────────
function buildGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const pad   = first.getDay();
  const total = Math.ceil((pad + last.getDate()) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const offset = i - pad;
    return offset < 0 || offset >= last.getDate() ? null : new Date(year, month, offset + 1);
  });
}

// ─── Inner page ───────────────────────────────────────────────────────────────
function CalendarPageInner() {
  const searchParams = useSearchParams();
  const today = useMemo(() => new Date(), []);

  const [year, setYear]           = useState(today.getFullYear());
  const [month, setMonth]         = useState(today.getMonth());
  const [selected, setSelected]   = useState<Date>(today);
  const [events, setEvents]       = useState<MeetingEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [notice, setNotice]       = useState<{ msg: string; ok: boolean } | null>(null);
  const [busyBot, setBusyBot]     = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.success) {
        setConnected(Boolean(data.connected));
        setEvents(Array.isArray(data.data) ? data.data : []);
        const ok  = searchParams.get("success");
        const err = searchParams.get("error");
        if (ok === "true")  setNotice({ msg: "Calendar connected.", ok: true });
        else if (err)       setNotice({ msg: `Connection issue: ${err.replace(/_/g, " ")}`, ok: false });
      }
    } catch { setNotice({ msg: "Failed to load calendar.", ok: false }); }
    finally { setLoading(false); }
  }, [searchParams]);

  useEffect(() => { void fetchEvents(); }, [fetchEvents]);

  async function syncNow() {
    setSyncing(true);
    setNotice(null);
    try {
      const res  = await fetch("/api/calendar", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Sync failed");
      setNotice({ msg: `${json.meta?.synced ?? 0} meetings synced.`, ok: true });
      await fetchEvents();
    } catch (e) {
      setNotice({ msg: e instanceof Error ? e.message : "Sync failed", ok: false });
    } finally { setSyncing(false); }
  }

  async function sendBot(evt: MeetingEvent) {
    if (!evt.meetingUrl || busyBot) return;
    setBusyBot(evt.id);
    try {
      const res  = await fetch(`/api/meetings/${evt.id}/bot-toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botScheduled: true, forceDispatch: true }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed");
      setNotice({ msg: "Bot dispatched.", ok: true });
      await fetchEvents();
    } catch (e) {
      setNotice({ msg: e instanceof Error ? e.message : "Failed to send bot", ok: false });
    } finally { setBusyBot(null); }
  }

  // Navigation
  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const grid = useMemo(() => buildGrid(year, month), [year, month]);

  const byDay = useMemo(() => {
    const map = new Map<string, MeetingEvent[]>();
    for (const e of events) {
      const k = toKey(new Date(e.start));
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return map;
  }, [events]);

  const dayEvents = useMemo(() =>
    (byDay.get(toKey(selected)) ?? []).sort((a, b) =>
      new Date(a.start).getTime() - new Date(b.start).getTime()
    ), [byDay, selected]);

  return (
    <div className="flex h-[calc(100vh-64px)] md:h-[calc(100vh-80px)] flex-col overflow-hidden bg-[#f8f9fb]">

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 border-b border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
            <ChevronLeft size={14} />
          </button>
          <span className="w-44 text-center text-base font-semibold text-slate-800">
            {MONTHS[month]} {year}
          </span>
          <button onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
            <ChevronRight size={14} />
          </button>
          <button
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelected(today); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-2">
          {connected && (
            <>
              <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-semibold text-emerald-700">Live Sync</span>
              </div>
              <button
                onClick={() => void syncNow()}
                disabled={syncing}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
              >
                <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
                Sync
              </button>
            </>
          )}
          {!connected && (
            <button
              onClick={() => { window.location.href = "/api/calendar/connect"; }}
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
            >
              <LinkIcon size={12} /> Connect Google Calendar
            </button>
          )}
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
          >
            <Plus size={13} /> Schedule
          </button>
        </div>
      </div>

      {/* ── Notice bar ──────────────────────────────────────────── */}
      {notice && (
        <div className={cn(
          "flex items-center justify-between gap-3 px-5 py-2.5 text-xs font-medium",
          notice.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
        )}>
          <span className="flex items-center gap-1.5">
            {notice.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            {notice.msg}
          </span>
          <button onClick={() => setNotice(null)} className="text-xs opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Calendar grid */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-slate-100 bg-white">
            {DOW_SHORT.map(d => (
              <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {d}
              </div>
            ))}
          </div>

          {/* Cells */}
          {loading ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-slate-400">
              <Loader2 size={20} className="animate-spin text-blue-500" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-7 divide-x divide-slate-100">
                {grid.map((day, i) => {
                  if (!day) return (
                    <div key={i} className="min-h-[88px] border-b border-slate-100 bg-slate-50/40" />
                  );
                  const evts       = byDay.get(toKey(day)) ?? [];
                  const isToday    = isSameDay(day, today);
                  const isSel      = isSameDay(day, selected);
                  const otherMonth = day.getMonth() !== month;

                  return (
                    <div
                      key={i}
                      onClick={() => setSelected(day)}
                      className={cn(
                        "min-h-[88px] cursor-pointer border-b border-slate-100 p-2 transition-colors",
                        isSel   ? "bg-blue-50"  : "hover:bg-slate-50",
                        otherMonth && "opacity-30"
                      )}
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                          isToday
                            ? "bg-slate-900 text-white"
                            : isSel
                              ? "bg-blue-600 text-white"
                              : "text-slate-600"
                        )}>
                          {day.getDate()}
                        </span>
                        {evts.length > 0 && (
                          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                            {evts.length}
                          </span>
                        )}
                      </div>

                      <div className="space-y-0.5">
                        {evts.slice(0, 2).map(e => {
                          const st = getStatus(e.start, e.end);
                          return (
                            <div
                              key={e.id}
                              className="flex items-center gap-1 rounded-md bg-white border border-slate-200 px-1.5 py-0.5 shadow-sm"
                              onClick={ev => { ev.stopPropagation(); setSelected(day); }}
                            >
                              <div className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", STATUS_DOT[st])} />
                              <span className="truncate text-[10px] font-medium text-slate-700">
                                {e.title || "Meeting"}
                              </span>
                            </div>
                          );
                        })}
                        {evts.length > 2 && (
                          <p className="pl-0.5 text-[10px] text-slate-400">+{evts.length - 2} more</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Day detail panel ────────────────────────────────── */}
        <div className="hidden w-80 flex-shrink-0 flex-col overflow-hidden border-l border-slate-100 bg-white md:flex">
          {/* Panel header */}
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {selected.toLocaleDateString("en-US", { weekday: "long" })}
            </p>
            <p className="text-lg font-bold text-slate-900">
              {selected.getDate()} {MONTHS[selected.getMonth()]}
              {selected.getFullYear() !== today.getFullYear() && ` ${selected.getFullYear()}`}
            </p>
          </div>

          {/* Event list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={18} className="animate-spin text-blue-500" />
              </div>
            ) : dayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
                <CalendarDays size={28} strokeWidth={1.5} className="text-slate-300" />
                <p className="text-sm font-medium text-slate-500">No meetings</p>
                <p className="text-xs text-slate-400">Tap + Schedule to add one</p>
                <button
                  onClick={() => setDialogOpen(true)}
                  className="mt-1 flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  <Plus size={12} /> Schedule
                </button>
              </div>
            ) : (
              dayEvents.map(evt => {
                const st  = getStatus(evt.start, evt.end);
                const cfg = STATUS_BADGE[st];
                const isBusy = busyBot === evt.id;

                return (
                  <div
                    key={evt.id}
                    className={cn(
                      "rounded-xl border p-3 transition-all",
                      st === "live"
                        ? "border-violet-200 bg-violet-50/40"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                    )}
                  >
                    {/* Title + badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">
                        {evt.title || "Untitled Meeting"}
                      </p>
                      <span className={cn(
                        "flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                        cfg.cls
                      )}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Time + meta */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-3">
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {formatTime(evt.start)}
                      </span>
                      {evt.attendees.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users size={11} /> {evt.attendees.length}
                        </span>
                      )}
                      {evt.platform && (
                        <span className="flex items-center gap-1">
                          <Video size={11} /> {evt.platform.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>

                    {/* Bot status */}
                    {evt.botSent && (
                      <div className="mb-2 flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                        <CheckCircle2 size={11} /> Bot active
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {evt.meetingUrl && (
                        <a
                          href={evt.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold transition",
                            st === "live"
                              ? "bg-violet-600 text-white hover:bg-violet-700"
                              : "bg-slate-900 text-white hover:bg-slate-800"
                          )}
                        >
                          Join
                        </a>
                      )}
                      <button
                        onClick={() => void sendBot(evt)}
                        disabled={evt.botSent || isBusy || !evt.meetingUrl}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        {isBusy
                          ? <Loader2 size={11} className="animate-spin" />
                          : <Bot size={11} />}
                        {evt.botSent ? "Sent" : "Send Bot"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile bottom sheet for selected day ────────────────── */}
      {dayEvents.length > 0 && (
        <div className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
          <p className="mb-2 text-xs font-semibold text-slate-500">
            {selected.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dayEvents.map(evt => (
              <div key={evt.id} className="w-44 flex-shrink-0 rounded-xl border border-slate-200 bg-white p-3">
                <p className="truncate text-xs font-semibold text-slate-800">{evt.title || "Meeting"}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{formatTime(evt.start)}</p>
                <div className="mt-2 flex gap-1.5">
                  {evt.meetingUrl && (
                    <a href={evt.meetingUrl} target="_blank" rel="noopener noreferrer"
                      className="flex-1 rounded-md bg-slate-900 py-1 text-center text-[10px] font-bold text-white">
                      Join
                    </a>
                  )}
                  <button
                    onClick={() => void sendBot(evt)}
                    disabled={evt.botSent || busyBot === evt.id}
                    className="flex-1 rounded-md border border-slate-200 py-1 text-[10px] font-bold text-slate-600 disabled:opacity-40"
                  >
                    {evt.botSent ? "Sent" : "Bot"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <MeetingDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => void fetchEvents()}
      />
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[calc(100vh-80px)] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-blue-500" />
      </div>
    }>
      <CalendarPageInner />
    </Suspense>
  );
}
