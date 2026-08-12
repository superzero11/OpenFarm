"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import { useLocale } from "next-intl";
import { MAP_CHROME } from "@/lib/design-tokens";

interface LocationSearchProps {
    /** Called when user selects a location */
    onSelect: (lngLat: [number, number], label: string) => void;
    className?: string;
}

interface NominatimResult {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
}

/**
 * Expandable location search box using Nominatim (OpenStreetMap).
 * Starts as a collapsed icon button, expands on click.
 */
export default function LocationSearch({ onSelect, className = "" }: LocationSearchProps) {
    const locale = useLocale();
    const [expanded, setExpanded] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<NominatimResult[]>([]);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Focus input when expanded
    useEffect(() => {
        if (expanded) {
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [expanded]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setExpanded(false);
                setResults([]);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const search = useCallback(async (q: string) => {
        if (q.length < 3) {
            setResults([]);
            return;
        }
        setLoading(true);
        // Cancel any in-flight request
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`,
                { headers: { "Accept-Language": locale }, signal: controller.signal }
            );
            const data: NominatimResult[] = await res.json();
            setResults(data);
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") return;
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleInputChange = (value: string) => {
        setQuery(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => search(value), 350);
    };

    const handleSelect = (result: NominatimResult) => {
        const lng = parseFloat(result.lon);
        const lat = parseFloat(result.lat);
        onSelect([lng, lat], result.display_name);
        setQuery(result.display_name.split(",")[0]);
        setResults([]);
        setExpanded(false);
    };

    const handleClose = () => {
        setQuery("");
        setResults([]);
        setExpanded(false);
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <div
                className={`${MAP_CHROME} flex h-10 items-center rounded-lg transition-all duration-300 ease-in-out overflow-hidden ${expanded ? "w-72" : "w-10"
                    }`}
            >
                {/* Search icon / toggle */}
                <button
                    type="button"
                    onClick={() => {
                        if (!expanded) setExpanded(true);
                        else inputRef.current?.focus();
                    }}
                    className="flex-shrink-0 flex items-center justify-center w-9 h-9 hover:bg-surface-2 transition-colors"
                    title="Search location"
                >
                    <Search className="h-4 w-4 text-foreground" />
                </button>

                {/* Input */}
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") handleClose();
                    }}
                    placeholder="Search location..."
                    className={`flex-1 h-9 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none pr-1 transition-all duration-300 ${expanded ? "w-full opacity-100" : "w-0 opacity-0"
                        }`}
                />

                {/* Close button */}
                {expanded && (
                    <button
                        type="button"
                        onClick={handleClose}
                        className="flex-shrink-0 flex items-center justify-center w-8 h-9 hover:bg-surface-2 transition-colors"
                    >
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                )}
            </div>

            {/* Dropdown results */}
            {expanded && results.length > 0 && (
                <div className={`${MAP_CHROME} absolute top-full left-0 mt-1 w-72 rounded-lg overflow-hidden z-50`}>
                    {results.map((r) => (
                        <button
                            key={r.place_id}
                            type="button"
                            onClick={() => handleSelect(r)}
                            className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-surface-2 transition-colors border-b border-border last:border-b-0 truncate"
                        >
                            {r.display_name}
                        </button>
                    ))}
                </div>
            )}

            {/* Loading indicator */}
            {expanded && loading && (
                <div className={`${MAP_CHROME} absolute top-full left-0 mt-1 w-72 rounded-lg px-3 py-2 text-xs text-muted-foreground`}>
                    Searching...
                </div>
            )}
        </div>
    );
}
