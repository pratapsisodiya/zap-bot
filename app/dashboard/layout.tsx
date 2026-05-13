"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import DashboardTopNav from "@/components/DashboardTopNav";

const SIDEBAR_MIN_WIDTH = 80;
const SIDEBAR_MAX_WIDTH = 320;
const SIDEBAR_DEFAULT_WIDTH = 240;
const LS_KEY = "zapbot.sidebar.width";

function getInitialWidth(): number {
    if (typeof window === "undefined") return SIDEBAR_DEFAULT_WIDTH;
    const saved = window.localStorage.getItem(LS_KEY);
    if (!saved) return SIDEBAR_DEFAULT_WIDTH;
    const n = Number(saved);
    return Number.isNaN(n) ? SIDEBAR_DEFAULT_WIDTH : Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, n));
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [sidebarWidth, setSidebarWidth] = useState(getInitialWidth);
    const [isDesktop, setIsDesktop] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const mq = window.matchMedia("(min-width: 768px)");
        setIsDesktop(mq.matches);
        const update = (e: MediaQueryListEvent) => {
            setIsDesktop(e.matches);
            if (e.matches) setMobileNavOpen(false);
        };
        mq.addEventListener("change", update);
        return () => mq.removeEventListener("change", update);
    }, []);

    function handleSidebarWidthChange(next: number) {
        const clamped = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, next));
        setSidebarWidth(clamped);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            window.localStorage.setItem(LS_KEY, String(clamped));
        }, 100);
    }

    const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
    const toggleMobileNav = useCallback(() => setMobileNavOpen(v => !v), []);

    return (
        <React.Fragment>
            <div className="w-full pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-blue-100/40 via-[#f8fbff] to-transparent" />

            <div className="relative z-10 flex flex-1">
                <Sidebar
                    width={isDesktop ? sidebarWidth : 0}
                    onWidthChange={handleSidebarWidthChange}
                    mobileOpen={mobileNavOpen}
                    onMobileClose={closeMobileNav}
                />

                <DashboardTopNav
                    leftOffset={isDesktop ? sidebarWidth : 0}
                    onMenuClick={toggleMobileNav}
                    mobileNavOpen={mobileNavOpen}
                />

                <div
                    className="flex flex-1 flex-col transition-[margin] duration-150 ease-out min-w-0"
                    style={isDesktop ? { marginLeft: `${sidebarWidth}px` } : undefined}
                >
                    <main className="flex-1 pt-16 md:pt-20 px-3 pb-6 md:px-6 md:pb-10 lg:px-8">
                        <div className="w-full h-full rounded-2xl md:rounded-[28px] border border-[#e4eaf3] bg-white/70 shadow-[0_24px_60px_rgba(15,23,42,0.04)] backdrop-blur-sm">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </React.Fragment>
    );
}
