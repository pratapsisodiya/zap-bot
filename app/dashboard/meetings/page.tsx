"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Loader2,
  Video,
  RefreshCw,
  Plus,
  Bot,
  Square,
  Sparkles,
  ChevronRight,
  Check,
  X,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeetingsPipeline } from "./hooks/useMeetingsPipeline";
import MeetingDialog from "@/components/MeetingDialog";

const PLATFORM_LABELS: Record<string, string> = {
  google_meet: "Meet",
  zoom: "Zoom",
  microsoft_teams: "Teams",
  webex: "Webex",
  other: "Meeting",
  unknown: "Meeting",
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  completed:    { label: "Done",        className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  processing:   { label: "Processing",  className: "bg-blue-50 text-blue-700 border-blue-200" },
  in_meeting:   { label: "Live",        className: "bg-violet-50 text-violet-700 border-violet-200" },
  recording:    { label: "Recording",   className: "bg-orange-50 text-orange-700 border-orange-200" },
  failed:       { label: "Failed",      className: "bg-red-50 text-red-700 border-red-200" },
  pending:      { label: "Scheduled",   className: "bg-slate-50 text-slate-600 border-slate-200" },
};

function StatusBadge({ status }: { status?: string }) {
  const cfg = STATUS_CONFIG[status || ""] || STATUS_CONFIG.pending;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", cfg.className)}>
      {cfg.label}
    </span>
  );
}

function MeetingNotes({ meetingId, initialNotes }: { meetingId: string; initialNotes?: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/meetings/${meetingId}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: text }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    finally { setSaving(false); }
  }, [meetingId, text]);

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
      >
        <StickyNote size={12} />
        {open ? "Hide" : text ? "Notes" : "Add Note"}
      </button>
      {open && (
        <div className="mt-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Personal note..."
            rows={2}
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100"
          />
          <div className="mt-1 flex items-center justify-end gap-2">
            {saved && <span className="flex items-center gap-1 text-[11px] text-emerald-600"><Check size={10} /> Saved</span>}
            <button onClick={() => setOpen(false)} className="rounded px-2 py-0.5 text-[11px] text-slate-400 hover:text-slate-600">
              <X size={11} />
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {saving ? <Loader2 size={10} className="animate-spin" /> : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MeetingsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const {
    activeTab,
    currentList,
    isLoading,
    isProcessingMeetingId,
    isBotActionMeetingId,
    error,
    lastSyncedAt,
    setActiveTab,
    clearError,
    fetchMeetings,
    runAiPipeline,
    toggleMeetingBot,
    stopMeetingBot,
  } = useMeetingsPipeline();

  useEffect(() => { setActiveTab("past"); }, [setActiveTab]);

  const syncedLabel = useMemo(() =>
    lastSyncedAt ? format(new Date(lastSyncedAt), "MMM d, h:mm a") : "Never",
    [lastSyncedAt]
  );

  return (
    <div className="flex h-[calc(100vh-64px)] md:h-[calc(100vh-80px)] flex-col bg-white">
      {/* Top bar */}
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Meeting History</h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Last synced: {syncedLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchMeetings()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            onClick={() => setIsDialogOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
          >
            <Plus size={13} /> Schedule
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-100 px-5">
        {(["upcoming", "past"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === tab
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            {tab === "upcoming" ? "Upcoming" : "Completed"}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-5 mt-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={clearError} className="text-xs font-semibold text-red-500 hover:text-red-700">Dismiss</button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <p className="text-sm">Loading meetings...</p>
          </div>
        ) : currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
            <Video size={32} strokeWidth={1.5} className="text-slate-300" />
            <p className="text-sm font-medium">No meetings found</p>
            <p className="text-xs text-slate-400">
              {activeTab === "upcoming"
                ? "Schedule a meeting to get started"
                : "Completed meetings will appear here"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {currentList.map(meeting => {
              const platform = PLATFORM_LABELS[meeting.platform || "unknown"] || "Meeting";
              const dateStr = format(new Date(meeting.startTime), "MMM d, yyyy");
              const timeStr = format(new Date(meeting.startTime), "h:mm a");
              const isProcessing = isProcessingMeetingId === meeting.id;
              const isBotBusy = isBotActionMeetingId === meeting.id;

              return (
                <div
                  key={meeting.id}
                  className="group flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:gap-4"
                >
                  {/* Left: icon */}
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                    <Video size={16} strokeWidth={1.8} />
                  </div>

                  {/* Middle: info */}
                  <div className="flex flex-1 flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {meeting.title || "Untitled Meeting"}
                      </p>
                      <StatusBadge status={meeting.botStatus} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Calendar size={11} /> {dateStr}</span>
                      <span className="flex items-center gap-1"><Clock size={11} /> {timeStr}</span>
                      <span className="text-slate-300">·</span>
                      <span>{platform}</span>
                    </div>
                    {meeting.participants && meeting.participants.length > 0 && (
                      <div className="mt-0.5 flex items-center gap-1">
                        <div className="flex -space-x-1">
                          {meeting.participants.slice(0, 4).map((p: string, i: number) => (
                            <div key={i} className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[8px] font-bold text-slate-600 uppercase">
                              {p[0]}
                            </div>
                          ))}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {meeting.participants.length} participant{meeting.participants.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    )}
                    <div className="mt-1">
                      <MeetingNotes meetingId={meeting.id} initialNotes={(meeting as any).userNotes} />
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {activeTab === "upcoming" ? (
                      <>
                        {meeting.meetingUrl && (
                          <a
                            href={meeting.meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                          >
                            Join
                          </a>
                        )}
                        {meeting.botSent ? (
                          <button
                            onClick={() => void stopMeetingBot(meeting.id)}
                            disabled={isBotBusy}
                            className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 transition"
                          >
                            {isBotBusy ? <Loader2 size={12} className="animate-spin" /> : <Square size={11} fill="currentColor" />}
                            Stop
                          </button>
                        ) : (
                          <button
                            onClick={() => void toggleMeetingBot(meeting.id, true)}
                            disabled={isBotBusy}
                            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
                          >
                            {isBotBusy ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}
                            Send Bot
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        {!meeting.transcriptReady && !meeting.recordingUrl && (
                          <button
                            onClick={() => void runAiPipeline(meeting.id)}
                            disabled={isProcessing}
                            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
                          >
                            {isProcessing ? <Loader2 size={12} className="animate-spin text-blue-500" /> : <Sparkles size={12} className="text-blue-500" />}
                            Run AI
                          </button>
                        )}
                        <Link
                          href={`/dashboard/meetings/${meeting.id}`}
                          className={cn(
                            "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                            meeting.transcriptReady
                              ? "bg-[#1f2937] text-white hover:bg-[#111827]"
                              : "border border-[#e5e7eb] bg-white text-[#374151] hover:bg-slate-50"
                          )}
                        >
                          View <ChevronRight size={12} />
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <MeetingDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={() => void fetchMeetings()}
      />
    </div>
  );
}
