"use client";

import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, BarChart, Bar, Cell,
} from "recharts";
import { CalendarDays } from "lucide-react";

type WeeklyPoint = { label: string; completed: number; pending: number };
type StatusBar = { name: string; value: number; color: string };

export default function DashboardCharts({
    weeklyTrend,
    statusBars,
}: {
    weeklyTrend: WeeklyPoint[];
    statusBars: StatusBar[];
}) {
    return (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <div className="rounded-xl border border-[#e6e8ee] bg-white p-4 xl:col-span-2">
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[22px] font-semibold text-[#111827]">Meeting Activity Over Time</h3>
                    <button className="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-semibold text-[#4b5563]">
                        <CalendarDays size={14} strokeWidth={2.2} /> Date Range
                    </button>
                </div>
                <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weeklyTrend} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                            <CartesianGrid stroke="#eef2f7" strokeDasharray="4 4" vertical={false} />
                            <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip />
                            <Line type="monotone" dataKey="completed" stroke="#0ea5e9" strokeWidth={2.5} dot={false} />
                            <Line type="monotone" dataKey="pending" stroke="#10b981" strokeWidth={2.5} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="rounded-xl border border-[#e6e8ee] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[22px] font-semibold text-[#111827]">Bot Status</h3>
                    <button className="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-semibold text-[#4b5563]">
                        <CalendarDays size={14} strokeWidth={2.2} /> Date Range
                    </button>
                </div>
                <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={statusBars} margin={{ top: 5, right: 0, left: -22, bottom: 0 }}>
                            <CartesianGrid stroke="#eef2f7" strokeDasharray="4 4" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip />
                            <Bar dataKey="value" radius={[7, 7, 0, 0]} barSize={26}>
                                {statusBars.map((entry) => (
                                    <Cell key={entry.name} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
