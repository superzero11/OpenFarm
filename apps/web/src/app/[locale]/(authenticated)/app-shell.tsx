"use client";

import React from "react";
import { OrgProvider } from "@/components/org-context";
import { ConfirmDialogProvider } from "@/components/confirm-dialog";
import { Sidebar } from "@/components/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <OrgProvider>
            <ConfirmDialogProvider>
                <div className="flex h-screen overflow-hidden">
                    <Sidebar />
                    <main className="flex-1 overflow-y-auto bg-surface-2 pt-16 lg:pt-0 transition-[margin] duration-300 ease-in-out">
                        {children}
                    </main>
                </div>
            </ConfirmDialogProvider>
        </OrgProvider>
    );
}
