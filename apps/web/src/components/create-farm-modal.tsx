"use client";

import React, { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { farmsApi } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useTranslations } from "next-intl";

interface CreateFarmModalProps {
    children: React.ReactNode;
    /** Called after a farm is successfully created (e.g. to refresh a list) */
    onCreated?: () => void;
}

export function CreateFarmModal({ children, onCreated }: CreateFarmModalProps) {
    const t = useTranslations("createFarm");
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [country, setCountry] = useState("");
    const [region, setRegion] = useState("");
    const [timezone, setTimezone] = useState("");
    const [saving, setSaving] = useState(false);

    const resetForm = () => {
        setName("");
        setCountry("");
        setRegion("");
        setTimezone("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setSaving(true);
        try {
            const farm = await farmsApi.create({
                name: name.trim(),
                country: country.trim() || undefined,
                region: region.trim() || undefined,
                timezone: timezone.trim() || undefined,
            });
            toast.success(t("farmCreated"));
            resetForm();
            setOpen(false);
            onCreated?.();
            router.push(`/farms/${farm.id}`);
        } catch (err: any) {
            toast.error(err.detail || t("failedCreate"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{t("title")}</DialogTitle>
                        <DialogDescription>{t("description")}</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="farm-name">
                                {t("farmName")} <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="farm-name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t("placeholderName")}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="farm-country">{t("country")}</Label>
                                <Input
                                    id="farm-country"
                                    type="text"
                                    value={country}
                                    onChange={(e) => setCountry(e.target.value)}
                                    placeholder={t("placeholderCountry")}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="farm-region">{t("region")}</Label>
                                <Input
                                    id="farm-region"
                                    type="text"
                                    value={region}
                                    onChange={(e) => setRegion(e.target.value)}
                                    placeholder={t("placeholderRegion")}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="farm-timezone">{t("timezone")}</Label>
                            <Input
                                id="farm-timezone"
                                type="text"
                                value={timezone}
                                onChange={(e) => setTimezone(e.target.value)}
                                placeholder={t("placeholderTimezone")}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            {t("cancel")}
                        </Button>
                        <Button type="submit" disabled={saving || !name.trim()}>
                            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                            {t("createFarm")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
