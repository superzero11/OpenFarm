"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams, usePathname, useRouter as useNextRouter } from "next/navigation";
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
    Search,
    Link2,
    MoreVertical,
    Crown,
    Mail,
    X,
    Clock,
    Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/confirm-dialog";
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
    invite_cancelled: UserMinus,
    ownership_transferred: Crown,
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
    invite_cancelled: "eventInviteCancelled",
    ownership_transferred: "eventOwnershipTransferred",
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
    const confirm = useConfirm();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const nextRouter = useNextRouter();
    const { currentOrg, refreshOrgs, user } = useOrg();

    const VALID_TABS = ["workspace", "team", "integrations"] as const;
    const tabParam = searchParams.get("tab");
    const activeTab = VALID_TABS.includes(tabParam as any) ? tabParam! : "workspace";

    const setActiveTab = useCallback(
        (tab: string) => {
            const params = new URLSearchParams(searchParams.toString());
            if (tab === "workspace") {
                params.delete("tab");
            } else {
                params.set("tab", tab);
            }
            const qs = params.toString();
            nextRouter.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
        },
        [searchParams, pathname, nextRouter],
    );
    const [orgName, setOrgName] = useState("");
    const [members, setMembers] = useState<Member[]>([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    // Invite form
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("member");
    const [inviting, setInviting] = useState(false);
    const [inviteModalOpen, setInviteModalOpen] = useState(false);

    // Pending invites
    const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);

    // Transfer ownership
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [transferTarget, setTransferTarget] = useState<string>("");
    const [transferring, setTransferring] = useState(false);

    // Audit log
    const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
    const [auditTotal, setAuditTotal] = useState(0);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditOffset, setAuditOffset] = useState(0);
    const [auditSearch, setAuditSearch] = useState("");

    const loadMembers = useCallback(async () => {
        if (!currentOrg) return;
        try {
            const res = await orgsApi.members(currentOrg.id);
            setMembers(res.items);
        } catch (err) {
            toast.error(t("failedLoadMembers"));
        }
    }, [currentOrg, t]);

    // Derive current user's role from user.orgs (available immediately, no API call needed)
    const myRole = user?.orgs?.find((o) => o.id === currentOrg?.id)?.role;
    const isAdminOrOwner = myRole === "owner" || myRole === "admin";

    const loadInvites = useCallback(async () => {
        if (!currentOrg) return;
        try {
            const list = await orgsApi.listInvites(currentOrg.id);
            setPendingInvites(list);
        } catch (err) {
            toast.error(t("failedLoadInvites"));
        }
    }, [currentOrg, t]);

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
        const promises: Promise<void>[] = [loadMembers()];
        if (isAdminOrOwner) {
            promises.push(loadInvites(), loadAuditEvents(0));
        }
        Promise.all(promises).finally(() => setLoading(false));
    }, [currentOrg, isAdminOrOwner, loadMembers, loadInvites, loadAuditEvents]);

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
            setInviteModalOpen(false);
            await loadInvites();
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
        const ok = await confirm({
            title: t("removeMember"),
            description: t("confirmRemove", { name }),
            confirmLabel: t("removeMember"),
            variant: "destructive",
        });
        if (!ok) return;
        try {
            await orgsApi.removeMember(currentOrg.id, userId);
            toast.success(t("memberRemoved", { name }));
            await loadMembers();
        } catch (err: any) {
            toast.error(err.detail || t("failedRemove"));
        }
    };

    const handleCancelInvite = async (inviteId: string, email: string) => {
        if (!currentOrg) return;
        const ok = await confirm({
            title: t("cancelInvite"),
            description: t("confirmCancelInvite", { email }),
            confirmLabel: t("cancelInvite"),
            variant: "destructive",
        });
        if (!ok) return;
        try {
            await orgsApi.cancelInvite(currentOrg.id, inviteId);
            toast.success(t("inviteCancelled"));
            await loadInvites();
        } catch (err: any) {
            toast.error(err.detail || t("failedCancelInvite"));
        }
    };

    const handleTransferOwnership = async () => {
        if (!currentOrg || !transferTarget) return;
        const target = members.find((m) => m.user_id === transferTarget);
        if (!target) return;
        const ok = await confirm({
            title: t("transferOwnership"),
            description: t("confirmTransfer", { name: target.name }),
            confirmLabel: t("transfer"),
            variant: "destructive",
        });
        if (!ok) return;
        setTransferring(true);
        try {
            await orgsApi.transferOwnership(currentOrg.id, transferTarget);
            toast.success(t("ownershipTransferred", { name: target.name }));
            setTransferModalOpen(false);
            setTransferTarget("");
            await Promise.all([loadMembers(), refreshOrgs()]);
        } catch (err: any) {
            toast.error(err.detail || t("failedTransfer"));
        } finally {
            setTransferring(false);
        }
    };

    const filteredAuditEvents = useMemo(() => {
        if (!auditSearch.trim()) return auditEvents;
        const q = auditSearch.toLowerCase();
        return auditEvents.filter((event) => {
            const labelKey = EVENT_LABEL_KEYS[event.event_type] || "eventUnknown";
            const label = t(labelKey as any)?.toLowerCase() || "";
            const meta = event.metadata_json;
            const detail = (meta?.email || meta?.name || meta?.role || "").toLowerCase();
            return label.includes(q) || detail.includes(q) || event.event_type.includes(q);
        });
    }, [auditEvents, auditSearch, t]);

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
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    {t("description")}
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList variant="underline" className="mb-8">
                    <TabsTrigger variant="underline" value="workspace">
                        <Building2 className="h-4 w-4" />
                        {t("tabWorkspace")}
                    </TabsTrigger>
                    <TabsTrigger variant="underline" value="team">
                        <Users className="h-4 w-4" />
                        {t("tabTeam")}
                    </TabsTrigger>
                    <TabsTrigger variant="underline" value="integrations">
                        <Link2 className="h-4 w-4" />
                        {t("tabIntegrations")}
                    </TabsTrigger>
                </TabsList>

                {/* ─── Workspace Tab ─── */}
                <TabsContent value="workspace" className="space-y-8">
                    {/* Workspace Name */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("general")}</CardTitle>
                            <CardDescription>{t("generalDesc")}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSaveName} className="flex items-end gap-3">
                                <div className="flex-1 space-y-1.5">
                                    <Label htmlFor="org-name">{t("orgName")}</Label>
                                    <Input
                                        id="org-name"
                                        type="text"
                                        value={orgName}
                                        onChange={(e) => setOrgName(e.target.value)}
                                        disabled={!canManage}
                                    />
                                </div>
                                {canManage && (
                                    <Button type="submit" disabled={saving}>
                                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                        {t("save")}
                                    </Button>
                                )}
                            </form>
                        </CardContent>
                    </Card>

                    {/* Audit Log */}
                    {canManage && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <ScrollText className="h-5 w-5" />
                                            {t("auditLog")}
                                        </CardTitle>
                                        <CardDescription className="mt-1">{t("auditLogDesc")}</CardDescription>
                                    </div>
                                    <div className="relative w-64 shrink-0">
                                        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            type="text"
                                            placeholder={t("searchAudit")}
                                            value={auditSearch}
                                            onChange={(e) => setAuditSearch(e.target.value)}
                                            className="pl-8 h-9"
                                        />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="h-80 overflow-y-auto px-6">
                                    {filteredAuditEvents.length === 0 && !auditLoading ? (
                                        <p className="text-sm text-muted-foreground py-8 text-center">
                                            {t("noAuditEvents")}
                                        </p>
                                    ) : (
                                        <div className="space-y-0">
                                            {filteredAuditEvents.map((event, index) => {
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
                                </div>
                                {auditOffset < auditTotal && (
                                    <div className="border-t px-6 py-3 flex justify-center">
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
                </TabsContent>

                {/* ─── Team Tab ─── */}
                <TabsContent value="team" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Users className="h-5 w-5" />
                                        {t("teamTitle")}
                                    </CardTitle>
                                    <CardDescription className="mt-1">{t("memberCount", { count: members.length })}</CardDescription>
                                </div>
                                {canManage && (
                                    <Button onClick={() => setInviteModalOpen(true)}>
                                        <UserPlus className="h-4 w-4 mr-2" />
                                        {t("inviteMember")}
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-0">
                            {/* Member list */}
                            {members.map((member, index) => {
                                const isCurrentUser = member.user_id === user?.id;
                                const isOwner = member.role === "owner";
                                return (
                                    <React.Fragment key={member.id}>
                                        {index > 0 && <Separator />}
                                        <div className="flex items-center justify-between py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                                                    {member.name?.charAt(0)?.toUpperCase() || "?"}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">
                                                        {member.name}
                                                        {isCurrentUser && (
                                                            <span className="ml-1.5 text-xs text-muted-foreground font-normal">({t("you")})</span>
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">{member.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className={cn("capitalize", ROLE_COLORS[member.role] || ROLE_COLORS.viewer)}>
                                                    {member.role}
                                                </Badge>
                                                {canManage && !isCurrentUser && !isOwner && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuSub>
                                                                <DropdownMenuSubTrigger>
                                                                    <Shield className="h-4 w-4 mr-2" />
                                                                    {t("changeRole")}
                                                                </DropdownMenuSubTrigger>
                                                                <DropdownMenuSubContent>
                                                                    {["viewer", "member", "admin"].map((r) => (
                                                                        <DropdownMenuItem
                                                                            key={r}
                                                                            disabled={r === member.role}
                                                                            onClick={() => handleRoleChange(member.user_id, r)}
                                                                            className="capitalize"
                                                                        >
                                                                            {r === member.role && <Check className="mr-2 h-3.5 w-3.5" aria-hidden="true" />}
                                                                            {r}
                                                                        </DropdownMenuItem>
                                                                    ))}
                                                                </DropdownMenuSubContent>
                                                            </DropdownMenuSub>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="text-destructive focus:text-destructive"
                                                                onClick={() => handleRemoveMember(member.user_id, member.name)}
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                {t("removeMember")}
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </div>
                                        </div>
                                    </React.Fragment>
                                );
                            })}

                            {/* Pending invites */}
                            {canManage && pendingInvites.length > 0 && (
                                <>
                                    <Separator className="my-2" />
                                    <div className="pt-3">
                                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                            <Clock className="h-3.5 w-3.5" />
                                            {t("pendingInvites", { count: pendingInvites.length })}
                                        </h3>
                                        {pendingInvites.map((invite, index) => (
                                            <React.Fragment key={invite.id}>
                                                {index > 0 && <Separator />}
                                                <div className="flex items-center justify-between py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/50 text-sm font-medium text-muted-foreground border border-dashed">
                                                            <Mail className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-muted-foreground">{invite.email}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {invite.invited_by_name
                                                                    ? t("invitedBy", { name: invite.invited_by_name })
                                                                    : t("invitedAs", { role: invite.role })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="secondary" className="capitalize">
                                                            {invite.role}
                                                        </Badge>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                                            onClick={() => handleCancelInvite(invite.id, invite.email)}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Transfer Ownership */}
                    {currentMember?.role === "owner" && members.filter((m) => m.user_id !== user?.id).length > 0 && (
                        <div className="pt-2">
                            <Button variant="outline" onClick={() => setTransferModalOpen(true)}>
                                <Crown className="h-4 w-4 mr-2" />
                                {t("transferOwnership")}
                            </Button>
                        </div>
                    )}

                    {/* ── Invite Modal ── */}
                    <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>{t("inviteModalTitle")}</DialogTitle>
                                <DialogDescription>{t("inviteModalDesc")}</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleInvite} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="invite-email">{t("emailAddress")}</Label>
                                    <Input
                                        id="invite-email"
                                        type="email"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        placeholder="colleague@company.com"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t("role")}</Label>
                                    <Select value={inviteRole} onValueChange={setInviteRole}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ROLE_OPTIONS.filter((r) => r !== "owner").map((r) => (
                                                <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={inviting}>
                                        {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                                        {t("sendInvite")}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    {/* ── Transfer Ownership Modal ── */}
                    <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>{t("transferOwnership")}</DialogTitle>
                                <DialogDescription>{t("transferOwnershipDesc")}</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>{t("selectNewOwner")}</Label>
                                    <Select value={transferTarget} onValueChange={setTransferTarget}>
                                        <SelectTrigger>
                                            <SelectValue placeholder={t("selectNewOwner")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {members
                                                .filter((m) => m.user_id !== user?.id)
                                                .map((m) => (
                                                    <SelectItem key={m.user_id} value={m.user_id}>
                                                        {m.name} ({m.email})
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter className="gap-2 sm:gap-0">
                                <Button variant="outline" onClick={() => setTransferModalOpen(false)}>
                                    {t("cancel")}
                                </Button>
                                <Button
                                    variant="destructive"
                                    disabled={!transferTarget || transferring}
                                    onClick={handleTransferOwnership}
                                >
                                    {transferring && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                    {t("transfer")}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </TabsContent>

                {/* ─── Integrations Tab (placeholder) ─── */}
                <TabsContent value="integrations">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Link2 className="h-5 w-5" />
                                {t("tabIntegrations")}
                            </CardTitle>
                            <CardDescription>Coming soon.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground py-4 text-center">
                                No integrations available yet.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
