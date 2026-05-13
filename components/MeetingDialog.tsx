"use client";

import { memo, useEffect, useState } from "react";
import {
  X, Loader2, Bot, Calendar, Clock, Link as LinkIcon,
  AlertCircle, CheckCircle2, Video, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MeetingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (data: any) => void;
}

interface FormData {
  meetingUrl: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  botName: string;
  recordingMode: "speaker_view" | "gallery_view";
}

interface FormErrors {
  meetingUrl?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
}

const PLATFORMS: Record<string, { label: string; color: string }> = {
  "Google Meet":      { label: "Google Meet",      color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  "Zoom":             { label: "Zoom",              color: "text-blue-600 bg-blue-50 border-blue-200" },
  "Microsoft Teams":  { label: "Microsoft Teams",   color: "text-violet-600 bg-violet-50 border-violet-200" },
  "WebEx":            { label: "Webex",             color: "text-orange-600 bg-orange-50 border-orange-200" },
  "LiveKit":          { label: "LiveKit",           color: "text-slate-600 bg-slate-50 border-slate-200" },
  "Other":            { label: "Other",             color: "text-slate-500 bg-slate-50 border-slate-200" },
};

function detectPlatform(url: string) {
  if (url.includes("meet.google.com")) return "Google Meet";
  if (url.includes("zoom.us")) return "Zoom";
  if (url.includes("teams.microsoft.com")) return "Microsoft Teams";
  if (url.includes("webex.com")) return "WebEx";
  if (url.includes("livekit:")) return "LiveKit";
  return "Other";
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
      {children}
      {required && <span className="ml-0.5 text-red-400">*</span>}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-red-500">
      <AlertCircle size={11} /> {msg}
    </p>
  );
}

