"use client";

import { useState } from "react";
import { Copy, Download, RotateCw, Square, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Entry = { speaker: string; text: string; startTime: number; endTime: number };

function ts(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function MeetingDetailActions({
  meetingId,
  title,
  summary,
  transcriptEntries,
  botStatus,
  botSent,
}: {
  meetingId: string;
  title: string;
  summary?: string;
  transcriptEntries: Entry[];
  botStatus?: string;
  botSent?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ msg: string; ok: boolean } | null>(null);

  function flash(msg: string, ok: boolean) {
    setNotice({ msg, ok });
    setTimeout(() => setNotice(null), 3000);
  }

  async function reprocess() {
    setBusy("reprocess");
    try {
      const res = await fetch(`/api/meetings/${meetingId}/process`, { method: "POST" });
      const j = await res.json();
      if (!res.ok || !j?.success) throw new Error(j?.error || "Failed");
      flash("Re-processing started.", true);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Failed", false);
    } finally { setBusy(null); }
  }

  async function stopBot() {
    setBusy("stop");
    try {
      const res = await fetch(`/api/meetings/${meetingId}/stop-bot`, { method: "POST" });
      const j = await res.json();
      if (!res.ok || !j?.success) throw new Error(j?.error || "Failed");
      flash("Bot stopped.", true);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Failed", false);
    } finally { setBusy(null); }
  }

  async function copySummary() {
    if (!summary) { flash("No summary available.", false); return; }
    setBusy("copy");
    try {
      await navigator.clipboard.writeText(summary);
      flash("Summary copied.", true);
    } catch { flash("Copy failed.", false); }
    finally { setBusy(null); }
  }

  function exportTranscript() {
    if (!transcriptEntries.length) { flash("No transcript to export.", false); return; }
    const text = transcriptEntries
      .map(e => `[${ts(e.startTime)}] ${e.speaker}: ${e.text}`)
      .join("\n");
    const blob = new Blob([`${title}\n\n${text}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${meetingId}-transcript.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    flash("Exported.", true);
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-slate-700">Actions</h2>
      <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col gap-2">
        <button
          onClick={reprocess}
          disabled={busy !== null}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition"
        >
          {busy === "reprocess" ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
          Re-process
        </button>

        {botSent && botStatus !== "completed" && botStatus !== "failed" && (
          <button
            onClick={stopBot}
            disabled={busy !== null}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 transition"
          >
            {busy === "stop" ? <Loader2 size={12} className="animate-spin" /> : <Square size={11} fill="currentColor" />}
            Stop Bot
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={copySummary}
            disabled={busy !== null}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            {busy === "copy" ? <Loader2 size={11} className="animate-spin" /> : <Copy size={11} />}
            Copy
          </button>
          <button
            onClick={exportTranscript}
            disabled={busy !== null}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <Download size={11} />
            Export
          </button>
        </div>

        {notice && (
          <div className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
            notice.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"
          )}>
            {notice.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
            {notice.msg}
          </div>
        )}
      </div>
    </section>
  );
}
