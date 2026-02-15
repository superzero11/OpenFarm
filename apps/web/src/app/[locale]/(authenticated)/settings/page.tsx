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

    const loadMembers = useCallback(async () => {
        if (!currentOrg) return;
        try {
            const list = await orgsApi.members(currentOrg.id);
            setMembers(list);
        } catch (err) {
            toast.error(t("failedLoadMembers"));
        }
    }, [currentOrg]);

    useEffect(() => {
        if (!currentOrg) return;
        setOrgName(currentOrg.name);
        setLoading(true);
        loadMembers().finally(() => setLoading(false));
    }, [currentOrg, loadMembers]);

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
            </div>
        </div>
    );
}
