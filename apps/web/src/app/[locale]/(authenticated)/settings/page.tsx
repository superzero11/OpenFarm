"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useOrg } from "@/components/org-context";
import { orgsApi } from "@/lib/api";
import type { Member, Invite } from "@/lib/api";
import { toast } from "sonner";
import {
    Users,
    Loader2,
    Save,
    UserPlus,
    Trash2,
    Shield,
    ScrollText,
    LogIn,
    Building2,
    UserCog,
    MapPin,
    Share2,
    UserMinus,
    UserCheck,
    Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const ROLE_OPTIONS = ["owner", "admin", "member", "viewer"];
const ROLE_COLORS: Record<string, string> = {
    owner: "bg-primary/10 text-primary",
    admin: "bg-primary/10 text-primary",
    member: "bg-muted text-muted-foreground",
    viewer: "bg-muted text-muted-foreground",
};

const EVENT_ICONS: Record<string, typeof Activity> = {
    login: LogIn,
    org_created: Building2,
    member_invited: UserPlus,
    role_changed: UserCog,
    field_created: MapPin,
    report_shared: Share2,
    member_removed: UserMinus,
    invite_accepted: UserCheck,
};

const EVENT_LABEL_KEYS: Record<string, string> = {
    login: "eventLogin",
    org_created: "eventOrgCreated",
    member_invited: "eventMemberInvited",
    role_changed: "eventRoleChanged",
    field_created: "eventFieldCreated",
    report_shared: "eventReportShared",
    member_removed: "eventMemberRemoved",
    invite_accepted: "eventInviteAccepted",
};

interface AuditEvent {
    id: string;
    user_id: string;
    event_type: string;
    metadata_json: Record<string, any> | null;
    created_at: string;
}

const AUDIT_PAGE_SIZE = 20;

export default function SettingsPage() {
    const t = useTranslations("settings");
    const { currentOrg, refreshOrgs, user } = useOrg();
    const [orgName, setOrgName] = useState("");
    const [members, setMembers] = useState<Member[]>([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    // Invite form
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("member");
    const [inviting, setInviting] = useState(false);

    // Audit log
    const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
    const [auditTotal, setAuditTotal] = useState(0);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditOffset, setAuditOffset] = useState(0);

    const loadMembers = useCallback(async () => {
        if (!currentOrg) return;
        try {
            const list = await orgsApi.members(currentOrg.id);
            setMembers(list);
        } catch (err) {
            toast.error(t("failedLoadMembers"));
        }
    }, [currentOrg]);

    const loadAuditEvents = useCallback(async (offset = 0, append = false) => {
        if (!currentOrg) return;
        setAuditLoading(true);
        try {
            const res = await orgsApi.auditEvents(currentOrg.id, AUDIT_PAGE_SIZE, offset);
            setAuditEvents((prev) => (append ? [...prev, ...res.items] : res.items));
            setAuditTotal(res.total);
            setAuditOffset(offset + res.items.length);
        } catch (err) {
            toast.error(t("failedLoadAudit"));
        } finally {
            setAuditLoading(false);
        }
    }, [currentOrg, t]);

    useEffect(() => {
        if (!currentOrg) return;
        setOrgName(currentOrg.name);
        setLoading(true);
        Promise.all([loadMembers(), loadAuditEvents(0)]).finally(() => setLoading(false));
    }, [currentOrg, loadMembers, loadAuditEvents]);

    const handleSaveName = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentOrg || !orgName.trim()) return;
        setSaving(true);
        try {
            await orgsApi.update(currentOrg.id, orgName.trim());
            await refreshOrgs();
            toast.success(t("orgNameUpdated"));
        } catch (err) {
            toast.error(t("failedUpdateOrg"));
        } finally {
            setSaving(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentOrg || !inviteEmail.trim()) return;
        setInviting(true);
        try {
            await orgsApi.invite(currentOrg.id, inviteEmail.trim(), inviteRole);
            toast.success(t("inviteSent", { email: inviteEmail }));
            setInviteEmail("");
            setInviteRole("member");
        } catch (err: any) {
            toast.error(err.detail || t("failedInvite"));
        } finally {
            setInviting(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: string) => {
        if (!currentOrg) return;
        try {
            await orgsApi.changeMemberRole(currentOrg.id, userId, newRole);
            toast.success(t("roleUpdated"));
            await loadMembers();
        } catch (err: any) {
            toast.error(err.detail || t("failedUpdateRole"));
        }
    };

    const handleRemoveMember = async (userId: string, name: string) => {
        if (!currentOrg) return;
        if (!confirm(t("confirmRemove", { name }))) return;
        try {
            await orgsApi.removeMember(currentOrg.id, userId);
            toast.success(t("memberRemoved", { name }));
            await loadMembers();
        } catch (err: any) {
            toast.error(err.detail || t("failedRemove"));
        }
    };

    if (loading) {
        return (
            <div className="p-6 lg:p-8 max-w-6xl mx-auto">
                <div className="mb-8 space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <div className="space-y-6">
                    <Skeleton className="h-40 w-full rounded-lg" />
                    <Skeleton className="h-64 w-full rounded-lg" />
                </div>
            </div>
        );
    }

    // Determine if current user is owner/admin
    const currentMember = members.find((m) => m.user_id === user?.id);
    const canManage = currentMember?.role === "owner" || currentMember?.role === "admin";

    return (
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    {t("description")}
                </p>
            </div>

            <div className="space-y-8">

                {/* Org Name */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t("general")}</CardTitle>
                        <CardDescription>{t("generalDesc")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSaveName} className="flex items-end gap-3">
                            <div className="flex-1">
                                <Label htmlFor="org-name">{t("orgName")}</Label>
                                <Input
                                    id="org-name"
                                    type="text"
                                    value={orgName}
                                    onChange={(e) => setOrgName(e.target.value)}
                                    disabled={!canManage}
                                    className="mt-1"
                                />
                            </div>
                            {canManage && (
                                <Button type="submit" disabled={saving}>
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    {t("save")}
                                </Button>
                            )}
                        </form>
                    </CardContent>
                </Card>

                {/* Members */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            {t("membersTitle", { count: members.length })}
                        </CardTitle>
                        <CardDescription>{t("membersDesc")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {members.map((member, index) => (
                            <React.Fragment key={member.id}>
                                {index > 0 && <Separator />}
                                <div className="flex items-center justify-between py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                                            {member.name?.charAt(0)?.toUpperCase() || "?"}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{member.name}</p>
                                            <p className="text-xs text-muted-foreground">{member.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {canManage && member.user_id !== user?.id ? (
                                            <>
                                                <Select
                                                    value={member.role}
                                                    onValueChange={(value) => handleRoleChange(member.user_id, value)}
                                                >
                                                    <SelectTrigger className="w-28 h-8 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {ROLE_OPTIONS.map((r) => (
                                                            <SelectItem key={r} value={r}>{r}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    variant="destructive"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => handleRemoveMember(member.user_id, member.name)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </>
                                        ) : (
                                            <Badge variant="secondary" className={cn(ROLE_COLORS[member.role] || ROLE_COLORS.viewer)}>
                                                <Shield className="h-3 w-3 mr-1" />
                                                {member.role}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </React.Fragment>
                        ))}
                    </CardContent>
                </Card>

                {/* Invite */}
                {canManage && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <UserPlus className="h-5 w-5" />
                                {t("inviteMember")}
                            </CardTitle>
                            <CardDescription>{t("inviteDesc")}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row items-end gap-3">
                                <div className="flex-1 w-full space-y-1">
                                    <Label htmlFor="invite-email">{t("email")}</Label>
                                    <Input
                                        id="invite-email"
                                        type="email"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        placeholder="colleague@example.com"
                                        required
                                    />
                                </div>
                                <div className="w-full sm:w-32 space-y-1">
                                    <Label>{t("role")}</Label>
                                    <Select value={inviteRole} onValueChange={setInviteRole}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ROLE_OPTIONS.filter((r) => r !== "owner").map((r) => (
                                                <SelectItem key={r} value={r}>{r}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button type="submit" disabled={inviting} className="w-full sm:w-auto">
                                    {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                    {t("sendInvite")}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* Audit Log */}
                {canManage && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ScrollText className="h-5 w-5" />
                                {t("auditLog")}
                            </CardTitle>
                            <CardDescription>{t("auditLogDesc")}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {auditEvents.length === 0 && !auditLoading ? (
                                <p className="text-sm text-muted-foreground py-4 text-center">
                                    {t("noAuditEvents")}
                                </p>
                            ) : (
                                <div className="space-y-0">
                                    {auditEvents.map((event, index) => {
                                        const Icon = EVENT_ICONS[event.event_type] || Activity;
                                        const labelKey = EVENT_LABEL_KEYS[event.event_type] || "eventUnknown";
                                        const meta = event.metadata_json;
                                        const detail = meta?.email || meta?.name || meta?.role || null;
                                        return (
                                            <React.Fragment key={event.id}>
                                                {index > 0 && <Separator />}
                                                <div className="flex items-center gap-3 py-2.5">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                                                        <Icon className="h-4 w-4 text-muted-foreground" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium">
                                                            {t(labelKey as any)}
                                                        </p>
                                                        {detail && (
                                                            <p className="text-xs text-muted-foreground truncate">
                                                                {detail}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <time className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {new Date(event.created_at).toLocaleDateString(undefined, {
                                                            month: "short",
                                                            day: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </time>
                                                </div>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            )}
                            {auditOffset < auditTotal && (
                                <div className="pt-4 flex justify-center">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => loadAuditEvents(auditOffset, true)}
                                        disabled={auditLoading}
                                    >
                                        {auditLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : null}
                                        {t("loadMore")}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
