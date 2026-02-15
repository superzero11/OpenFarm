"use client";

import { useRouter } from "@/i18n/navigation";
import { useEffect } from "react";

/**
 * Redirect /farms/new → /farms (the modal is now triggered from buttons).
 * Kept as a page so existing bookmarks/links don't 404.
 */
export default function NewFarmPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/farms");
    }, [router]);
    return null;
}
