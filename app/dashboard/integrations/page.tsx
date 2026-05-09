"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Calendar, Slack, CreditCard, Mail, Trello, Plus, CheckCircle2,
    Webhook, ChevronDown, Settings2, Link2, ShieldCheck, Download,
    Search, Filter, X, Loader2, ExternalLink, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

type Integration = {
    id: string;
    name: string;
    desc: string;
    icon: any;
    color: string;
    bg: string;
    connected: boolean;
    category: "calendar" | "automation" | "billing" | "productivity";
};

type IntegrationStatus = {
    id: string;
    connected: boolean;
    lastSynced?: string;
    webhookUrl?: string;
    deliveryMode?: string;
};

const APPS: Integration[] = [
    {
        id: "calendar",
        name: "Google Calendar",
        desc: "Automatically schedule and join your upcoming meetings.",
        icon: Calendar,
        color: "text-blue-500",
        bg: "bg-blue-50",
        connected: false,
        category: "calendar",
    },
    {
        id: "slack",
        name: "Slack Workflow",
        desc: "Push meeting summaries and action items to channels.",
        icon: Slack,
        color: "text-purple-600",
        bg: "bg-purple-50",
        connected: false,
        category: "automation",
    },
    {
        id: "stripe",
        name: "Stripe Billing",
        desc: "Manage your premium subscription and limits.",
        icon: CreditCard,
        color: "text-indigo-500",
        bg: "bg-indigo-50",
        connected: false,
        category: "billing",
    },
    {
        id: "outlook",
        name: "Outlook",
        desc: "Sync with Microsoft 365 calendar endpoints.",
        icon: Mail,
        color: "text-sky-500",
        bg: "bg-sky-50",
        connected: false,
        category: "calendar",
    },
    {
        id: "jira",
        name: "Jira / Asana",
        desc: "Turn action items automatically into dev tickets.",
        icon: Trello,
        color: "text-blue-600",
        bg: "bg-blue-50",
        connected: false,
        category: "productivity",
    },
    {
        id: "webhooks",
        name: "Custom Webhooks",
        desc: "Fire internal webhooks when a transcript finishes.",
        icon: Webhook,
        color: "text-slate-800",
        bg: "bg-slate-100",
        connected: false,
        category: "automation",
    }
];

