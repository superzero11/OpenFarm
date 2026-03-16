"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { orgsApi, usersApi, setOrgId, getOrgId } from "@/lib/api";
import type { Org, UserMe } from "@/lib/api";

interface OrgCtx {
    orgs: Org[];
    currentOrg: Org | null;
    user: UserMe | null;
    switchOrg: (orgId: string) => void;
    refreshOrgs: () => Promise<void>;
    loading: boolean;
}

const OrgContext = createContext<OrgCtx>({
    orgs: [],
    currentOrg: null,
    user: null,
    switchOrg: () => { },
    refreshOrgs: async () => { },
    loading: true,
});

export const useOrg = () => useContext(OrgContext);

export function OrgProvider({ children }: { children: React.ReactNode }) {
    const [orgs, setOrgs] = useState<Org[]>([]);
    const [currentOrg, setCurrentOrg] = useState<Org | null>(null);
    const [user, setUser] = useState<UserMe | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchOrgs = useCallback(async () => {
        try {
            const [orgList, me] = await Promise.all([orgsApi.list(), usersApi.me()]);
            setOrgs(orgList);
            setUser(me);

            const savedOrgId = getOrgId();
            const match = orgList.find((o) => o.id === savedOrgId);
            if (match) {
                setCurrentOrg(match);
            } else if (orgList.length > 0) {
                setCurrentOrg(orgList[0]);
                setOrgId(orgList[0].id);
            }
        } catch (err) {
            console.error("Failed to fetch orgs:", err);
            toast.error("Failed to load organizations. Please refresh the page.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrgs();
    }, [fetchOrgs]);

    const switchOrg = useCallback(
        (orgId: string) => {
            const org = orgs.find((o) => o.id === orgId);
            if (org) {
                setCurrentOrg(org);
                setOrgId(org.id);
            }
        },
        [orgs],
    );

    return (
        <OrgContext.Provider
            value={{ orgs, currentOrg, user, switchOrg, refreshOrgs: fetchOrgs, loading }}
        >
            {children}
        </OrgContext.Provider>
    );
}
