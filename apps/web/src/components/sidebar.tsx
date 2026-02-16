"use client";

import React, { useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useOrg } from "@/components/org-context";
import { orgsApi } from "@/lib/api";
import { toast } from "sonner";
import {
    LayoutDashboard,
    Tractor,
    Bell,
    Settings,
    LogOut,
    ChevronDown,
    PanelLeftClose,
    PanelLeftOpen,
    Menu,
    X,
    Leaf,
    Plus,
    Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
    { href: "/dashboard" as const, labelKey: "dashboard" as const, icon: LayoutDashboard },
    { href: "/farms" as const, labelKey: "farms" as const, icon: Tractor },
    { href: "/alerts" as const, labelKey: "alerts" as const, icon: Bell },
    { href: "/settings" as const, labelKey: "settings" as const, icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const { currentOrg, orgs, switchOrg, user, refreshOrgs } = useOrg();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [expanded, setExpanded] = useState(true);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [newOrgName, setNewOrgName] = useState("");
    const [creating, setCreating] = useState(false);
    const tNav = useTranslations("nav");
    const tSidebar = useTranslations("sidebar");
    const tCommon = useTranslations("common");

    const handleCreateWorkspace = async () => {
        if (!newOrgName.trim()) return;
        setCreating(true);
        try {
            const newOrg = await orgsApi.create(newOrgName.trim());
            await refreshOrgs();
            switchOrg(newOrg.id);
            setCreateDialogOpen(false);
            setNewOrgName("");
            toast.success(tSidebar("workspaceCreated"));
        } catch (err: any) {
            toast.error(err.detail || tSidebar("failedCreate"));
        } finally {
            setCreating(false);
        }
    };

    return (
        <TooltipProvider delayDuration={0}>
            {/* ─── Mobile hamburger ──────────────────────────── */}
            <Button
                variant="outline"
                size="icon"
                onClick={() => setMobileOpen(true)}
                className="fixed left-4 top-4 z-40 lg:hidden"
            >
                <Menu className="h-5 w-5" />
            </Button>

            {/* ─── Mobile overlay drawer ─────────────────────── */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
                    <div className="absolute left-0 top-0 h-full w-64 bg-background shadow-xl">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMobileOpen(false)}
                            className="absolute right-3 top-3"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                        <MobileSidebar
                            pathname={pathname}
                            currentOrg={currentOrg}
                            orgs={orgs}
                            switchOrg={switchOrg}
                            user={user}
                            onNavigate={() => setMobileOpen(false)}
                            onCreateWorkspace={() => { setMobileOpen(false); setCreateDialogOpen(true); }}
                            tNav={tNav}
                            tSidebar={tSidebar}
                            tCommon={tCommon}
                        />
                    </div>
                </div>
            )}

            {/* ─── Desktop sidebar ───────────────────────────── */}
            <aside
                className={cn(
                    "hidden lg:flex lg:flex-col lg:shrink-0 lg:border-r lg:bg-background lg:overflow-hidden",
                    "transition-[width] duration-300 ease-in-out",
                    expanded ? "lg:w-64" : "lg:w-16"
                )}
            >
                <div className="flex h-full flex-col overflow-hidden">
                    {/* Logo + toggle */}
                    <div className={cn(
                        "flex items-center h-[68px] px-4 py-5",
                        expanded ? "justify-between" : "justify-center"
                    )}>
                        {expanded && (
                            <div className="flex items-center gap-2">
                                <Leaf className="h-7 w-7 shrink-0 text-primary" />
                                <span className="text-lg font-bold whitespace-nowrap">
                                    OpenFarm
                                </span>
                            </div>
                        )}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setExpanded(!expanded)}
                                    className="h-8 w-8 shrink-0 text-muted-foreground"
                                >
                                    {expanded ? (
                                        <PanelLeftClose className="h-4 w-4" />
                                    ) : (
                                        <PanelLeftOpen className="h-4 w-4" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                {expanded ? tSidebar("collapse") : tSidebar("expand")}
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <Separator />

                    {/* Org Switcher */}
                    <div className={cn("py-3", expanded ? "px-3" : "flex justify-center px-1")}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                {expanded ? (
                                    <Button variant="outline" className="w-full justify-between">
                                        <span className="truncate">{currentOrg?.name || tSidebar("selectOrg")}</span>
                                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                ) : (
                                    <button className="flex h-10 w-10 items-center justify-center rounded-md border bg-background text-sm font-bold text-primary hover:bg-muted transition-colors">
                                        {currentOrg?.name?.charAt(0)?.toUpperCase() || "O"}
                                    </button>
                                )}
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" side="right" align="start" sideOffset={8}>
                                <DropdownMenuLabel className="text-xs text-muted-foreground">{tSidebar("workspaces")}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {orgs.map((org) => (
                                    <DropdownMenuItem
                                        key={org.id}
                                        onClick={() => switchOrg(org.id)}
                                        className={cn(
                                            org.id === currentOrg?.id && "bg-primary/10 text-primary font-medium"
                                        )}
                                    >
                                        <span className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-bold mr-2 shrink-0">
                                            {org.name?.charAt(0)?.toUpperCase()}
                                        </span>
                                        {org.name}
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setCreateDialogOpen(true)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    {tSidebar("newWorkspace")}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <Separator />

                    {/* Navigation */}
                    <nav className={cn("flex-1 space-y-1 py-4", expanded ? "px-3" : "flex flex-col items-center px-1")}>
                        {NAV_ITEMS.map((item) => {
                            const active = pathname.startsWith(item.href);
                            const btn = (
                                <Button
                                    key={item.href}
                                    variant={active ? "secondary" : "ghost"}
                                    className={cn(
                                        "gap-3 overflow-hidden",
                                        expanded ? "w-full justify-start" : "h-10 w-10 justify-center p-0",
                                        active && "bg-primary/10 text-primary"
                                    )}
                                    asChild
                                >
                                    <Link href={item.href}>
                                        <item.icon className="h-5 w-5 shrink-0" />
                                        {expanded && (
                                            <span className="whitespace-nowrap">
                                                {tNav(item.labelKey)}
                                            </span>
                                        )}
                                    </Link>
                                </Button>
                            );

                            if (expanded) return <React.Fragment key={item.href}>{btn}</React.Fragment>;

                            return (
                                <Tooltip key={item.href}>
                                    <TooltipTrigger asChild>{btn}</TooltipTrigger>
                                    <TooltipContent side="right">{tNav(item.labelKey)}</TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </nav>

                    {/* Bottom: User profile + collapse toggle */}
                    <Separator />
                    <div className="px-3 py-3 space-y-2">
                        {/* Profile dropdown (always visible) */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                {expanded ? (
                                    <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted transition-colors">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                                            {user?.name?.charAt(0)?.toUpperCase() || "?"}
                                        </div>
                                        <div className="flex-1 min-w-0 overflow-hidden">
                                            <p className="text-sm font-medium truncate">{user?.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                                        </div>
                                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    </button>
                                ) : (
                                    <button className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary mx-auto hover:ring-2 hover:ring-primary/20 transition-all">
                                        {user?.name?.charAt(0)?.toUpperCase() || "?"}
                                    </button>
                                )}
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                side="right"
                                align="end"
                                sideOffset={8}
                                className="w-56"
                            >
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                                            {user?.name?.charAt(0)?.toUpperCase() || "?"}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{user?.name}</p>
                                            <p className="text-xs text-muted-foreground">{user?.email}</p>
                                        </div>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => signOut({ callbackUrl: "/" })}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    {tCommon("signOut")}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        {/* Theme toggle + Language switcher — row when expanded, stacked when collapsed */}
                        <div className={`flex ${expanded ? "justify-center gap-1" : "flex-col items-center gap-1"} pt-1`}>
                            <ThemeToggle />
                            <LanguageSwitcher side="right" align="end" />
                        </div>
                    </div>
                </div>
            </aside>

            {/* Create Workspace Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{tSidebar("createWorkspace")}</DialogTitle>
                        <DialogDescription>
                            {tSidebar("workspaceName")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="new-org-name">{tSidebar("workspaceName")}</Label>
                            <Input
                                id="new-org-name"
                                value={newOrgName}
                                onChange={(e) => setNewOrgName(e.target.value)}
                                placeholder={tSidebar("workspaceNamePlaceholder")}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleCreateWorkspace();
                                    }
                                }}
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setCreateDialogOpen(false)}
                            disabled={creating}
                        >
                            {tSidebar("cancel")}
                        </Button>
                        <Button
                            onClick={handleCreateWorkspace}
                            disabled={creating || !newOrgName.trim()}
                        >
                            {creating ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Plus className="h-4 w-4 mr-2" />
                            )}
                            {creating ? tSidebar("creating") : tSidebar("createWorkspace")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    );
}

/* ── Mobile sidebar (full-width, always expanded) ────────── */
function MobileSidebar({
    pathname,
    currentOrg,
    orgs,
    switchOrg,
    user,
    onNavigate,
    onCreateWorkspace,
    tNav,
    tSidebar,
    tCommon,
}: {
    pathname: string;
    currentOrg: any;
    orgs: any[];
    switchOrg: (id: string) => void;
    user: any;
    onNavigate: () => void;
    onCreateWorkspace: () => void;
    tNav: (key: string) => string;
    tSidebar: (key: string) => string;
    tCommon: (key: string) => string;
}) {
    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 px-4 py-5">
                <Leaf className="h-7 w-7 text-primary" />
                <span className="text-lg font-bold">OpenFarm</span>
            </div>
            <Separator />
            <div className="px-3 py-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                            <span className="truncate">{currentOrg?.name || tSidebar("selectOrg")}</span>
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                        {orgs.map((org: any) => (
                            <DropdownMenuItem
                                key={org.id}
                                onClick={() => switchOrg(org.id)}
                                className={cn(
                                    org.id === currentOrg?.id && "bg-primary/10 text-primary font-medium"
                                )}
                            >
                                {org.name}
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={onCreateWorkspace}>
                            <Plus className="h-4 w-4 mr-2" />
                            {tSidebar("newWorkspace")}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <Separator />
            <nav className="flex-1 space-y-1 px-3 py-4">
                {NAV_ITEMS.map((item) => {
                    const active = pathname.startsWith(item.href);
                    return (
                        <Button
                            key={item.href}
                            variant={active ? "secondary" : "ghost"}
                            className={cn(
                                "w-full justify-start gap-3",
                                active && "bg-primary/10 text-primary"
                            )}
                            asChild
                        >
                            <Link href={item.href} onClick={onNavigate}>
                                <item.icon className="h-5 w-5" />
                                {tNav(item.labelKey)}
                            </Link>
                        </Button>
                    );
                })}
            </nav>
            <Separator />
            <div className="px-3 py-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted transition-colors">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                                {user?.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{user?.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                            </div>
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start" className="w-56">
                        <DropdownMenuLabel className="font-normal">
                            <p className="text-sm font-medium">{user?.name}</p>
                            <p className="text-xs text-muted-foreground">{user?.email}</p>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => signOut({ callbackUrl: "/" })}
                            className="text-destructive focus:text-destructive"
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            {tCommon("signOut")}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <div className="flex justify-center gap-1 pt-2">
                    <ThemeToggle />
                    <LanguageSwitcher side="top" align="start" />
                </div>
            </div>
        </div>
    );
}
