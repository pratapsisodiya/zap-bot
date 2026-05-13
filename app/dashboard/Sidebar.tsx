"use client";

import { memo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Home,
    ListTodo,
    Inbox,
    BarChart3,
    CalendarCheck2,
    CalendarDays,
    Settings,
    CircleHelp,
    Plus,
    ChevronsLeft,
    PanelsTopLeft,
    Users,
    type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAIN_ITEMS: Array<{ label: string; href: string; icon: LucideIcon }> = [
    { label: "Dashboard", href: "/dashboard", icon: Home },
    { label: "Meeting History", href: "/dashboard/meetings", icon: Users },
    { label: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
    { label: "Action Items", href: "/dashboard/actions", icon: ListTodo },
    { label: "Ai Chat", href: "/dashboard/chat", icon: Inbox },
    { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
    { label: "Integrations", href: "/dashboard/integrations", icon: CalendarCheck2 },
];


const OTHER_ITEMS: Array<{ label: string; href: string; icon: LucideIcon }> = [
    { label: "Setting", href: "/dashboard/settings", icon: Settings },
    { label: "Help Support", href: "/dashboard/help", icon: CircleHelp },
];

const SIDEBAR_MIN_WIDTH = 80;
const SIDEBAR_MAX_WIDTH = 320;
const COMPACT_THRESHOLD = 150;

const SidebarItem = memo(function SidebarItem({ href, icon: Icon, label, active, compact }: {
    href: string;
    icon: LucideIcon;
    label: string;
    active: boolean;
    compact: boolean;
}) {
    return (
        <Link
            href={href}
            className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150",
                active ? "border border-[#d9dce3] bg-white text-[#111827] shadow-sm" : "text-[#20242c] hover:bg-white/70"
            )}
        >
            <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150",
                active ? "bg-[#f2f4f8] text-[#111827]" : "text-[#394150]"
            )}>
                <Icon size={17} strokeWidth={2.1} className="transition-transform duration-150 group-hover:scale-105" />
            </div>

            {!compact && (
                <span className="text-[15px] font-medium tracking-tight">{label}</span>
            )}
        </Link>
    );
});

export default function Sidebar({
    width,
    onWidthChange,
    mobileOpen = false,
    onMobileClose,
}: {
    width: number;
    onWidthChange: (n: number) => void;
    mobileOpen?: boolean;
    onMobileClose?: () => void;
}) {
    const pathname = usePathname();
    const [isResizing, setIsResizing] = useState(false);
    const widthRef = useRef(width);
    const isCompact = width < COMPACT_THRESHOLD;

    useEffect(() => {
        widthRef.current = width;
    }, [width]);

    useEffect(() => {
        if (!isResizing) return;
        const onMove = (e: MouseEvent) => {
            const next = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, e.clientX));
            onWidthChange(next);
        };
        const onUp = () => setIsResizing(false);
        document.body.style.cursor = "col-resize";
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            document.body.style.cursor = "";
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [isResizing, onWidthChange]);

    // Lock body scroll when mobile drawer is open
    useEffect(() => {
        if (mobileOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [mobileOpen]);

    const isActive = (href: string) => {
        if (href === "/dashboard") return pathname === "/dashboard";
        return pathname?.startsWith(href);
    };

    const handleMobileNavClick = () => {
        onMobileClose?.();
    };

    const SidebarContent = ({ compact }: { compact: boolean }) => (
        <>
            <div className="flex h-16 items-center justify-between border-b border-[#e5e7eb] px-4">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d9dde5] bg-[#1f2937] text-white shadow-sm">
                        <PanelsTopLeft size={18} strokeWidth={2.2} />
                    </div>
                    {!compact && <span className="text-[22px] font-semibold tracking-tight">ZapBot</span>}
                </div>
                {!compact && <ChevronsLeft size={18} className="text-[#111827]" />}
            </div>

            <nav className="custom-scrollbar flex-1 overflow-y-auto px-3 py-4">
                {!compact && <p className="px-3 pb-2 text-[13px] font-medium text-[#525866]">Main Menu</p>}
                <div className="space-y-1.5">
                    {MAIN_ITEMS.map((item) => (
                        <div key={item.href} onClick={handleMobileNavClick}>
                            <SidebarItem
                                href={item.href}
                                icon={item.icon}
                                label={item.label}
                                active={isActive(item.href)}
                                compact={compact}
                            />
                        </div>
                    ))}
                </div>
                <div className="my-5 border-t border-dashed border-[#d9dde5]" />
                {!compact && <p className="px-3 pb-2 text-[13px] font-medium text-[#525866]">Other Menu</p>}
                <div className="space-y-1.5">
                    {OTHER_ITEMS.map((item) => (
                        <div key={item.href} onClick={handleMobileNavClick}>
                            <SidebarItem
                                href={item.href}
                                icon={item.icon}
                                label={item.label}
                                active={isActive(item.href)}
                                compact={compact}
                            />
                        </div>
                    ))}
                </div>
            </nav>
        </>
    );

    return (
        <>
            {/* Desktop sidebar */}
            {width > 0 && (
                <aside
                    style={{ width }}
                    className={cn(
                        "fixed left-0 top-0 bottom-0 z-40 hidden md:flex flex-col",
                        "bg-[#f5f6f8] text-[#111827] border-r border-[#e5e7eb]",
                        "transition-[width] duration-300 ease-in-out",
                        isResizing && "transition-none"
                    )}
                >
                    <SidebarContent compact={isCompact} />
                    <div
                        onMouseDown={() => setIsResizing(true)}
                        className={cn(
                            "absolute right-0 top-0 z-50 h-full w-1.5 cursor-col-resize transition-all duration-300",
                            isResizing ? "bg-[#5b55b7]/15" : "hover:bg-[#5b55b7]/8"
                        )}
                    >
                        <div className={cn(
                            "absolute top-1/2 left-1/2 h-12 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-300",
                            isResizing ? "h-20 bg-[#5b55b7]" : "bg-[#cfd8e3]"
                        )} />
                    </div>
                </aside>
            )}

            {/* Mobile drawer */}
            <div className="md:hidden">
                {/* Backdrop */}
                <div
                    onClick={onMobileClose}
                    className={cn(
                        "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
                        mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    )}
                />
                {/* Drawer panel */}
                <aside
                    className={cn(
                        "fixed left-0 top-0 bottom-0 z-50 flex flex-col w-72",
                        "bg-[#f5f6f8] text-[#111827] border-r border-[#e5e7eb]",
                        "transition-transform duration-300 ease-in-out",
                        mobileOpen ? "translate-x-0" : "-translate-x-full"
                    )}
                >
                    <SidebarContent compact={false} />
                </aside>
            </div>
        </>
    );
}