"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

/* ── Changelog parser ────────────────────────────────────────────── */

interface ChangelogEntry {
    version: string;
    date: string;
    sections: { heading: string; items: string[] }[];
}

function parseChangelog(raw: string): ChangelogEntry[] {
    const entries: ChangelogEntry[] = [];
    let current: ChangelogEntry | null = null;
    let currentSection: { heading: string; items: string[] } | null = null;

    for (const line of raw.split("\n")) {
        // Version header: ## [0.3.0] - 2026-03-16  or  ## [Unreleased]
        const versionMatch = line.match(
            /^## \[([^\]]+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?/,
        );
        if (versionMatch) {
            if (current) entries.push(current);
            current = {
                version: versionMatch[1],
                date: versionMatch[2] || "",
                sections: [],
            };
            currentSection = null;
            continue;
        }

        // Section header: ### Added / ### Fixed / etc.
        const sectionMatch = line.match(/^### (.+)/);
        if (sectionMatch && current) {
            currentSection = { heading: sectionMatch[1], items: [] };
            current.sections.push(currentSection);
            continue;
        }

        // List item: - Some change
        if (line.match(/^- /) && currentSection) {
            currentSection.items.push(line.slice(2));
        }
    }
    if (current) entries.push(current);
    return entries;
}

/* ── Badge color per section type ────────────────────────────────── */

function sectionBadgeVariant(heading: string) {
    const h = heading.toLowerCase();
    if (h === "added") return "bg-success-subtle text-success";
    if (h === "fixed") return "bg-info-subtle text-info";
    if (h === "changed") return "bg-warning-subtle text-warning";
    if (h === "security") return "bg-danger-subtle text-danger";
    if (h === "deprecated") return "bg-caution-subtle text-caution";
    if (h === "removed") return "bg-muted text-muted-foreground";
    return "bg-muted text-muted-foreground";
}

/* ── Page component ──────────────────────────────────────────────── */

export default function ChangelogPage() {
    const t = useTranslations("changelog");
    const [entries, setEntries] = useState<ChangelogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/changelog");
                if (!res.ok) throw new Error("Failed to load changelog");
                const data = await res.json();
                if (!cancelled) {
                    setEntries(parseChangelog(data.content));
                }
            } catch {
                if (!cancelled) setError("Could not load changelog.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
            </div>

            {/* Loading state */}
            {loading && (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <Card key={i}>
                            <CardHeader>
                                <Skeleton className="h-6 w-48" />
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-5/6" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Error */}
            {error && (
                <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                        {error}
                    </CardContent>
                </Card>
            )}

            {/* Entries */}
            {!loading && !error && (
                <div className="space-y-4">
                    {entries.map((entry) => (
                        <Card key={entry.version}>
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-3">
                                    <CardTitle className="text-lg">
                                        {entry.version === "Unreleased"
                                            ? t("unreleased")
                                            : `v${entry.version}`}
                                    </CardTitle>
                                    {entry.date && (
                                        <span className="text-sm text-muted-foreground">
                                            {entry.date}
                                        </span>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {entry.sections.map((section) => (
                                    <div key={section.heading}>
                                        <Badge
                                            variant="secondary"
                                            className={`mb-2 ${sectionBadgeVariant(section.heading)}`}
                                        >
                                            {section.heading}
                                        </Badge>
                                        <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
                                            {section.items.map((item, i) => (
                                                <li key={i}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