function MeetingDialog({ isOpen, onClose, onSuccess }: MeetingDialogProps) {
  const [form, setForm] = useState<FormData>({
    meetingUrl: "", title: "", description: "",
    startTime: "", endTime: "",
    botName: "User Agent Bot",
    recordingMode: "speaker_view",
  });
  const [errors, setErrors]       = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep]           = useState<"form" | "dispatching" | "success" | "error">("form");
  const [errMsg, setErrMsg]       = useState("");
  const [successData, setSuccessData] = useState<any>(null);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    fetch("/api/user/bot-settings")
      .then(r => r.json())
      .then(j => { if (alive && j?.success && j?.data?.botName) setForm(f => ({ ...f, botName: j.data.botName })); })
      .catch(() => {});
    return () => { alive = false; };
  }, [isOpen]);

  function validate(): boolean {
    const e: FormErrors = {};
    if (!form.meetingUrl.trim()) e.meetingUrl = "Meeting URL is required";
    else if (!/^https?:\/\//i.test(form.meetingUrl)) e.meetingUrl = "Enter a valid URL starting with https://";
    if (!form.title.trim()) e.title = "Meeting title is required";
    if (!form.startTime) e.startTime = "Start time is required";
    if (!form.endTime) e.endTime = "End time is required";
    else if (form.startTime && new Date(form.endTime) <= new Date(form.startTime))
      e.endTime = "End time must be after start time";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setStep("dispatching");
    try {
      const res = await fetch("/api/bot/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingUrl: form.meetingUrl,
          title: form.title,
          description: form.description || undefined,
          startTime: new Date(form.startTime).toISOString(),
          endTime: new Date(form.endTime).toISOString(),
          botName: form.botName,
          recordingMode: form.recordingMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dispatch bot");
      setSuccessData(data);
      setStep("success");
      onSuccess?.(data);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Failed to dispatch bot");
      setStep("error");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setForm(f => ({ ...f, meetingUrl: "", title: "", description: "", startTime: "", endTime: "", recordingMode: "speaker_view" }));
    setErrors({}); setStep("form"); setErrMsg(""); setSuccessData(null);
  }

  function handleClose() {
    if (submitting) return;
    reset(); onClose();
  }

  if (!isOpen) return null;

  const platform = form.meetingUrl ? detectPlatform(form.meetingUrl) : null;
  const platformCfg = platform ? PLATFORMS[platform] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={handleClose} />

      {/* Sheet */}
      <div className={cn(
        "relative z-10 w-full bg-white shadow-2xl",
        "sm:max-w-lg sm:rounded-2xl sm:border sm:border-slate-200",
        "rounded-t-2xl border-t border-slate-200",
        "max-h-[92dvh] flex flex-col overflow-hidden"
      )}>

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
              <Bot size={17} className="text-slate-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {step === "form"        && "Schedule Meeting"}
                {step === "dispatching" && "Dispatching Bot…"}
                {step === "success"     && "Bot Dispatched"}
                {step === "error"       && "Something went wrong"}
              </h2>
              <p className="text-xs text-slate-400">
                {step === "form"        && "Set up your meeting and send a bot automatically"}
                {step === "dispatching" && "Configuring your meeting agent"}
                {step === "success"     && "Bot will join at the scheduled time"}
                {step === "error"       && "Review the error and try again"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">

          {/* ── FORM ─────────────────────────────────────────── */}
          {step === "form" && (
            <form onSubmit={handleSubmit} id="meeting-form" className="space-y-4">

              {/* Meeting URL */}
              <div>
                <Label required>Meeting URL</Label>
                <div className="relative">
                  <LinkIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={form.meetingUrl}
                    onChange={e => setForm({ ...form, meetingUrl: e.target.value })}
                    placeholder="https://meet.google.com/abc-defg-hij"
                    className={cn(
                      "w-full rounded-lg border py-2.5 pl-8 pr-3 text-sm text-slate-800 placeholder:text-slate-300 outline-none transition",
                      "focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400",
                      errors.meetingUrl
                        ? "border-red-300 bg-red-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                  />
                </div>
                {errors.meetingUrl
                  ? <FieldError msg={errors.meetingUrl} />
                  : platform && platformCfg && (
                    <span className={cn("mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", platformCfg.color)}>
                      <Video size={10} /> {platformCfg.label}
                    </span>
                  )
                }
              </div>

              {/* Title */}
              <div>
                <Label required>Meeting Title</Label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Weekly Team Standup"
                  maxLength={120}
                  className={cn(
                    "w-full rounded-lg border py-2.5 px-3 text-sm text-slate-800 placeholder:text-slate-300 outline-none transition",
                    "focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400",
                    errors.title
                      ? "border-red-300 bg-red-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                />
                <FieldError msg={errors.title} />
              </div>

              {/* Description */}
              <div>
                <Label>Description <span className="font-normal text-slate-400">(optional)</span></Label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Add notes about this meeting…"
                  rows={2}
                  maxLength={2000}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 outline-none hover:border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                />
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label required>Start Time</Label>
                  <div className="relative">
                    <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="datetime-local"
                      value={form.startTime}
                      onChange={e => setForm({ ...form, startTime: e.target.value })}
                      className={cn(
                        "w-full rounded-lg border py-2.5 pl-8 pr-2 text-sm text-slate-800 outline-none transition",
                        "focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400",
                        errors.startTime
                          ? "border-red-300 bg-red-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      )}
                    />
                  </div>
                  <FieldError msg={errors.startTime} />
                </div>
                <div>
                  <Label required>End Time</Label>
                  <div className="relative">
                    <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="datetime-local"
                      value={form.endTime}
                      onChange={e => setForm({ ...form, endTime: e.target.value })}
                      className={cn(
                        "w-full rounded-lg border py-2.5 pl-8 pr-2 text-sm text-slate-800 outline-none transition",
                        "focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400",
                        errors.endTime
                          ? "border-red-300 bg-red-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      )}
                    />
                  </div>
                  <FieldError msg={errors.endTime} />
                </div>
              </div>

              {/* Bot config row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Agent Identity</Label>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <Bot size={13} className="flex-shrink-0 text-slate-400" />
                    <span className="truncate text-sm text-slate-600">{form.botName}</span>
                  </div>
                </div>
                <div>
                  <Label>Recording Mode</Label>
                  <div className="relative">
                    <select
                      value={form.recordingMode}
                      onChange={e => setForm({ ...form, recordingMode: e.target.value as "speaker_view" | "gallery_view" })}
                      className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-sm text-slate-700 outline-none hover:border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                    >
                      <option value="speaker_view">Speaker View</option>
                      <option value="gallery_view">Gallery View</option>
                    </select>
                    <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* ── DISPATCHING ──────────────────────────────────── */}
          {step === "dispatching" && (
            <div className="flex flex-col items-center justify-center py-10 gap-5">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-[3px] border-slate-100 border-t-slate-800 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Bot size={22} className="text-slate-700" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-800">Sending {form.botName}…</p>
                <p className="mt-1 text-xs text-slate-400">Configuring recording and joining the meeting</p>
              </div>
              <div className="w-full max-w-xs space-y-2.5">
                {[
                  { label: "Validating meeting URL",   done: true,  active: false },
                  { label: "Dispatching bot",          done: false, active: true  },
                  { label: "Confirming bot joined",    done: false, active: false },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    {s.done
                      ? <CheckCircle2 size={14} className="flex-shrink-0 text-emerald-500" />
                      : s.active
                        ? <Loader2 size={14} className="flex-shrink-0 animate-spin text-blue-500" />
                        : <div className="h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 border-slate-200" />
                    }
                    <span className={s.done ? "text-slate-800" : s.active ? "text-slate-700 font-medium" : "text-slate-400"}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SUCCESS ──────────────────────────────────────── */}
          {step === "success" && successData && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <CheckCircle2 size={16} className="flex-shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Meeting scheduled successfully</p>
                  <p className="text-xs text-emerald-600">{form.botName} will join at the scheduled time</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-100">
                {[
                  { label: "Title",    value: successData.data.meeting?.title || form.title },
                  { label: "Bot ID",   value: successData.data.botId, mono: true },
                  { label: "Platform", value: platform },
                  { label: "Status",   value: "Bot Dispatched", green: true },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between px-3 py-2.5">
                    <span className="text-xs text-slate-400">{row.label}</span>
                    <span className={cn(
                      "text-xs font-semibold",
                      row.mono  ? "font-mono text-blue-600" :
                      row.green ? "text-emerald-600" :
                      "text-slate-700"
                    )}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ERROR ────────────────────────────────────────── */}
          {step === "error" && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-semibold text-red-700">Failed to dispatch bot</p>
                <p className="mt-0.5 text-xs text-red-500">{errMsg}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="border-t border-slate-100 px-5 py-4">
          {step === "form" && (
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="meeting-form"
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
              >
                <Bot size={14} /> Schedule Bot
              </button>
            </div>
          )}

          {step === "dispatching" && (
            <button disabled className="w-full rounded-lg bg-slate-100 py-2.5 text-sm font-medium text-slate-400 cursor-not-allowed">
              Please wait…
            </button>
          )}

          {step === "success" && (
            <div className="flex gap-2.5">
              <button
                onClick={reset}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                Schedule Another
              </button>
              <button
                onClick={handleClose}
                className="flex-1 rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
              >
                Done
              </button>
            </div>
          )}

          {step === "error" && (
            <div className="flex gap-2.5">
              <button
                onClick={reset}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                Try Again
              </button>
              <button
                onClick={handleClose}
                className="flex-1 rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(MeetingDialog);
