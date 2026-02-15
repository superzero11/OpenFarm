"use client";

import { useEffect } from "react";

/**
 * Suppresses benign MapLibre GL "signal is aborted without reason" errors.
 * These fire when tile requests are cancelled during map navigation or unmount.
 */
export function MapAbortSuppressor() {
    useEffect(() => {
        const handler = (event: PromiseRejectionEvent) => {
            if (
                event.reason instanceof DOMException &&
                event.reason.name === "AbortError"
            ) {
                event.preventDefault();
            }
        };
        window.addEventListener("unhandledrejection", handler);
        return () => window.removeEventListener("unhandledrejection", handler);
    }, []);

    return null;
}
