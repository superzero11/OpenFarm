"use client";

import React, { useCallback, useEffect, useState } from "react";
import { shareApi } from "@/lib/api";
import type { ShareLink } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Check,
    Copy,
    ExternalLink,
    Link2,
    Loader2,
    Plus,
    Share2,
    Trash2,
    Clock,
    AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";
import { useTranslations } from "next-intl";

interface ShareTabProps {
    fieldId: string;
}

export default function ShareTab({ fieldId }: ShareTabProps) {
    const t = useTranslations("shareTab");
    const confirm = useConfirm();

    const [links, setLinks] = useState<ShareLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [expiryDays, setExpiryDays] = useState<string>("30");
    const [copiedToken, setCopiedToken] = useState<string | null>(null);

    const fetchLinks = useCallback(async () => {
        try {
            const data = await shareApi.list(fieldId);
            setLinks(data);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [fieldId]);

    useEffect(() => {
        fetchLinks();
    }, [fetchLinks]);

    const handleCreate = async () => {
        setCreating(true);
        try {
            const days = expiryDays === "never" ? null : parseInt(expiryDays, 10);
            await shareApi.create(fieldId, days);
            toast.success(t("linkCreated"));
            await fetchLinks();
        } catch {
            toast.error(t("failedCreate"));
        } finally {
            setCreating(false);
        }
    };

    const handleRevoke = async (token: string) => {
        const ok = await confirm({
            title: t("revoke"),
            description: t("revokeConfirm"),
            variant: "destructive",
        });
        if (!ok) return;

        try {
            await shareApi.revoke(fieldId, token);
            toast.success(t("linkRevoked"));
            await fetchLinks();
        } catch {
            toast.error(t("failedRevoke"));
        }
    };

    const getShareUrl = (token: string) => {
        if (typeof window === "undefined") return "";
        return `${window.location.origin}/share/${token}`;
    };

    const handleCopy = async (token: string) => {
        const url = getShareUrl(token);
        try {
            await navigator.clipboard.writeText(url);
            setCopiedToken(token);
            toast.success(t("linkCopied"));
            setTimeout(() => setCopiedToken(null), 2000);
        } catch {
            toast.error("Failed to copy");
        }
    };

    const formatExpiry = (expiresAt: string | null) => {
        if (!expiresAt) return t("neverExpires");
        const d = new Date(expiresAt);
        return `${t("expiresOn")} ${d.toLocaleDateString()}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            {/* Create share link */}
            <div className="rounded-lg border bg-card shadow-sm p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">{t("createShareLink")}</h3>
                </div>
                <p className="text-xs text-muted-foreground">{t("createDesc")}</p>
                <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                            {t("expiryLabel")}
                        </label>
                        <Select value={expiryDays} onValueChange={setExpiryDays}>
                            <SelectTrigger className="h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="7">{t("expiry7Days")}</SelectItem>
                                <SelectItem value="30">{t("expiry30Days")}</SelectItem>
                                <SelectItem value="never">{t("expiryNever")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button
                        size="sm"
                        className="h-9 gap-1.5"
                        onClick={handleCreate}
                        disabled={creating}
                    >
                        {creating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Plus className="h-3.5 w-3.5" />
                        )}
                        {t("generateLink")}
                    </Button>
                </div>
            </div>

            {/* Active links */}
            <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    {t("activeLinks")}
                    {links.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            {links.length}
                        </Badge>
                    )}
                </h3>

                {links.length === 0 ? (
                    <div className="rounded-lg border bg-card shadow-sm p-6 text-center">
                        <Share2 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">{t("noActiveLinks")}</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                            {t("noActiveLinksDesc")}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {links.map((link) => (
                            <div
                                key={link.id}
                                className="rounded-lg border bg-card shadow-sm p-3 space-y-2"
                            >
                                {/* URL row */}
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono truncate select-all">
                                        {getShareUrl(link.token)}
                                    </code>
                                </div>

                                {/* Actions row */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        {formatExpiry(link.expires_at)}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 gap-1 text-xs"
                                            onClick={() => handleCopy(link.token)}
                                        >
                                            {copiedToken === link.token ? (
                                                <Check className="h-3 w-3 text-green-600" />
                                            ) : (
                                                <Copy className="h-3 w-3" />
                                            )}
                                            {copiedToken === link.token ? t("copied") : t("copyLink")}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 gap-1 text-xs"
                                            asChild
                                        >
                                            <a
                                                href={getShareUrl(link.token)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                                {t("open")}
                                            </a>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                                            onClick={() => handleRevoke(link.token)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                            {t("revoke")}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
