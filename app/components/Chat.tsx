"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, User, Loader2, AlertCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type Message = {
    role: "user" | "assistant";
    content: string;
};

const QUICK_PROMPTS = [
    "Summarize key decisions",
    "List all action items",
    "What were the main risks discussed?",
    "Who is responsible for what?",
];

export default function Chat({ meetingId }: { meetingId: string }) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    function buildHistory(msgs: Message[]): string {
        return msgs
            .slice(-6)
            .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
            .join("\n");
    }

    async function send(text: string) {
        const trimmed = text.trim();
        if (!trimmed || loading) return;

        const userMessage: Message = { role: "user", content: trimmed };
        const updated = [...messages, userMessage];
        setMessages(updated);
        setInput("");
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    meetingId,
                    query: trimmed,
                    history: buildHistory(messages),
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Chat failed");

            setMessages([...updated, { role: "assistant", content: data.answer }]);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Something went wrong";
            setError(msg);
        } finally {
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }

    function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        void send(input);
    }

    return (
        <div className="flex flex-col bg-zinc-950 border border-white/8 rounded-2xl overflow-hidden h-[520px]">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 bg-zinc-900/60">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-blue-400 fill-blue-400" />
                </div>
                <div>
                    <p className="text-[13px] font-bold text-white">Meeting AI</p>
                    <p className="text-[10px] text-zinc-500">Ask anything about this meeting</p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-5 py-6">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="text-center">
                            <p className="text-[13px] font-semibold text-zinc-300 mb-1">Ask about this meeting</p>
                            <p className="text-[11px] text-zinc-600">Summaries, decisions, action items, and more</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                            {QUICK_PROMPTS.map((q) => (
                                <button
                                    key={q}
                                    onClick={() => void send(q)}
                                    disabled={loading}
                                    className="text-left px-3 py-2.5 rounded-xl bg-zinc-900 border border-white/6 text-[11px] font-medium text-zinc-400 hover:text-white hover:border-white/15 hover:bg-zinc-800 transition-all leading-snug"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((m, i) => (
                    <div
                        key={i}
                        className={cn(
                            "flex gap-2.5 max-w-[92%]",
                            m.role === "user" ? "self-end flex-row-reverse" : "self-start"
                        )}
                    >
                        <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                            m.role === "user"
                                ? "bg-blue-600"
                                : "bg-zinc-800 border border-white/8"
                        )}>
                            {m.role === "user"
                                ? <User className="w-3.5 h-3.5 text-white" />
                                : <Bot className="w-3.5 h-3.5 text-zinc-400" />
                            }
                        </div>
                        <div className={cn(
                            "px-4 py-3 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap",
                            m.role === "user"
                                ? "bg-blue-600 text-white rounded-tr-sm"
                                : "bg-zinc-900 border border-white/6 text-zinc-200 rounded-tl-sm"
                        )}>
                            {m.content}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex gap-2.5 self-start">
                        <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-white/8 flex items-center justify-center shrink-0">
                            <Bot className="w-3.5 h-3.5 text-zinc-400" />
                        </div>
                        <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-zinc-900 border border-white/6 flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
                            <span className="text-[12px] text-zinc-500">Thinking...</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {error}
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-white/8 bg-zinc-900/40">
                <form onSubmit={onSubmit} className="flex gap-2 items-center">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about this meeting..."
                        disabled={loading}
                        className="flex-1 bg-zinc-900 border border-white/8 rounded-xl px-4 py-2.5 text-[13px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || loading}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0"
                    >
                        <Send className="w-4 h-4 text-white" />
                    </button>
                </form>
            </div>
        </div>
    );
}
