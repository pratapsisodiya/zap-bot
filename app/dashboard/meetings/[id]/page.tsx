import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import {
  ChevronLeft,
  Video,
  Calendar,
  Clock,
  Users,
  FileText,
  CheckSquare,
  Zap,
  Play,
  Download,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import MeetingDetailActions from "./MeetingDetailActions";

const PLATFORM_LABELS: Record<string, string> = {
  google_meet: "Google Meet",
  zoom: "Zoom",
  microsoft_teams: "Microsoft Teams",
  webex: "Webex",
  other: "Meeting",
  unknown: "Meeting",
};

const STATUS_STYLES: Record<string, { bar: string; badge: string }> = {
  completed:  { bar: "",                                                              badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  processing: { bar: "bg-blue-50 border-blue-200 text-blue-700",                     badge: "bg-blue-50 text-blue-700 border-blue-200" },
  in_meeting: { bar: "bg-violet-50 border-violet-200 text-violet-700",               badge: "bg-violet-50 text-violet-700 border-violet-200" },
  recording:  { bar: "bg-orange-50 border-orange-200 text-orange-700",               badge: "bg-orange-50 text-orange-700 border-orange-200" },
  failed:     { bar: "bg-red-50 border-red-200 text-red-700",                        badge: "bg-red-50 text-red-700 border-red-200" },
  pending:    { bar: "",                                                              badge: "bg-slate-50 text-slate-600 border-slate-200" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function formatDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTs(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

async function fetchMeeting(id: string) {
  try {
    const hdrs = await headers();
    const host = hdrs.get("x-forwarded-host") || hdrs.get("host");
    if (!host) return null;
    const proto = hdrs.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const cookie = hdrs.get("cookie") || "";
    const res = await fetch(`${proto}://${host}/api/meetings/${id}`, {
      cache: "no-store",
      headers: cookie ? { cookie } : undefined,
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const { id } = await params;
    const data = await fetchMeeting(id).catch(() => null);
    const title = data?.meeting?.title;
    return {
        title: title ? `${title} — ZapBot` : "Meeting Detail — ZapBot",
        description: "View transcript, AI summary, and action items for this meeting.",
    };
}

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchMeeting(id);

  if (!data) {
    return (
      <div className="flex h-[calc(100vh-80px)] flex-col items-center justify-center gap-4 px-4 text-center bg-[#f7f8fb]">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white border border-[#e6e8ee]">
          <Video size={24} className="text-[#9ca3af]" />
        </div>
        <h2 className="text-lg font-semibold text-[#111827]">Meeting not found</h2>
        <p className="max-w-xs text-sm text-[#6b7280]">
          This meeting may not exist or you don&apos;t have access to it.
        </p>
        <Link
          href="/dashboard/meetings"
          className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#1f2937] px-4 py-2 text-sm font-semibold text-white hover:bg-[#111827] transition"
        >
          <ChevronLeft size={15} /> Back to Meetings
        </Link>
      </div>
    );
  }

  const { meeting, transcript } = data;
  const entries: Array<{ speaker: string; text: string; startTime: number; endTime: number }> =
    transcript?.entries || [];
  const actionItems: string[] = Array.isArray(meeting.actionItems) ? meeting.actionItems : [];
  const participants: string[] = Array.isArray(meeting.participants) ? meeting.participants : [];
  const platform = PLATFORM_LABELS[meeting.platform as string] || "Meeting";
  const statusCfg = STATUS_STYLES[meeting.botStatus as string] || STATUS_STYLES.pending;
  const statusLabel = (meeting.botStatus as string || "pending").replace(/_/g, " ");
  const hasTranscript = entries.length > 0;

  return (
    <div className="flex h-[calc(100vh-64px)] md:h-[calc(100vh-80px)] w-full flex-col overflow-hidden bg-[#f7f8fb] px-4 py-4 md:px-6 md:py-5">
      <div className="custom-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto pr-1">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm font-medium text-[#6b7280]">
          <Link href="/dashboard/meetings" className="hover:text-[#111827] transition-colors">Meeting History</Link>
          <span>{">"}</span>
          <span className="truncate text-[#111827]">{(meeting.title as string) || "Untitled Meeting"}</span>
        </div>

        {/* Header card */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#e6e8ee] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <Video size={18} strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-[18px] font-bold text-[#111827]">
                {(meeting.title as string) || "Untitled Meeting"}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[#6b7280]">
                <span className="flex items-center gap-1"><Calendar size={13} /> {formatDate(meeting.startTime as string)}</span>
                {meeting.duration ? <span className="flex items-center gap-1"><Clock size={13} /> {formatDuration(meeting.duration as number)}</span> : null}
                <span className="flex items-center gap-1"><Video size={13} /> {platform}</span>
                {participants.length > 0 && <span className="flex items-center gap-1"><Users size={13} /> {participants.length} participants</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide capitalize", statusCfg.badge)}>
              {statusLabel}
            </span>
            {hasTranscript && (
              <Link
                href={`/dashboard/chat?id=${id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f2937] px-3 py-2 text-xs font-semibold text-white hover:bg-[#111827] transition"
              >
                <MessageSquare size={13} /> Chat with transcript
              </Link>
            )}
          </div>
        </div>

        {/* Status alerts */}
        {["joining", "in_meeting", "recording", "processing"].includes(meeting.botStatus as string) && (
          <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
            <p className="text-sm font-medium text-blue-700 capitalize">{statusLabel} — data will update automatically</p>
          </div>
        )}
        {meeting.botStatus === "failed" && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-600">{(meeting.processingError as string) || "Bot failed to join or process this meeting."}</p>
          </div>
        )}

        {/* Recording */}
        {meeting.recordingUrl && (
          <div className="rounded-xl border border-[#e6e8ee] bg-white p-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
              <Play size={12} /> Recording
            </p>
            <audio controls src={meeting.recordingUrl as string} className="w-full h-10" />
            <a
              href={meeting.recordingUrl as string}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:underline"
            >
              <Download size={12} /> Download
            </a>
          </div>
        )}

        {/* Summary */}
        <section className="rounded-xl border border-[#e6e8ee] bg-white p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#111827]">
            <Zap size={14} className="text-sky-500" /> AI Summary
          </h2>
          {meeting.summary ? (
            <p className="text-sm leading-relaxed text-[#4b5563]">{meeting.summary as string}</p>
          ) : (
            <p className="text-sm text-[#9ca3af]">
              {["processing", "in_meeting", "recording"].includes(meeting.botStatus as string)
                ? "Generating summary…"
                : "No summary available yet."}
            </p>
          )}
        </section>

        {/* Action Items */}
        {actionItems.length > 0 && (
          <section className="rounded-xl border border-[#e6e8ee] bg-white p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#111827]">
              <CheckSquare size={14} className="text-emerald-500" /> Action Items
            </h2>
            <div className="divide-y divide-[#f3f4f6]">
              {actionItems.map((item, i) => (
                <div key={i} className="flex items-start gap-3 py-2.5">
                  <div className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border border-[#d1d5db] bg-white" />
                  <p className="text-sm text-[#374151]">{item}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Transcript + sidebar */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Transcript */}
          <div className="lg:col-span-2 rounded-xl border border-[#e6e8ee] bg-white p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#111827]">
              <FileText size={14} className="text-[#9ca3af]" /> Transcript
              {entries.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-[#6b7280]">
                  {entries.length} lines
                </span>
              )}
            </h2>
            {entries.length > 0 ? (
              <div className="divide-y divide-[#f9fafb] max-h-[480px] overflow-y-auto -mx-4 px-4">
                {entries.map((entry, i) => (
                  <div key={i} className="flex gap-3 py-3 hover:bg-[#f9fafb] -mx-4 px-4 transition-colors rounded-lg">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-[#374151] uppercase">
                      {entry.speaker.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-[#111827]">{entry.speaker}</span>
                        <span className="flex-shrink-0 text-[10px] text-[#9ca3af]">{formatTs(entry.startTime)}</span>
                      </div>
                      <p className="text-sm text-[#4b5563] leading-relaxed">{entry.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#e6e8ee] bg-[#f7f8fb] p-6 text-center">
                <p className="text-sm text-[#9ca3af]">No transcript available.</p>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="flex flex-col gap-4">
            {participants.length > 0 && (
              <section className="rounded-xl border border-[#e6e8ee] bg-white p-4">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#111827]">
                  <Users size={14} className="text-[#9ca3af]" /> Participants
                </h2>
                <div className="divide-y divide-[#f3f4f6]">
                  {participants.map((name, i) => (
                    <div key={i} className="flex items-center gap-2.5 py-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-[#374151] uppercase">
                        {name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <span className="text-sm text-[#374151]">{name}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <MeetingDetailActions
              meetingId={id}
              title={(meeting.title as string) || "Meeting"}
              summary={(meeting.summary as string) || ""}
              transcriptEntries={entries}
              botStatus={meeting.botStatus as string}
              botSent={meeting.botSent as boolean}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
