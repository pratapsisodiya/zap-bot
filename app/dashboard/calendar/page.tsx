"use client";

import { useEffect, useMemo, useState } from "react";
import Calendar from "react-calendar";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Link as LinkIcon,
  Loader2,
  Users,
  Video,
  Bot,
  ChevronRight,
  Plus,
  ArrowRight,
  Info,
  Globe
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { cn } from "@/lib/utils";

type MeetingEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  meetingUrl?: string;
  attendees: string[];
  organizer?: string;
  platform?: string;
  botScheduled?: boolean;
  botSent?: boolean;
  joinedConfirmed?: boolean;
  calendarSyncAt?: string | null;
};

const toDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatDateTime = (isoString: string) => {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const getMeetingStatus = (start: string, end: string) => {
  const now = new Date();
  const startTime = new Date(start);
  const endTime = new Date(end);
  if (now >= startTime && now <= endTime) return "now";
  if (now < startTime) return "upcoming";
  return "completed";
};

// --- ANIMATION VARIANTS ---
const stagger: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
};

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [events, setEvents] = useState<MeetingEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [sendingBotId, setSendingBotId] = useState<string | null>(null);
  const [botMessages, setBotMessages] = useState<Record<string, string>>({});
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetchCalendarEvents();
  }, [searchParams]);

  async function fetchCalendarEvents() {
    try {
      const res = await fetch("/api/calendar");
      if (!res.ok) {
        throw new Error(`Failed to fetch calendar: ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        setConnected(Boolean(data.connected));
        setEvents(Array.isArray(data.data) ? (data.data as MeetingEvent[]) : []);
        const oauthSuccess = searchParams.get("success");
        const oauthError = searchParams.get("error");
        if (oauthSuccess === "true") {
          setSyncMessage("Calendar connected successfully.");
        } else if (oauthError) {
          setSyncMessage(`Calendar connection issue: ${oauthError.replace(/_/g, " ")}`);
        } else if (typeof data.meta?.synced === "number") {
          setSyncMessage(data.connected ? `${data.meta.synced} meetings synced from calendar.` : "Connect Google Calendar to sync meetings.");
        }
      } else if (data.error) {
        setSyncMessage(data.error);
      }
    } catch (err) {
      console.error("Error fetching calendar:", err);
      setSyncMessage("Failed to load your calendar.");
    } finally {
      setLoading(false);
    }
  }

  async function syncCalendarNow() {
    setSyncing(true);
    setSyncMessage(null);

    try {
      const res = await fetch("/api/calendar", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to sync calendar");
      }

      const synced = Number(json.meta?.synced || 0);
      const botsDispatched = Number(json.meta?.botsDispatched || 0);
      setSyncMessage(`${synced} meetings synced. ${botsDispatched} bots dispatched.`);
      await fetchCalendarEvents();
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Failed to sync calendar");
    } finally {
      setSyncing(false);
    }
  }

  const eventsByDay = useMemo(() => {
    const map = new Map<string, MeetingEvent[]>();
    for (const evt of events) {
      const key = toDateKey(new Date(evt.start));
      const list = map.get(key) || [];
      list.push(evt);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const selectedDayEvents = useMemo(() => {
    return (eventsByDay.get(toDateKey(selectedDate)) || []).sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );
  }, [eventsByDay, selectedDate]);

  async function dispatchBotForEvent(evt: MeetingEvent) {
    if (!evt.meetingUrl || sendingBotId) return;

    setSendingBotId(evt.id);
    setBotMessages((prev) => ({ ...prev, [evt.id]: "Dispatching bot..." }));

    try {
      const res = await fetch(`/api/meetings/${evt.id}/bot-toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botScheduled: true,
          forceDispatch: true,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.warning || json?.error || "Failed to dispatch bot");
      }

      setBotMessages((prev) => ({ ...prev, [evt.id]: "Bot dispatched successfully." }));
      await fetchCalendarEvents();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to dispatch bot";
      setBotMessages((prev) => ({ ...prev, [evt.id]: message }));
    } finally {
      setSendingBotId(null);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans selection:bg-blue-200 relative">
      {/* SaaS Premium Background Gradient */}
      <div className="absolute top-0 inset-x-0 h-[800px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/50 via-white to-slate-50 -z-10 pointer-events-none" />

      {/* SIDEBAR: Navigation & Mini Calendar */}
      <aside className="w-80 flex flex-col border-r border-slate-200/80 bg-white/60 backdrop-blur-xl z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="p-6 border-b border-slate-200/80">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-blue-600" />
              Schedule
            </h2>
            {!connected && (
              <button onClick={() => window.location.href = "/api/calendar/connect"} className="p-1.5 rounded-lg border border-slate-200 bg-white hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm text-slate-500">
                <Plus size={16} />
              </button>
            )}
          </div>

          <div className="calendar-modern-wrap">
            <Calendar
              onChange={(value: unknown) => {
                const next = Array.isArray(value) ? value[0] : value;
                if (next instanceof Date) setSelectedDate(next);
              }}
              value={selectedDate}
              tileContent={({ date, view }: { date: Date; view: string }) => {
                if (view !== "month") return null;
                const hasEvents = eventsByDay.has(toDateKey(date));
                return hasEvents ? (
                  <div className="mt-1 flex justify-center absolute bottom-1 inset-x-0">
                    <div className="h-1 w-1 rounded-full bg-blue-500" />
                  </div>
                ) : null;
              }}
            />
          </div>
        </div>

        <div className="flex-1 p-6 space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-5 relative overflow-hidden group">
            {/* Decorative background accent */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-50 to-transparent rounded-bl-full opacity-50 pointer-events-none" />
            
            <div className="flex items-center gap-2 text-[12px] font-bold text-slate-900 mb-2 uppercase tracking-wide">
              <Globe className="w-4 h-4 text-blue-500" />
              Workspace Link
            </div>
            <p className="text-[13px] font-medium text-slate-500 leading-relaxed">
              {connected ? "Your calendar is actively syncing with ZapBot in real-time." : "Connect your calendar to let ZapBot automatically join meetings."}
            </p>
            {syncMessage && (
              <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                {syncMessage}
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN VIEW: Schedule Feed */}
      <main className="flex-1 flex flex-col min-w-0 z-10 relative">
        <header className="h-20 flex items-center justify-between px-8 border-b border-slate-200/80 bg-white/60 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </h1>
          </div>
          <div className="flex items-center gap-3">
             {connected && (
               <button
                 onClick={() => void syncCalendarNow()}
                 disabled={syncing}
                 className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:text-blue-600 disabled:opacity-50"
               >
                 {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                 Sync Now
               </button>
             )}
             {connected && (
               <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 shadow-sm">
                 <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[12px] font-bold text-emerald-700 tracking-wide">LIVE SYNC</span>
               </div>
             )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto w-full">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-40 text-slate-400">
                  <Loader2 className="animate-spin mb-4 text-blue-500" size={32} />
                  <p className="text-sm font-medium">Fetching your schedule...</p>
                </motion.div>
              ) : selectedDayEvents.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-40 text-center border-2 border-dashed border-slate-200 rounded-[2rem] bg-white/50">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 mb-6 shadow-sm">
                    <CalendarIcon className="text-slate-400" size={32} />
                  </div>
                  <h3 className="text-slate-900 text-xl font-bold tracking-tight">No meetings scheduled</h3>
                  <p className="text-slate-500 font-medium mt-2 max-w-sm">Enjoy your free time! ZapBot is resting and ready for your next sync.</p>
                </motion.div>
              ) : (
                <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4">
                  {selectedDayEvents.map((evt) => {
                    const status = getMeetingStatus(evt.start, evt.end);
                    const isNow = status === "now";
                    
                    return (
                      <motion.div
                        variants={fadeUpItem}
                        key={evt.id}
                        className={cn(
                          "group relative flex items-center gap-6 p-6 rounded-[1.5rem] border transition-all duration-300 overflow-hidden",
                          isNow 
                            ? "bg-blue-50/40 border-blue-200 shadow-md shadow-blue-900/5 ring-1 ring-blue-500/10" 
                            : "bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-900/5"
                        )}
                      >
                        {/* Status Highlight Bar */}
                        {isNow && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500" />}

                        {/* Timeline Marker */}
                        <div className="flex flex-col items-center w-16 text-center shrink-0">
                          <span className={cn(
                            "text-[13px] font-bold uppercase tracking-tight",
                            isNow ? "text-blue-700" : "text-slate-900"
                          )}>
                            {formatDateTime(evt.start).split(" ")[0]}
                          </span>
                          <span className={cn(
                            "text-[11px] font-semibold mt-0.5",
                            isNow ? "text-blue-500" : "text-slate-400"
                          )}>
                            {formatDateTime(evt.start).split(" ")[1]}
                          </span>
                        </div>

                        {/* Event Content */}
                        <div className="flex-1 min-w-0 py-1">
                          <h3 className="text-[17px] font-bold text-slate-900 truncate mb-2 tracking-tight">
                            {evt.title}
                          </h3>
                          <div className="flex items-center gap-4 text-[13px] font-medium text-slate-500">
                            <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                              <Users size={14} className="text-slate-400" />
                              {evt.attendees.length} participants
                            </span>
                            {evt.platform && (
                              <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 capitalize">
                                <Video size={14} className="text-slate-400" />
                                {evt.platform.replace(/_/g, " ")}
                              </span>
                            )}
                            {isNow && (
                              <span className="flex items-center gap-1.5 text-blue-600 font-bold uppercase tracking-widest text-[10px] bg-blue-100/50 px-2 py-1 rounded-md">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                In Progress
                              </span>
                            )}
                            {evt.botSent ? (
                              <span className="flex items-center gap-1.5 text-emerald-600 font-bold uppercase tracking-widest text-[10px] bg-emerald-50 px-2 py-1 rounded-md">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Bot Sent
                              </span>
                            ) : evt.botScheduled ? (
                              <span className="flex items-center gap-1.5 text-sky-600 font-bold uppercase tracking-widest text-[10px] bg-sky-50 px-2 py-1 rounded-md">
                                <Clock className="h-3.5 w-3.5" />
                                Auto Join On
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-amber-600 font-bold uppercase tracking-widest text-[10px] bg-amber-50 px-2 py-1 rounded-md">
                                <Info className="h-3.5 w-3.5" />
                                Needs Bot
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3 shrink-0">
                          {evt.meetingUrl && (
                            <a
                              href={evt.meetingUrl}
                              target="_blank"
                              className={cn(
                                "h-11 px-5 rounded-xl flex items-center gap-2 text-[13px] font-bold transition-all",
                                isNow 
                                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-[0_4px_14px_0_rgba(59,130,246,0.3)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.23)] hover:-translate-y-[1px]" 
                                  : "bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
                              )}
                            >
                              Join Meeting
                              <ChevronRight size={16} />
                            </a>
                          )}
                          <button
                            onClick={() => dispatchBotForEvent(evt)}
                            disabled={!evt.meetingUrl || evt.botSent || sendingBotId === evt.id}
                            className={cn(
                              "h-11 px-4 flex items-center gap-2 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed border",
                              isNow
                                ? "bg-white border-blue-200 text-blue-600 hover:bg-blue-50 shadow-sm"
                                : "bg-white border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 shadow-sm"
                            )}
                          >
                            <Bot size={18} />
                            <span className="text-[13px] font-bold hidden sm:block">{evt.botSent ? "Bot Sent" : "Send Agent"}</span>
                          </button>
                        </div>

                        {botMessages[evt.id] && (
                          <div className="absolute left-28 bottom-2 text-[11px] font-semibold text-blue-500 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            {botMessages[evt.id]}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .calendar-modern-wrap .react-calendar {
          width: 100%;
          background: transparent;
          border: none;
          font-family: inherit;
        }
        .calendar-modern-wrap .react-calendar__navigation {
          display: flex;
          margin-bottom: 1rem;
        }
        .calendar-modern-wrap .react-calendar__navigation button {
          min-width: 32px;
          height: 32px;
          background: none;
          border: none;
          color: #64748b;
          font-size: 15px;
          font-weight: 600;
          border-radius: 8px;
          transition: all 0.2s;
        }
        .calendar-modern-wrap .react-calendar__navigation button:hover {
          background: #f1f5f9;
          color: #0f172a;
        }
        .calendar-modern-wrap .react-calendar__month-view__weekdays {
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          margin-bottom: 12px;
        }
        .calendar-modern-wrap .react-calendar__month-view__weekdays__weekday abbr {
          text-decoration: none;
        }
        .calendar-modern-wrap .react-calendar__tile {
          padding: 10px 0;
          background: none;
          color: #334155;
          font-size: 13px;
          font-weight: 500;
          border-radius: 10px;
          transition: all 0.2s;
          position: relative;
        }
        .calendar-modern-wrap .react-calendar__tile:hover {
          background: #f1f5f9;
          color: #0f172a;
        }
        .calendar-modern-wrap .react-calendar__tile--now {
          background: #eff6ff !important;
          color: #2563eb !important;
          font-weight: 700;
        }
        .calendar-modern-wrap .react-calendar__tile--active {
          background: #2563eb !important;
          color: white !important;
          font-weight: 700;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }
        .calendar-modern-wrap .react-calendar__month-view__days__day--neighboringMonth {
          color: #cbd5e1 !important;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
}
