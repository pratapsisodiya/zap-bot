"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "../../../lib/utils";
import { Layout, List, BarChart3, Brain, ClipboardCheck, Star, Mail, Zap, MessageSquare, Quote, Bot, Mic, FileText, Cpu, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";

// ── Transcript pipeline status tracker ──────────────────────────────

type StepState = "done" | "active" | "pending" | "failed";

interface PipelineStep {
    key: string;
    label: string;
    sublabel: string;
    icon: React.ElementType;
    state: StepState;
}

function buildPipelineSteps(meeting: any): PipelineStep[] {
    const status = meeting.botStatus || "pending";
    const failed = status === "failed";
    const noTranscript = status === "completed_no_transcript";

    const isDone   = (s: string) => (s as StepState) === "done";
    const isActive = (s: string) => (s as StepState) === "active";

    const dispatched = meeting.botSent || meeting.botScheduled || status !== "pending";
    const joined     = meeting.botJoinedAt || ["in_meeting", "recording", "processing", "completed", "completed_no_transcript"].includes(status);
    const recorded   = meeting.meetingEnded  || ["processing", "completed", "completed_no_transcript"].includes(status);
    const transcribed = meeting.transcriptReady || ["processing", "completed"].includes(status);
    const processed  = meeting.processed || status === "completed";

    function stepState(reached: boolean, isCurrentlyActive: boolean): StepState {
        if (failed && isCurrentlyActive) return "failed";
        if (noTranscript && isCurrentlyActive) return "failed";
        if (reached && !isCurrentlyActive) return "done";
        if (isCurrentlyActive) return "active";
        return "pending";
    }

    return [
        {
            key: "dispatched",
            label: "Bot Dispatched",
            sublabel: dispatched ? "Sent to meeting" : "Waiting to send",
            icon: Bot,
            state: dispatched ? "done" : (status === "pending" ? "active" : "pending"),
        },
        {
            key: "joined",
            label: "Joined Meeting",
            sublabel: joined ? "Bot is inside" : "Joining room",
            icon: Mic,
            state: joined
                ? "done"
                : (status === "joining" ? (failed ? "failed" : "active") : "pending"),
        },
        {
            key: "recorded",
            label: "Recording Done",
            sublabel: recorded ? "Session captured" : "Recording in progress",
            icon: FileText,
            state: recorded
                ? "done"
                : (["in_meeting", "recording"].includes(status) ? "active" : "pending"),
        },
        {
            key: "transcribed",
            label: "Transcript Ready",
            sublabel: noTranscript
                ? "No audio detected"
                : transcribed ? "Text extracted" : "Transcribing audio",
            icon: MessageSquare,
            state: noTranscript
                ? "failed"
                : transcribed
                    ? "done"
                    : (status === "processing" ? "active" : "pending"),
        },
        {
            key: "processed",
            label: "AI Analysis",
            sublabel: processed ? "Summary ready" : "Running AI pipeline",
            icon: Cpu,
            state: processed
                ? "done"
                : (status === "processing" && transcribed ? "active" : "pending"),
        },
    ];
}

function StepIcon({ state, Icon }: { state: StepState; Icon: React.ElementType }) {
    if (state === "done")   return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    if (state === "failed") return <XCircle className="w-4 h-4 text-red-400" />;
    if (state === "active") return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
    return <Icon className="w-4 h-4 text-zinc-600" />;
}

function TranscriptStatusTracker({ meeting }: { meeting: any }) {
    const steps = buildPipelineSteps(meeting);
    const status = meeting.botStatus || "pending";
    const failed = status === "failed";
    const noTranscript = status === "completed_no_transcript";
    const completed = status === "completed";

    const overallLabel = completed
        ? "Transcript ready"
        : failed
        ? "Bot failed — check meeting URL or bot quota"
        : noTranscript
        ? "Meeting ended with no audio"
        : status === "processing"
        ? "Analysing transcript…"
        : status === "recording" || status === "in_meeting"
        ? "Recording in progress"
        : status === "joining"
        ? "Bot is joining the meeting"
        : "Waiting for bot to start";

    const overallColor = completed
        ? "text-emerald-400"
        : failed || noTranscript
        ? "text-red-400"
        : "text-blue-400";

    return (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 mb-6">
            {/* Header row */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-zinc-500" />
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Transcript Pipeline</span>
                </div>
                <span className={cn("text-[11px] font-bold uppercase tracking-widest", overallColor)}>
                    {overallLabel}
                </span>
            </div>

            {/* Steps */}
            <div className="flex items-start gap-0">
                {steps.map((step, i) => {
                    const isLast = i === steps.length - 1;
                    return (
                        <div key={step.key} className="flex items-center flex-1 min-w-0">
                            {/* Step node */}
                            <div className="flex flex-col items-center gap-1.5 shrink-0">
                                <div className={cn(
                                    "w-8 h-8 rounded-full border flex items-center justify-center transition-all",
                                    step.state === "done"   && "border-emerald-500/40 bg-emerald-500/10",
                                    step.state === "active" && "border-blue-500/40 bg-blue-500/10 shadow-[0_0_12px_rgba(59,130,246,0.2)]",
                                    step.state === "failed" && "border-red-500/40 bg-red-500/10",
                                    step.state === "pending" && "border-zinc-800 bg-zinc-900",
                                )}>
                                    <StepIcon state={step.state} Icon={step.icon} />
                                </div>
                                <div className="text-center px-1">
                                    <p className={cn(
                                        "text-[10px] font-bold uppercase tracking-wider leading-tight",
                                        step.state === "done"    && "text-emerald-400",
                                        step.state === "active"  && "text-blue-400",
                                        step.state === "failed"  && "text-red-400",
                                        step.state === "pending" && "text-zinc-600",
                                    )}>{step.label}</p>
                                    <p className="text-[9px] text-zinc-600 font-medium mt-0.5 leading-tight hidden sm:block">
                                        {step.sublabel}
                                    </p>
                                </div>
                            </div>

                            {/* Connector line */}
                            {!isLast && (
                                <div className={cn(
                                    "flex-1 h-px mx-2 mt-[-20px] transition-all",
                                    step.state === "done" ? "bg-emerald-500/30" : "bg-zinc-800"
                                )} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Error detail */}
            {(failed || noTranscript) && meeting.processingError && (
                <div className="mt-4 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10 text-[11px] text-red-400 font-mono break-all">
                    {meeting.processingError}
                </div>
            )}
        </div>
    );
}

export function MeetingTabs({
    meeting: initialMeeting,
    transcript: initialTranscript,
    formatTimestamp,
    getInitials,
    meetingId,
    onSeek
}: {
    meeting: any;
    transcript: any;
    formatTimestamp: (s: number) => string;
    getInitials: (n: string) => string;
    meetingId: string;
    onSeek?: (seconds: number) => void;
}) {
    const [activeTab, setActiveTab] = useState<"summary" | "transcript" | "insights">("summary");
    const [meeting, setMeeting] = useState(initialMeeting);
    const [transcript, setTranscript] = useState(initialTranscript);
    const [analytics, setAnalytics] = useState<any>(null);

    // Load completed action items from local storage
    const [completedItems, setCompletedItems] = useState<number[]>([]);
    
    useEffect(() => {
        if (meetingId) {
            const saved = localStorage.getItem(`zapbot_checked_${meetingId}`);
            if (saved) {
                try {
                    setCompletedItems(JSON.parse(saved));
                } catch {
                    console.error("Failed to parse saved action items");
                }
            }
        }
    }, [meetingId]);

    const toggleActionItem = (index: number) => {
        const newCompleted = completedItems.includes(index) 
            ? completedItems.filter(i => i !== index)
            : [...completedItems, index];
        setCompletedItems(newCompleted);
        localStorage.setItem(`zapbot_checked_${meetingId}`, JSON.stringify(newCompleted));
    };

    const actionItems = useMemo(() => {
        if (!Array.isArray(meeting.actionItems)) return [];

        return meeting.actionItems
            .map((item: any) => {
                if (typeof item === "string") return item.trim();
                if (typeof item?.text === "string") return item.text.trim();
                if (typeof item?.title === "string") return item.title.trim();
                if (typeof item?.action === "string") return item.action.trim();
                return "";
            })
            .filter((item: string) => Boolean(item));
    }, [meeting.actionItems]);

    const highlights = useMemo(() => {
        if (!Array.isArray(meeting.highlights)) return [];

        return meeting.highlights
            .map((item: any) => {
                if (typeof item === "string") {
                    return item.trim() ? { text: item.trim(), timestamp: 0 } : null;
                }

                const text = typeof item?.text === "string"
                    ? item.text.trim()
                    : typeof item?.title === "string"
                        ? item.title.trim()
                        : "";

                if (!text) return null;

                const timestamp = typeof item?.timestamp === "number"
                    ? item.timestamp
                    : typeof item?.startTime === "number"
                        ? item.startTime
                        : 0;

                return {
                    text,
                    timestamp: Math.max(0, timestamp),
                };
            })
            .filter((item: { text: string; timestamp: number } | null): item is { text: string; timestamp: number } => Boolean(item));
    }, [meeting.highlights]);

    // Poll for updates if the meeting is in progress
    useEffect(() => {
        const isInProgress = ["joining", "in_meeting", "recording", "processing"].includes(meeting.botStatus);
        if (!isInProgress) return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/meetings/${meetingId}`);
                if (res.ok) {
                    const json = await res.json();
                    if (json.success && json.data) {
                        setMeeting(json.data.meeting);
                        setTranscript(json.data.transcript);
                    }
                }
            } catch (err) {
                console.error("Failed to poll meeting updates:", err);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [meeting.botStatus, meetingId]);

    useEffect(() => {
        let mounted = true;

        async function fetchAnalytics() {
            try {
                const res = await fetch(`/api/meetings/${meetingId}/analytics`, { cache: "no-store" });
                if (!res.ok) return;
                const json = await res.json();
                if (mounted && json?.success) {
                    setAnalytics(json.data);
                }
            } catch (err) {
                console.error("Failed to load meeting analytics:", err);
            }
        }

        void fetchAnalytics();
        const interval = setInterval(fetchAnalytics, 10000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [meetingId]);

    // Calculate participation
    const participation = transcript?.entries ?
        transcript.entries.reduce((acc: any, curr: any) => {
            acc[curr.speaker] = (acc[curr.speaker] || 0) + 1;
            return acc;
        }, {}) : {};

    const totalEntries = transcript?.entries?.length || 0;

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center p-1 bg-zinc-900 border border-white/5 rounded-xl w-fit">
                {[
                    { id: "summary", label: "Summary", icon: Layout },
                    { id: "transcript", label: "Transcript", icon: List },
                    { id: "insights", label: "Insights", icon: BarChart3 }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-tighter italic",
                            activeTab === tab.id
                                ? "bg-white text-black shadow-lg"
                                : "text-zinc-500 hover:text-white"
                        )}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === "summary" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="pro-card p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <Brain className="w-5 h-5 text-white" />
                            <h2 className="text-xl font-bold text-white italic tracking-tight">AI Intelligence</h2>
                        </div>
                        {meeting.summary ? (
                            <p className="text-zinc-400 text-sm leading-relaxed font-medium">
                                {meeting.summary as string}
                            </p>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-zinc-600 gap-3 border border-dashed border-white/5 rounded-xl bg-white/2">
                                <Zap className="w-6 h-6 animate-pulse" />
                                <p className="text-xs font-bold uppercase tracking-widest italic">
                                    {(meeting.botStatus === "completed" || meeting.botStatus === "processing")
                                        ? "Distilling meeting intelligence..."
                                        : "Waiting for wrap-up..."}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="pro-card p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <ClipboardCheck className="w-5 h-5 text-white" />
                                <h2 className="text-xl font-bold text-white italic tracking-tight">Decisions</h2>
                            </div>
                            {actionItems.length > 0 ? (
                                <ul className="space-y-4">
                                    {actionItems.map((item: string, i: number) => {
                                        const isChecked = completedItems.includes(i);
                                        return (
                                            <li 
                                                key={i} 
                                                className="flex items-start gap-4 group cursor-pointer w-fit max-w-full"
                                                onClick={() => toggleActionItem(i)}
                                            >
                                                <div className={cn(
                                                    "w-6 h-6 rounded-md border shrink-0 mt-0.5 transition-all flex items-center justify-center",
                                                    isChecked 
                                                        ? "bg-[#0058be] border-[#0058be]" 
                                                        : "border-white/10 bg-white/5 group-hover:border-white/30"
                                                )}>
                                                    <ClipboardCheck className={cn(
                                                        "w-3.5 h-3.5 text-white transition-opacity", 
                                                        isChecked ? "opacity-100" : "opacity-0"
                                                    )} />
                                                </div>
                                                <span className={cn(
                                                    "text-sm font-medium transition-all",
                                                    isChecked 
                                                        ? "text-zinc-600 line-through" 
                                                        : "text-zinc-400 group-hover:text-white"
                                                )}>
                                                    {item}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest italic">No items distilled.</p>
                            )}
                        </div>

                        <div className="pro-card p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <Star className="w-5 h-5 text-white" />
                                <h2 className="text-xl font-bold text-white italic tracking-tight">Key Moments</h2>
                            </div>
                            {highlights.length > 0 ? (
                                <div className="space-y-6">
                                    {highlights.map((h: { text: string; timestamp: number }, i: number) => (
                                        <div key={i} className="flex flex-col gap-2 group">
                                            <p className="text-sm font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors line-clamp-2">
                                                &ldquo;{h.text}&rdquo;
                                            </p>
                                            {h.timestamp > 0 && (
                                                <button
                                                    onClick={() => onSeek?.(h.timestamp)}
                                                    className="text-[10px] font-bold text-zinc-500 hover:text-white flex items-center gap-1.5 uppercase tracking-tighter w-fit transition-colors"
                                                >
                                                    <Zap className="w-3 h-3" />
                                                    Jump to {formatTimestamp(h.timestamp)}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest italic">No highlights recorded.</p>
                            )}
                        </div>
                    </div>

                    {meeting.followUpDraft && (
                        <div className="pro-card p-8 border-white/20 bg-white/[0.03]">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <Mail className="w-5 h-5 text-white" />
                                    <h2 className="text-xl font-bold text-white italic tracking-tight">Follow-up Blueprint</h2>
                                </div>
                                <span className="text-[10px] font-bold bg-white text-black px-2 py-0.5 rounded uppercase tracking-tighter italic">Enterprise</span>
                            </div>
                            <div className="relative group">
                                <pre className="p-6 rounded-xl bg-black border border-white/5 text-xs text-zinc-400 font-mono leading-relaxed whitespace-pre-wrap">
                                    {meeting.followUpDraft}
                                </pre>
                                <button className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100">
                                    <ClipboardCheck className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === "transcript" && (
                <div className="pro-card p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <MessageSquare className="w-5 h-5 text-white" />
                            <h2 className="text-xl font-bold text-white italic tracking-tight">Dialogue</h2>
                            {transcript?.entries && transcript.entries.length > 0 && (
                                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest bg-zinc-900 border border-white/5 px-2 py-0.5 rounded ml-2">
                                    {transcript.entries.length} Lines
                                </span>
                            )}
                        </div>
                        {["joining", "in_meeting", "recording"].includes(meeting.botStatus) && (
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-widest animate-pulse border border-emerald-500/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                Syncing Live
                            </div>
                        )}
                    </div>

                    {/* Pipeline status — always visible when transcript not ready yet */}
                    {(!transcript?.entries || transcript.entries.length === 0) && (
                        <TranscriptStatusTracker meeting={meeting} />
                    )}

                    {transcript?.entries && transcript.entries.length > 0 ? (
                        <div className="space-y-2 h-[600px] overflow-y-auto pr-4 custom-scrollbar">
                            {transcript.entries.map((entry: any, i: number) => (
                                <div key={i} className="flex gap-6 group p-4 rounded-xl hover:bg-white/2 transition-colors border border-transparent hover:border-white/5">
                                    <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500 shrink-0 group-hover:border-white/10 transition-all">
                                        {getInitials(entry.speaker)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-bold text-white italic">{entry.speaker}</span>
                                            <button
                                                onClick={() => onSeek?.(entry.startTime)}
                                                className="text-[10px] font-bold text-zinc-600 hover:text-white tracking-widest transition-colors uppercase"
                                            >
                                                {formatTimestamp(entry.startTime)}
                                            </button>
                                        </div>
                                        <p className="text-zinc-400 text-sm font-medium leading-relaxed group-hover:text-zinc-300 transition-colors">
                                            {entry.text}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                            <Quote className="w-8 h-8 text-zinc-800" />
                            <p className="text-xs text-zinc-600 font-medium uppercase tracking-widest">
                                Transcript lines will appear here once ready.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === "insights" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="pro-card p-8 flex flex-col gap-8">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest italic">Health Score</h2>
                                <span className={cn(
                                    "text-lg font-bold italic",
                                    (meeting.healthScore || 0) >= 7 ? 'text-emerald-500' : (meeting.healthScore || 0) >= 4 ? 'text-amber-500' : 'text-red-500'
                                )}>
                                    {(meeting.healthScore || 0).toFixed(1)}<span className="text-xs text-zinc-600 ml-0.5">/10</span>
                                </span>
                            </div>
                            <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-white transition-all duration-1000"
                                    style={{ width: `${(meeting.healthScore || 0) * 10}%` }}
                                />
                            </div>
                            <p className="text-xs font-medium text-zinc-400 leading-relaxed italic">
                                {meeting.healthScore >= 8 ? "Peak productivity. All channels open and active." : "Nominal performance detected."}
                            </p>
                        </div>

                        <div className="pro-card p-8 flex flex-col gap-6">
                            <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest italic">Tone Analysis</h2>
                            <div className="flex items-center gap-6 mt-2">
                                <div className="w-14 h-14 rounded-2xl bg-white/3 border border-white/10 flex items-center justify-center text-2xl shadow-2xl">
                                    {(meeting.healthScore || 0) > 7 ? "⚡" : "🤝"}
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-lg font-bold text-white italic leading-none">{meeting.sentiment || "Unknown"}</span>
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Overall Atmosphere</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="pro-card p-5">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Turns</p>
                            <p className="text-2xl font-bold text-white mt-2">{analytics?.totals?.turns ?? totalEntries}</p>
                        </div>
                        <div className="pro-card p-5">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Words</p>
                            <p className="text-2xl font-bold text-white mt-2">{analytics?.totals?.words ?? 0}</p>
                        </div>
                        <div className="pro-card p-5">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Questions</p>
                            <p className="text-2xl font-bold text-white mt-2">{analytics?.totals?.questions ?? 0}</p>
                        </div>
                        <div className="pro-card p-5">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">RAG</p>
                            <p className={cn("text-lg font-bold mt-2", analytics?.pipeline?.ragReady ? "text-emerald-400" : "text-amber-400")}>
                                {analytics?.pipeline?.ragReady ? "Ready" : "Indexing"}
                            </p>
                        </div>
                    </div>

                    <div className="pro-card p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <Zap className="w-5 h-5 text-white" />
                            <h2 className="text-xl font-bold text-white italic tracking-tight">Processing Pipeline</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                            {[
                                { key: "botDispatched", label: "Bot Dispatched", done: analytics?.pipeline?.botDispatched },
                                { key: "joinedConfirmed", label: "Join Confirmed", done: analytics?.pipeline?.joinedConfirmed },
                                { key: "meetingCompleted", label: "Meeting Complete", done: analytics?.pipeline?.meetingCompleted },
                                { key: "transcriptReady", label: "Transcript Ready", done: analytics?.pipeline?.transcriptReady },
                                { key: "recordingStoredInR2", label: "Stored In R2", done: analytics?.pipeline?.recordingStoredInR2 },
                                { key: "ragReady", label: "RAG Indexed", done: analytics?.pipeline?.ragReady },
                            ].map((item) => (
                                <div
                                    key={item.key}
                                    className={cn(
                                        "rounded-xl border px-3 py-3 text-xs font-bold uppercase tracking-wider",
                                        item.done
                                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                            : "border-zinc-800 bg-zinc-900 text-zinc-500"
                                    )}
                                >
                                    {item.done ? "Completed" : "Pending"}
                                    <div className="mt-1 text-[10px] tracking-normal font-semibold">
                                        {item.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pro-card p-8">
                        <div className="flex items-center gap-3 mb-10">
                            <BarChart3 className="w-5 h-5 text-white" />
                            <h2 className="text-xl font-bold text-white italic tracking-tight">Contribution Spectrum</h2>
                        </div>
                        <div className="space-y-8">
                            {Object.entries(participation).length > 0 ? (
                                Object.entries(participation).map(([name, count]: [string, any]) => (
                                    <div key={name} className="flex flex-col gap-3 group">
                                        <div className="flex justify-between items-end">
                                            <span className="text-xs font-bold text-white italic group-hover:translate-x-1 transition-transform">{name}</span>
                                            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{Math.round((count / totalEntries) * 100)}%</span>
                                        </div>
                                        <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-white opacity-40 group-hover:opacity-100 transition-all duration-700"
                                                style={{ width: `${(count / totalEntries) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-12 text-center text-zinc-600 font-bold uppercase tracking-widest text-[10px] italic border border-dashed border-white/5 rounded-xl bg-white/2">
                                    Manifesting participation data...
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
