"use client";

import { useEffect } from "react";

export default function PWARegister() {
    useEffect(() => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

        window.addEventListener("load", () => {
            navigator.serviceWorker
                .register("/sw.js", { scope: "/" })
                .then(reg => {
                    reg.addEventListener("updatefound", () => {
                        const newWorker = reg.installing;
                        if (!newWorker) return;
                        newWorker.addEventListener("statechange", () => {
                            // New SW activated — could show a "refresh for updates" toast here
                        });
                    });
                })
                .catch(() => {
                    // SW registration failed silently — app still works fine
                });
        });
    }, []);

    return null;
}
