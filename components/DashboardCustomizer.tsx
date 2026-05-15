"use client";

import { useRef, useState } from "react";
import { Eye, EyeOff, GripVertical, X, RotateCcw, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export type WidgetDef = {
    id: string;
    label: string;
    desc: string;
};

export type WidgetPrefs = {
    order: string[];
    hidden: string[];
};

interface Props {
    open: boolean;
    widgets: readonly WidgetDef[];
    prefs: WidgetPrefs;
    onChange: (prefs: WidgetPrefs) => void;
    onClose: () => void;
}

export default function DashboardCustomizer({ open, widgets, prefs, onChange, onClose }: Props) {
    const dragIndex = useRef<number | null>(null);
    const [dragOver, setDragOver] = useState<number | null>(null);

    const orderedWidgets = prefs.order
        .map((id) => widgets.find((w) => w.id === id))
        .filter((w): w is WidgetDef => Boolean(w));

    function toggleHidden(id: string) {
        const hidden = prefs.hidden.includes(id)
            ? prefs.hidden.filter((h) => h !== id)
            : [...prefs.hidden, id];
        onChange({ ...prefs, hidden });
    }

    function handleDragStart(index: number) {
        dragIndex.current = index;
    }

    function handleDragOver(e: React.DragEvent, index: number) {
        e.preventDefault();
        setDragOver(index);
    }

    function handleDrop(dropIndex: number) {
        const from = dragIndex.current;
        if (from === null || from === dropIndex) {
            dragIndex.current = null;
            setDragOver(null);
            return;
        }
        const newOrder = [...prefs.order];
        const [moved] = newOrder.splice(from, 1);
        newOrder.splice(dropIndex, 0, moved);
        dragIndex.current = null;
        setDragOver(null);
        onChange({ ...prefs, order: newOrder });
    }

    function handleDragEnd() {
        dragIndex.current = null;
        setDragOver(null);
    }

    function reset() {
        onChange({ order: widgets.map((w) => w.id), hidden: [] });
    }

    if (!open) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xs flex-col border-l border-[#e6e8ee] bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#eceef3] px-5 py-4">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f3f4f6]">
                            <LayoutGrid size={15} className="text-[#374151]" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-[#111827]">Customize Dashboard</p>
                            <p className="text-[11px] text-[#9ca3af]">Drag to reorder · toggle to hide</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-[#9ca3af] transition hover:bg-[#f3f4f6] hover:text-[#374151]"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Widget list */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#9ca3af]">
                        Widgets
                    </p>
                    <ul className="flex flex-col gap-2">
                        {orderedWidgets.map((widget, index) => {
                            const isHidden = prefs.hidden.includes(widget.id);
                            const isDragTarget = dragOver === index;
                            return (
                                <li
                                    key={widget.id}
                                    draggable
                                    onDragStart={() => handleDragStart(index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDrop={() => handleDrop(index)}
                                    onDragEnd={handleDragEnd}
                                    className={cn(
                                        "flex items-center gap-3 rounded-xl border bg-white px-3 py-3 transition-all select-none",
                                        isDragTarget
                                            ? "border-blue-300 bg-blue-50 shadow-md"
                                            : "border-[#e6e8ee] hover:border-[#d1d5db] hover:shadow-sm",
                                        isHidden && "opacity-50"
                                    )}
                                >
                                    {/* Drag handle */}
                                    <GripVertical
                                        size={15}
                                        className="shrink-0 cursor-grab text-[#d1d5db] active:cursor-grabbing"
                                    />

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className={cn(
                                            "text-sm font-semibold leading-tight",
                                            isHidden ? "text-[#9ca3af]" : "text-[#111827]"
                                        )}>
                                            {widget.label}
                                        </p>
                                        <p className="text-[11px] text-[#9ca3af] mt-0.5">{widget.desc}</p>
                                    </div>

                                    {/* Toggle visibility */}
                                    <button
                                        onClick={() => toggleHidden(widget.id)}
                                        title={isHidden ? "Show widget" : "Hide widget"}
                                        className={cn(
                                            "shrink-0 rounded-lg p-1.5 transition",
                                            isHidden
                                                ? "text-[#d1d5db] hover:text-[#374151] hover:bg-[#f3f4f6]"
                                                : "text-[#059669] hover:bg-emerald-50"
                                        )}
                                    >
                                        {isHidden ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                {/* Footer */}
                <div className="border-t border-[#eceef3] px-5 py-4 flex items-center justify-between gap-3">
                    <button
                        onClick={reset}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6b7280] hover:text-[#111827] transition"
                    >
                        <RotateCcw size={12} />
                        Reset to default
                    </button>
                    <button
                        onClick={onClose}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#1f2937] px-4 py-2 text-xs font-semibold text-white hover:bg-[#111827] transition"
                    >
                        Done
                    </button>
                </div>
            </div>
        </>
    );
}
