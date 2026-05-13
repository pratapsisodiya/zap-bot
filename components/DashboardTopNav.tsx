"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomUserButton } from "./auth/CustomUserButton";
import { Bell, Search, Command, Menu, X, Video, Calendar, Zap, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

const CommandPalette = dynamic(() => import("./CommandPalette"), { ssr: false });

type Notification = {
    id: string;
    icon: "video" | "calendar" | "ai";
    title: string;
    body: string;
    href: string;
    time: string;
    unread: boolean;
};

const MOCK_NOTIFICATIONS: Notification[] = [
    {
        id: "1",
        icon: "ai",
        title: "AI summary ready",
        body: "Weekly sync transcript has been processed.",
        href: "/dashboard/meetings",
        time: "2m ago",
        unread: true,
    },
    {
        id: "2",
        icon: "video",
        title: "Bot joined meeting",
        body: "ZapBot is recording your standup call.",
        href: "/dashboard/meetings",
        time: "18m ago",
        unread: true,
    },
    {
        id: "3",
        icon: "calendar",
        title: "Upcoming meeting",
        body: "Product review starts in 15 minutes.",
        href: "/dashboard/calendar",
        time: "1h ago",
        unread: false,
    },
];

function NotifIcon({ type }: { type: Notification["icon"] }) {
    if (type === "video") return <Video size={14} className="text-sky-600" />;
    if (type === "calendar") return <Calendar size={14} className="text-violet-600" />;
    return <Zap size={14} className="text-emerald-600" />;
}

function NotifIconBg({ type }: { type: Notification["icon"] }) {
    if (type === "video") return "bg-sky-50";
    if (type === "calendar") return "bg-violet-50";
    return "bg-emerald-50";
}

export default function DashboardTopNav({
    leftOffset = 0,
    onMenuClick,
    mobileNavOpen = false,
}: {
    leftOffset?: number;
    onMenuClick?: () => void;
    mobileNavOpen?: boolean;
}) {
    const router = useRouter();
    const [isPaletteOpen, setIsPaletteOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
    const notifRef = useRef<HTMLDivElement>(null);

    const unreadCount = notifications.filter(n => n.unread).length;

    // Close on outside click
    useEffect(() => {
        if (!notifOpen) return;
        function handler(e: MouseEvent) {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setNotifOpen(false);
            }
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [notifOpen]);

    function markAllRead() {
        setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
    }

    function handleNotifClick(n: Notification) {
        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, unread: false } : x));
        setNotifOpen(false);
        router.push(n.href);
    }

    return (
        <header
            className="fixed top-0 right-0 z-40 flex h-16 md:h-20 items-center border-b border-[#e5e7eb] bg-[#f8fafc] px-4 transition-all duration-300 md:px-6"
            style={{ left: `${leftOffset}px` }}
        >
            <CommandPalette open={isPaletteOpen} setOpen={setIsPaletteOpen} />

            <div className="flex w-full items-center gap-3">
                {/* Hamburger — mobile only */}
                <button
                    onClick={onMenuClick}
                    className="flex md:hidden h-10 w-10 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#4b5563] hover:bg-[#f9fafb] transition-colors flex-shrink-0"
                    aria-label="Toggle navigation"
                >
                    {mobileNavOpen ? <X size={20} strokeWidth={2.2} /> : <Menu size={20} strokeWidth={2.2} />}
                </button>

                {/* Breadcrumb — desktop only */}
                <div className="hidden items-center gap-2 text-[15px] font-medium text-[#6b7280] lg:flex flex-shrink-0">
                    <span>Main Menu</span>
                    <span className="mx-1">›</span>
                    <span className="font-semibold text-[#111827]">Dashboard</span>
                </div>

                {/* Right section */}
                <div className="flex flex-1 items-center justify-end gap-2 md:gap-3 min-w-0">
                    {/* Search — hidden on xs */}
                    <div className="relative hidden sm:flex flex-1 max-w-xs md:max-w-sm lg:max-w-md group">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280] group-focus-within:text-blue-500 transition-colors" strokeWidth={2.2} />
                        <input
                            onFocus={(e) => { e.target.blur(); setIsPaletteOpen(true); }}
                            placeholder="Search (Ctrl + K)"
                            className="h-10 md:h-12 w-full cursor-pointer rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-12 text-sm font-medium text-[#111827] outline-none placeholder:text-[#9ca3af] hover:border-[#d1d5db] transition-all"
                        />
                        <div className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-[#6b7280] md:flex">
                            <Command size={11} strokeWidth={2.5} />
                            <span>K</span>
                        </div>
                    </div>

                    {/* Search icon — xs only */}
                    <button
                        onClick={() => setIsPaletteOpen(true)}
                        className="flex sm:hidden h-10 w-10 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#4b5563] hover:bg-[#f9fafb] transition-colors"
                    >
                        <Search size={18} strokeWidth={2.2} />
                    </button>

                    {/* Bell with dropdown */}
                    <div ref={notifRef} className="relative flex-shrink-0">
                        <button
                            onClick={() => setNotifOpen(v => !v)}
                            className={cn(
                                "relative flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-lg border transition-colors",
                                notifOpen
                                    ? "border-[#d1d5db] bg-[#f3f4f6] text-[#111827]"
                                    : "border-[#e5e7eb] bg-white text-[#4b5563] hover:bg-[#f9fafb]"
                            )}
                            aria-label="Notifications"
                        >
                            <Bell className="h-[18px] w-[18px] md:h-5 md:w-5" strokeWidth={2.2} />
                            {unreadCount > 0 && (
                                <span className="absolute right-2 top-2 md:right-2.5 md:top-2.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-red-500 text-[9px] font-bold text-white">
                                    {unreadCount}
                                </span>
                            )}
                        </button>

                        {/* Dropdown */}
                        {notifOpen && (
                            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 rounded-xl border border-[#e6e8ee] bg-white shadow-lg">
                                {/* Header */}
                                <div className="flex items-center justify-between border-b border-[#f3f4f6] px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[14px] font-bold text-[#111827]">Notifications</span>
                                        {unreadCount > 0 && (
                                            <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                                {unreadCount}
                                            </span>
                                        )}
                                    </div>
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={markAllRead}
                                            className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 transition-colors"
                                        >
                                            Mark all read
                                        </button>
                                    )}
                                </div>

                                {/* List */}
                                <div className="divide-y divide-[#f3f4f6]">
                                    {notifications.map(n => (
                                        <button
                                            key={n.id}
                                            onClick={() => handleNotifClick(n)}
                                            className={cn(
                                                "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f7f8fb]",
                                                n.unread && "bg-sky-50/50"
                                            )}
                                        >
                                            <div className={cn("mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg", NotifIconBg({ type: n.icon }))}>
                                                <NotifIcon type={n.icon} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className={cn("truncate text-[13px] font-semibold", n.unread ? "text-[#111827]" : "text-[#374151]")}>
                                                        {n.title}
                                                    </p>
                                                    <span className="flex-shrink-0 text-[10px] text-[#9ca3af]">{n.time}</span>
                                                </div>
                                                <p className="mt-0.5 text-[12px] leading-snug text-[#6b7280] line-clamp-2">{n.body}</p>
                                            </div>
                                            {n.unread && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-sky-500" />}
                                        </button>
                                    ))}
                                </div>

                                {/* Footer */}
                                <div className="border-t border-[#f3f4f6] px-4 py-2.5">
                                    <button
                                        onClick={() => { setNotifOpen(false); router.push("/dashboard/meetings"); }}
                                        className="flex w-full items-center justify-center gap-1.5 text-[12px] font-semibold text-[#6b7280] hover:text-[#111827] transition-colors"
                                    >
                                        View all in Meeting History <ChevronRight size={12} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="relative flex-shrink-0">
                        <CustomUserButton />
                    </div>
                </div>
            </div>
        </header>
    );
}