export default function IntegrationsPage() {
    const [integrationStatuses, setIntegrationStatuses] = useState<Map<string, IntegrationStatus>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [isConnecting, setIsConnecting] = useState<string | null>(null);
    const [webhookUrl, setWebhookUrl] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<"all" | "calendar" | "automation" | "billing" | "productivity">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [showFilters, setShowFilters] = useState(false);

    // Fetch integration statuses
    useEffect(() => {
        async function fetchIntegrations() {
            try {
                const res = await fetch("/api/integrations");
                if (!res.ok) throw new Error("Failed to fetch integrations");
                const data = await res.json();

                const statusMap = new Map<string, IntegrationStatus>();
                if (data && data.integrations && Array.isArray(data.integrations)) {
                    data.integrations.forEach((int: any) => {
                        if (int.integrationId) {
                            statusMap.set(int.integrationId, {
                                id: int.integrationId,
                                connected: Boolean(int.connected),
                                lastSynced: int.lastSynced,
                                webhookUrl: int.webhookUrl,
                                deliveryMode: int.deliveryMode,
                            });
                        }
                    });
                }

                // Set initial statuses from APPS
                APPS.forEach(app => {
                    if (!statusMap.has(app.id)) {
                        statusMap.set(app.id, { id: app.id, connected: false });
                    }
                });

                setIntegrationStatuses(statusMap);

                // Load webhook URL if available
                const webhookIntegration = data.integrations?.find((i: any) => i.integrationId === "webhooks");
                if (webhookIntegration?.webhookUrl) {
                    setWebhookUrl(webhookIntegration.webhookUrl);
                }
            } catch (err) {
                console.error("Failed to fetch integrations", err);
                // Still initialize with default integrations even if fetch fails
                const statusMap = new Map<string, IntegrationStatus>();
                APPS.forEach(app => {
                    statusMap.set(app.id, { id: app.id, connected: false });
                });
                setIntegrationStatuses(statusMap);
            } finally {
                setIsLoading(false);
            }
        }
        fetchIntegrations();
    }, []);

    const connectIntegration = useCallback(async (integrationId: string) => {
        setIsConnecting(integrationId);

        try {
            const response = await fetch(`/api/integrations/${integrationId}/connect`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to connect");
            }

            const data = await response.json();

            setIntegrationStatuses(prev => {
                const newMap = new Map(prev);
                newMap.set(integrationId, {
                    id: integrationId,
                    connected: true,
                    lastSynced: new Date().toISOString(),
                });
                return newMap;
            });
        } catch (error) {
            console.error(`Failed to connect ${integrationId}:`, error);
            alert(`Failed to connect ${integrationId}. Please try again.`);
        } finally {
            setIsConnecting(null);
        }
    }, []);

    const disconnectIntegration = useCallback(async (integrationId: string) => {
        setIsConnecting(integrationId);

        try {
            const response = await fetch(`/api/integrations/${integrationId}/disconnect`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to disconnect");
            }

            setIntegrationStatuses(prev => {
                const newMap = new Map(prev);
                newMap.set(integrationId, {
                    id: integrationId,
                    connected: false,
                });
                return newMap;
            });
        } catch (error) {
            console.error(`Failed to disconnect ${integrationId}:`, error);
            alert(`Failed to disconnect ${integrationId}. Please try again.`);
        } finally {
            setIsConnecting(null);
        }
    }, []);

    const saveWebhookSettings = useCallback(async () => {
        try {
            const response = await fetch("/api/integrations/webhooks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ webhookUrl, deliveryMode: "immediate" }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to save webhook settings");
            }

            alert("Webhook settings saved successfully!");
        } catch (error) {
            console.error("Failed to save webhook settings:", error);
            alert("Failed to save webhook settings. Please try again.");
        }
    }, [webhookUrl]);

    const visibleApps = useMemo(() => {
        let filtered = selectedCategory === "all"
            ? APPS
            : APPS.filter((app) => app.category === selectedCategory);

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (app) => app.name.toLowerCase().includes(query) || app.desc.toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [selectedCategory, searchQuery]);

    const connectedCount = useMemo(() => {
        return Array.from(integrationStatuses.values()).filter(s => s.connected).length;
    }, [integrationStatuses]);

    const categories = useMemo(() => [
        ["all", "All"],
        ["calendar", "Calendar"],
        ["automation", "Automation"],
        ["billing", "Billing"],
        ["productivity", "Productivity"],
    ] as const, []);

    return (
        <div className="space-y-6 pb-8">
            {/* Header Card */}
            <div className="rounded-2xl border border-[#e6e8ee] bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#6b7280]">Integrations</p>
                        <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-[#111827]">Connection Center</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b7280]">Connect Zap Bot to your tools, control automation, and manage every external service from one form-driven workspace.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button className="inline-flex items-center gap-2 rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-2 text-sm font-medium text-[#374151] hover:border-[#d8deea] hover:bg-white">
                            <Download size={14} />
                            Export
                        </button>
                        <button className="inline-flex items-center gap-2 rounded-xl bg-[#1f2937] px-4 py-2 text-sm font-medium text-white hover:bg-[#111827]">
                            <Settings2 size={14} />
                            Save settings
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-[#e6e8ee] bg-white p-5 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#6b7280]">Connected</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-[#111827]">
                        {isLoading ? <span className="inline-block w-12 h-8 bg-slate-200 rounded animate-pulse" /> : connectedCount}
                    </p>
                    <p className="mt-1 text-sm text-[#6b7280]">Active integrations</p>
                </div>
                <div className="rounded-2xl border border-[#e6e8ee] bg-white p-5 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#6b7280]">Available</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-[#111827]">{APPS.length}</p>
                    <p className="mt-1 text-sm text-[#6b7280]">Supported services</p>
                </div>
                <div className="rounded-2xl border border-[#e6e8ee] bg-white p-5 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#6b7280]">Automation</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-[#111827]">Live</p>
                    <p className="mt-1 text-sm text-[#6b7280]">Webhook and workflow routing enabled</p>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                {/* Apps List */}
                <div className="rounded-2xl border border-[#e6e8ee] bg-white shadow-sm">
                    <div className="flex flex-col gap-4 border-b border-[#eceef3] p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold tracking-tight text-[#111827]">Connected apps</h2>
                            <p className="mt-1 text-sm text-[#6b7280]">Toggle services and jump into each provider's settings.</p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#e5e7eb] bg-white text-[#6b7280] hover:border-[#d8deea] hover:text-[#111827]"
                            >
                                <Search size={16} />
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#e5e7eb] bg-white text-[#6b7280] hover:border-[#d8deea] hover:text-[#111827]"
                            >
                                <RefreshCw size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    {showFilters && (
                        <div className="border-b border-[#eceef3] px-5 py-4">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search integrations..."
                                    className="h-10 w-full rounded-xl border border-[#e5e7eb] bg-[#fafafa] pl-10 pr-4 text-sm text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-sky-200 focus:bg-white focus:ring-4 focus:ring-sky-500/10"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#6b7280]"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Category Filters */}
                    <div className="flex flex-wrap gap-2 border-b border-[#eceef3] px-5 py-4">
                        {categories.map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => setSelectedCategory(key as any)}
                                className={cn(
                                    "rounded-xl px-4 py-2 text-sm font-medium transition",
                                    selectedCategory === key ? "bg-[#1f2937] text-white" : "border border-[#e5e7eb] bg-white text-[#6b7280] hover:border-[#d8deea] hover:text-[#111827]"
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Apps List */}
                    <div className="divide-y divide-[#eceef3]">
                        {visibleApps.length === 0 ? (
                            <div className="p-8 text-center">
                                <Search className="mx-auto mb-3 h-8 w-8 text-[#9ca3af]" />
                                <p className="text-sm font-medium text-[#6b7280]">No integrations found</p>
                                <p className="mt-1 text-xs text-[#9ca3af]">Try adjusting your search or filters</p>
                            </div>
                        ) : (
                            visibleApps.map((app) => {
                                const status = integrationStatuses.get(app.id);
                                const isConnected = status?.connected || false;
                                const isProcessing = isConnecting === app.id;

                                return (
                                    <div key={app.id} className="flex flex-col gap-4 p-5 transition hover:bg-[#fafafa] sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex min-w-0 items-start gap-4">
                                            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border", app.bg, "border-transparent")}>
                                                <app.icon className={cn("h-6 w-6", app.color)} strokeWidth={2.5} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="truncate text-sm font-semibold text-[#111827]">{app.name}</h3>
                                                    {isLoading ? (
                                                        <div className="h-5 w-16 rounded-full bg-[#f1f5f9] animate-pulse" />
                                                    ) : isConnected ? (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                                            <CheckCircle2 size={12} strokeWidth={3} />
                                                            Connected
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e7eb] bg-[#fafafa] px-2.5 py-1 text-[11px] font-semibold text-[#6b7280]">
                                                            Not connected
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b7280]">{app.desc}</p>
                                                {isConnected && status?.lastSynced && (
                                                    <p className="mt-1 text-xs text-[#9ca3af]">
                                                        Last synced: {new Date(status.lastSynced).toLocaleString()}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex shrink-0 items-center gap-2">
                                            {isConnected ? (
                                                <>
                                                    <button className="inline-flex items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-sm font-medium text-[#374151] hover:border-[#d8deea] hover:bg-[#fafafa]">
                                                        Manage
                                                        <ChevronDown size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => disconnectIntegration(app.id)}
                                                        disabled={isProcessing}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                                                    >
                                                        {isProcessing ? (
                                                            <Loader2 size={14} className="animate-spin" />
                                                        ) : (
                                                            <X size={14} />
                                                        )}
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => connectIntegration(app.id)}
                                                    disabled={isProcessing}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-[#1f2937] px-3 py-2 text-sm font-medium text-white hover:bg-[#111827] disabled:opacity-50"
                                                >
                                                    {isProcessing ? (
                                                        <Loader2 size={14} className="animate-spin" />
                                                    ) : (
                                                        <Plus size={14} />
                                                    )}
                                                    Connect
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Sidebar */}
                <div className="space-y-4">
                    {/* Webhook Form */}
                    <div className="rounded-2xl border border-[#e6e8ee] bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6b7280]">Webhook form</p>
                                <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#111827]">Automation endpoint</h2>
                            </div>
                            <div className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-600">Secure</div>
                        </div>

                        <div className="mt-5 space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-[#374151]">Webhook URL</label>
                                <div className="relative">
                                    <Link2 size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
                                    <input
                                        value={webhookUrl}
                                        onChange={(e) => setWebhookUrl(e.target.value)}
                                        placeholder="https://hooks.example.com/zapbot"
                                        className="h-12 w-full rounded-xl border border-[#e5e7eb] bg-[#fafafa] pl-10 pr-4 text-sm text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-sky-200 focus:bg-white focus:ring-4 focus:ring-sky-500/10"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-[#374151]">Delivery mode</label>
                                <div className="relative">
                                    <select className="h-12 w-full appearance-none rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-4 text-sm text-[#111827] outline-none transition focus:border-sky-200 focus:bg-white focus:ring-4 focus:ring-sky-500/10">
                                        <option>Immediate</option>
                                        <option>Queued</option>
                                        <option>Manual review</option>
                                    </select>
                                    <ChevronDown size={14} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
                                </div>
                            </div>

                            <div className="rounded-2xl border border-dashed border-[#dbe2ea] bg-[#fafafa] p-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
                                    <ShieldCheck size={16} className="text-emerald-600" />
                                    Secure routing enabled
                                </div>
                                <p className="mt-2 text-sm leading-6 text-[#6b7280]">Webhook calls are signed and can be routed to internal tools, ticketing, or meeting automation flows.</p>
                            </div>

                            <button
                                onClick={saveWebhookSettings}
                                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1f2937] px-4 text-sm font-medium text-white transition hover:bg-[#111827]"
                            >
                                Save integration form
                            </button>
                        </div>
                    </div>

                    {/* Quick Notes */}
                    <div className="rounded-2xl border border-[#e6e8ee] bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6b7280]">Quick notes</p>
                        <div className="mt-4 space-y-3 text-sm leading-6 text-[#6b7280]">
                            <p>Calendar sync controls your meeting capture flow.</p>
                            <p>Slack and webhooks route post-meeting output.</p>
                            <p>Billing stays available for usage and subscription updates.</p>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
            `}</style>
        </div>
    );
}
