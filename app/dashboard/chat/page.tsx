"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    Bot, Send, Sparkles, User, Loader2, AlertCircle,
    Clock, Zap, RotateCcw, Link2, CheckCircle2, X,
    ChevronDown, MessageSquare, ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Message = {
    id: string;
    role: "user" | "assistant";
    content: string;
    ts: Date;
};

type BotStatus = "idle" | "sending" | "success" | "error";

const GLOBAL_SUGGESTIONS = [
    { icon: "📋", label: "Key action items",      prompt: "What were the key action items from all meetings this week?" },
    { icon: "🎯", label: "Q3 roadmap decisions",  prompt: "Summarize the recent discussions around the Q3 roadmap." },
    { icon: "☁️", label: "Vendor decisions",      prompt: "Did we decide on a vendor for the cloud migration?" },
    { icon: "👤", label: "Task assignments",       prompt: "Who was assigned to the marketing campaign launch?" },
];

const MEETING_SUGGESTIONS = [
    { icon: "📋", label: "Action items",           prompt: "What were the key action items from this meeting?" },
    { icon: "🎯", label: "Key decisions",          prompt: "What decisions were made in this meeting?" },
    { icon: "👤", label: "Who said what",          prompt: "Summarize what each participant said." },
    { icon: "📝", label: "Quick summary",          prompt: "Give me a 3-sentence summary of this meeting." },
];

let msgCounter = 0;
function nextId() { return String(++msgCounter); }

function isValidMeetingUrl(url: string) {
    return /meet\.google\.com|zoom\.us|teams\.microsoft\.com|webex\.com/i.test(url);
}

