"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MAP_STYLES, type MapStyleId } from "@/lib/pmtiles";
import { Layers } from "lucide-react";

interface MapStyleSwitcherProps {
    currentStyle: MapStyleId;
    onStyleChange: (styleId: MapStyleId) => void;
    className?: string;
}

/**
 * Floating map style switcher - click-to-toggle dropdown.
 * Closes on outside click or after selecting a style.
 */
export default function MapStyleSwitcher({
    currentStyle,
    onStyleChange,
    className = "",
}: MapStyleSwitcherProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    const handleClickOutside = useCallback((e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
            setOpen(false);
        }
    }, []);

    useEffect(() => {
        if (open) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open, handleClickOutside]);

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Toggle button */}
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 rounded-lg bg-background/90 backdrop-blur-sm px-3 py-2 text-sm font-medium text-foreground shadow-md border border-border/50 hover:bg-background transition-colors"
                title="Map layers"
            >
                <Layers className="h-4 w-4" />
                <span className="hidden sm:inline">
                    {MAP_STYLES.find((s) => s.id === currentStyle)?.label ?? "Map"}
                </span>
            </button>

            {/* Expanded panel */}
            {open && (
                <div className="absolute top-full left-0 mt-2 flex gap-1.5 rounded-xl bg-background/95 backdrop-blur-sm p-2 shadow-lg border border-border/50">
                    {MAP_STYLES.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                                onStyleChange(s.id);
                                setOpen(false);
                            }}
                            className={`flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${currentStyle === s.id
                                ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                                : "text-foreground hover:bg-muted/60"
                                }`}
                            title={s.label}
                        >
                            <s.icon className="h-5 w-5" aria-hidden="true" />
                            <span>{s.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