export default function DashboardChatPage() {
    const searchParams = useSearchParams();
    const meetingId = searchParams.get("id") || null;

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [chatError, setChatError] = useState("");
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const [showBotPanel, setShowBotPanel] = useState(false);
    const [meetingUrl, setMeetingUrl] = useState("");
    const [meetingTitle, setMeetingTitle] = useState("");
    const [botStatus, setBotStatus] = useState<BotStatus>("idle");
    const [botError, setBotError] = useState("");
    const [botSuccessMsg, setBotSuccessMsg] = useState("");
    const urlInputRef = useRef<HTMLInputElement>(null);

    // Reset chat when switching between global / meeting-specific
    useEffect(() => {
        setMessages([]);
        setChatError("");
        setInput("");
    }, [meetingId]);

    const scrollToBottom = useCallback(() => {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }, []);

    function buildHistory(msgs: Message[]) {
        return msgs.slice(-6).map(m =>
            `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`
        ).join("\n");
    }

    const send = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || loading) return;

        const userMsg: Message = { id: nextId(), role: "user", content: trimmed, ts: new Date() };
        const next = [...messages, userMsg];
        setMessages(next);
        setInput("");
        setLoading(true);
        setChatError("");
        scrollToBottom();

        try {
            const endpoint = meetingId ? "/api/chat" : "/api/chat/all";
            const body = meetingId
                ? { meetingId, query: trimmed, history: buildHistory(messages) }
                : { query: trimmed, history: buildHistory(messages) };

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Request failed");

            setMessages(prev => [...prev, {
                id: nextId(),
                role: "assistant",
                content: data.answer || "I couldn't process that. Please try again.",
                ts: new Date(),
            }]);
        } catch (e) {
            setChatError(e instanceof Error ? e.message : "Something went wrong");
        } finally {
            setLoading(false);
            scrollToBottom();
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [messages, loading, scrollToBottom, meetingId]);

    function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); }
    }

    function clearChat() {
        setMessages([]); setChatError(""); setInput("");
        setTimeout(() => inputRef.current?.focus(), 50);
    }

    async function dispatchBot() {
        const url = meetingUrl.trim();
        if (!url) { setBotError("Please enter a meeting link."); return; }
        if (!isValidMeetingUrl(url)) {
            setBotError("Only Google Meet, Zoom, Teams, or Webex links are supported.");
            return;
        }
        setBotStatus("sending"); setBotError(""); setBotSuccessMsg("");
        try {
            const now = new Date();
            const end = new Date(now.getTime() + 60 * 60 * 1000);
            const res = await fetch("/api/bot/dispatch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    meetingUrl: url, title: meetingTitle.trim() || "Quick Join",
                    startTime: now.toISOString(), endTime: end.toISOString(),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Dispatch failed");
            setBotStatus("success");
            setBotSuccessMsg("Bot dispatched! It's joining your meeting now.");
            setMeetingUrl(""); setMeetingTitle("");
            setTimeout(() => { setShowBotPanel(false); setBotStatus("idle"); setBotSuccessMsg(""); }, 3000);
        } catch (e) {
            setBotStatus("error");
            setBotError(e instanceof Error ? e.message : "Failed to dispatch bot");
        }
    }

    const suggestions = meetingId ? MEETING_SUGGESTIONS : GLOBAL_SUGGESTIONS;
    const isEmpty = messages.length === 0;

    return (
        <div className="flex h-[calc(100vh-64px)] md:h-[calc(100vh-80px)] flex-col bg-white">

            {/* Top bar */}
            <div className="flex shrink-0 items-center justify-between border-b border-[#e6e8ee] px-5 py-3.5">
                <div className="flex items-center gap-3">
                    {meetingId && (
                        <Link
                            href={`/dashboard/meetings/${meetingId}`}
                            className="flex items-center gap-1 text-xs font-medium text-[#6b7280] hover:text-[#111827] transition-colors mr-1"
                        >
                            <ChevronLeft size={14} /> Back
                        </Link>
                    )}
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1f2937]">
                        {meetingId ? <MessageSquare className="h-4 w-4 text-white" /> : <Zap className="h-4 w-4 text-white fill-white" />}
                    </div>
                    <div>
                        <p className="text-[14px] font-bold text-[#111827] leading-none">
                            {meetingId ? "Meeting Chat" : "ZapBot AI"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#9ca3af]">
                            {meetingId ? "Ask anything about this meeting transcript" : "Ask anything across all your meetings"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {meetingId ? (
                        <span className="flex items-center gap-1.5 rounded-full border border-[#e6e8ee] bg-[#f7f8fb] px-2.5 py-1 text-[10px] font-semibold text-[#6b7280]">
                            <MessageSquare size={10} /> 1 meeting
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online
                        </span>
                    )}

                    {!meetingId && (
                        <button
                            onClick={showBotPanel ? () => setShowBotPanel(false) : () => {
                                setShowBotPanel(true); setBotStatus("idle"); setBotError(""); setBotSuccessMsg("");
                                setTimeout(() => urlInputRef.current?.focus(), 80);
                            }}
                            className={cn(
                                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all",
                                showBotPanel
                                    ? "bg-[#1f2937] border-[#1f2937] text-white"
                                    : "bg-white border-[#e5e7eb] text-[#374151] hover:bg-slate-50"
                            )}
                        >
                            <Bot size={13} /> Send Bot
                            <ChevronDown size={11} className={cn("transition-transform", showBotPanel && "rotate-180")} />
                        </button>
                    )}

                    {messages.length > 0 && (
                        <button
                            onClick={clearChat}
                            className="flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-semibold text-[#6b7280] hover:text-[#111827] hover:bg-slate-50 transition-colors"
                        >
                            <RotateCcw size={12} /> New chat
                        </button>
                    )}
                </div>
            </div>

            {/* Bot dispatch panel */}
            {showBotPanel && (
                <div className="shrink-0 border-b border-[#e6e8ee] bg-[#f7f8fb] px-5 py-4">
                    <div className="mx-auto max-w-2xl">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Bot size={14} className="text-[#374151]" />
                                <p className="text-[13px] font-bold text-[#111827]">Dispatch Bot to a Meeting</p>
                            </div>
                            <button onClick={() => setShowBotPanel(false)} className="text-[#9ca3af] hover:text-[#374151] transition-colors">
                                <X size={15} />
                            </button>
                        </div>
                        {botStatus === "success" ? (
                            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-700">
                                <CheckCircle2 size={15} className="shrink-0" /> {botSuccessMsg}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <div className="flex gap-2">
                                    <div className="flex flex-1 items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 focus-within:border-[#9ca3af] transition-all">
                                        <Link2 size={14} className="shrink-0 text-[#9ca3af]" />
                                        <input
                                            ref={urlInputRef}
                                            type="url"
                                            value={meetingUrl}
                                            onChange={e => { setMeetingUrl(e.target.value); setBotError(""); }}
                                            onKeyDown={e => e.key === "Enter" && void dispatchBot()}
                                            placeholder="Paste meeting link (Meet, Zoom, Teams, Webex)"
                                            className="flex-1 bg-transparent text-[13px] text-[#111827] placeholder:text-[#9ca3af] focus:outline-none"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        value={meetingTitle}
                                        onChange={e => setMeetingTitle(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && void dispatchBot()}
                                        placeholder="Title (optional)"
                                        className="w-36 rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 text-[13px] text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#9ca3af] transition-all"
                                    />
                                    <button
                                        onClick={() => void dispatchBot()}
                                        disabled={botStatus === "sending" || !meetingUrl.trim()}
                                        className="flex shrink-0 items-center gap-2 rounded-xl bg-[#1f2937] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#111827] disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {botStatus === "sending"
                                            ? <><Loader2 size={13} className="animate-spin" /> Sending…</>
                                            : <><Bot size={13} /> Send Bot</>}
                                    </button>
                                </div>
                                {botError && (
                                    <div className="flex items-center gap-2 text-[12px] text-red-600">
                                        <AlertCircle size={13} className="shrink-0" /> {botError}
                                    </div>
                                )}
                                <p className="text-[11px] text-[#9ca3af]">
                                    The bot joins immediately and begins recording + transcribing. Results appear in Meeting History once the call ends.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
                {isEmpty ? (
                    <div className="flex h-full flex-col items-center justify-center px-4 pb-8">
                        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1f2937] shadow-lg">
                            <Sparkles className="h-6 w-6 text-white" />
                        </div>
                        <h2 className="mb-2 text-2xl font-bold text-[#111827]">
                            {meetingId ? "Ask about this meeting" : "What do you want to know?"}
                        </h2>
                        <p className="mb-8 max-w-sm text-center text-sm text-[#6b7280]">
                            {meetingId
                                ? "Query the transcript, extract decisions, find action items, and more."
                                : "Search your meeting history, extract decisions, find action items, and more."}
                        </p>
                        <div className="grid w-full max-w-lg grid-cols-2 gap-3">
                            {suggestions.map((s) => (
                                <button
                                    key={s.label}
                                    onClick={() => void send(s.prompt)}
                                    disabled={loading}
                                    className="group flex flex-col gap-2 rounded-xl border border-[#e6e8ee] bg-white p-4 text-left hover:border-[#d1d5db] hover:shadow-sm transition-all active:scale-[0.98]"
                                >
                                    <span className="text-xl">{s.icon}</span>
                                    <span className="text-[13px] font-semibold leading-snug text-[#374151] group-hover:text-[#111827]">{s.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
                        {messages.map((m) => (
                            <div key={m.id} className={cn("flex gap-3", m.role === "user" ? "flex-row-reverse" : "flex-row")}>
                                <div className={cn(
                                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                                    m.role === "user" ? "bg-[#1f2937]" : "border border-[#e6e8ee] bg-white"
                                )}>
                                    {m.role === "user"
                                        ? <User className="h-3.5 w-3.5 text-white" />
                                        : <Bot className="h-3.5 w-3.5 text-[#6b7280]" />}
                                </div>
                                <div className={cn("flex max-w-[80%] flex-col gap-1", m.role === "user" ? "items-end" : "items-start")}>
                                    <div className={cn(
                                        "rounded-2xl px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap",
                                        m.role === "user"
                                            ? "rounded-tr-sm bg-[#1f2937] text-white"
                                            : "rounded-tl-sm border border-[#e6e8ee] bg-white text-[#111827] shadow-sm"
                                    )}>
                                        {m.content}
                                    </div>
                                    <span className="flex items-center gap-1 px-1 text-[10px] text-[#9ca3af]">
                                        <Clock className="h-2.5 w-2.5" />
                                        {m.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex gap-3">
                                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#e6e8ee] bg-white">
                                    <Bot className="h-3.5 w-3.5 text-[#9ca3af]" />
                                </div>
                                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-[#e6e8ee] bg-white px-4 py-3 shadow-sm">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#9ca3af]" />
                                    <span className="text-[13px] text-[#9ca3af]">Thinking…</span>
                                </div>
                            </div>
                        )}

                        {chatError && (
                            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
                                <AlertCircle className="h-4 w-4 shrink-0" /> {chatError}
                            </div>
                        )}

                        <div ref={bottomRef} />
                    </div>
                )}
            </div>

            {/* Input bar */}
            <div className="shrink-0 border-t border-[#e6e8ee] bg-white px-4 pb-5 pt-3">
                <div className="mx-auto max-w-2xl">
                    <div className="flex items-end gap-2 rounded-2xl border border-[#d1d5db] bg-white px-4 py-3 shadow-sm focus-within:border-[#9ca3af] focus-within:shadow-md transition-all">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={onKeyDown}
                            placeholder={meetingId ? "Ask about this meeting…" : "Ask about your meetings…"}
                            disabled={loading}
                            rows={1}
                            className="flex-1 resize-none bg-transparent text-[14px] text-[#111827] placeholder:text-[#9ca3af] focus:outline-none leading-relaxed max-h-32 disabled:opacity-50"
                            style={{ fieldSizing: "content" } as React.CSSProperties}
                        />
                        <button
                            onClick={() => void send(input)}
                            disabled={!input.trim() || loading}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1f2937] hover:bg-[#111827] disabled:bg-[#e5e7eb] disabled:cursor-not-allowed transition-colors active:scale-95"
                        >
                            <Send className="h-3.5 w-3.5 text-white" />
                        </button>
                    </div>
                    <p className="mt-2 text-center text-[11px] text-[#9ca3af]">
                        <kbd className="rounded border border-[#e5e7eb] bg-[#f7f8fb] px-1 py-0.5 text-[10px]">Enter</kbd> to send &nbsp;·&nbsp;
                        <kbd className="rounded border border-[#e5e7eb] bg-[#f7f8fb] px-1 py-0.5 text-[10px]">Shift+Enter</kbd> for new line
                    </p>
                </div>
            </div>
        </div>
    );
}
