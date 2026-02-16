"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { useOrg } from "@/components/org-context";
import { farmsApi, fieldsApi } from "@/lib/api";
import type { Farm, Field } from "@/lib/api";
import { toast } from "sonner";
import {
    ArrowLeft,
    ChevronRight,
    Edit2,
    Loader2,
    Map,
    MapPin,
    Plus,
    Save,
    Trash2,
    Upload,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function FarmDetailPage() {
    const params = useParams();
    const router = useRouter();
    const farmId = params.id as string;
    const { currentOrg } = useOrg();

    const [farm, setFarm] = useState<Farm | null>(null);
    const [fields, setFields] = useState<Field[]>([]);
    const [loading, setLoading] = useState(true);

    // Edit mode
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editCountry, setEditCountry] = useState("");
    const [editRegion, setEditRegion] = useState("");
    const [editTimezone, setEditTimezone] = useState("");
    const [saving, setSaving] = useState(false);

    // Import
    const [importing, setImporting] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const f = await farmsApi.get(farmId);
            setFarm(f);
            setEditName(f.name);
            setEditCountry(f.country || "");
            setEditRegion(f.region || "");
            setEditTimezone(f.timezone || "");
        } catch {
            toast.error("Farm not found");
            router.push("/farms");
            return;
        }

        try {
            const fieldsRes = await farmsApi.fields(farmId, 200, 0);
            setFields(fieldsRes.items);
        } catch (err) {
            console.error("Failed to load fields:", err);
        } finally {
            setLoading(false);
        }
    }, [farmId, router]);

    useEffect(() => {
        if (currentOrg) loadData();
    }, [currentOrg, loadData]);

    const handleSave = async () => {
        if (!editName.trim()) return;
        setSaving(true);
        try {
            const updated = await farmsApi.update(farmId, {
                name: editName.trim(),
                country: editCountry.trim() || undefined,
                region: editRegion.trim() || undefined,
                timezone: editTimezone.trim() || undefined,
            });
            setFarm(updated);
            setEditing(false);
            toast.success("Farm updated");
        } catch (err: any) {
            toast.error(err.detail || "Failed to update");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Delete this farm? All its fields will also be deleted. This cannot be undone.")) return;
        try {
            await farmsApi.delete(farmId);
            toast.success("Farm deleted");
            router.push("/farms");
        } catch (err: any) {
            toast.error(err.detail || "Failed to delete");
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        try {
            const result = await fieldsApi.import(farmId, file);
            toast.success(`Imported ${result.imported} field(s)`);
            if (result.errors.length > 0) {
                toast.warning(`${result.errors.length} error(s) during import`);
            }
            await loadData();
        } catch (err: any) {
            toast.error(err.detail || "Import failed");
        } finally {
            setImporting(false);
            e.target.value = "";
        }
    };

    const handleDeleteField = async (fieldId: string, fieldName: string) => {
        if (!confirm(`Delete field "${fieldName}"?`)) return;
        try {
            await fieldsApi.delete(fieldId);
            toast.success("Field deleted");
            setFields((prev) => prev.filter((f) => f.id !== fieldId));
        } catch (err: any) {
            toast.error(err.detail || "Failed to delete field");
        }
    };

    if (loading) {
        return (
            <div className="p-6 lg:p-8 max-w-6xl mx-auto">
                <Skeleton className="h-4 w-32 mb-4" />
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </CardHeader>
                </Card>
                <Skeleton className="h-5 w-24" />
                <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    if (!farm) return null;

    return (
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
            {/* Back link */}
            <Link
                href="/farms"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Farms
            </Link>

            {/* Farm Header */}
            <Card className="mb-6">
                {editing ? (
                    <CardContent className="pt-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="farm-name">Farm Name</Label>
                                <Input
                                    id="farm-name"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="farm-country">Country</Label>
                                    <Input id="farm-country" value={editCountry} onChange={(e) => setEditCountry(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="farm-region">Region</Label>
                                    <Input id="farm-region" value={editRegion} onChange={(e) => setEditRegion(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="farm-timezone">Timezone</Label>
                                    <Input id="farm-timezone" value={editTimezone} onChange={(e) => setEditTimezone(e.target.value)} />
                                </div>
                            </div>
                            <Separator />
                            <div className="flex gap-2">
                                <Button onClick={handleSave} disabled={saving}>
                                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                    Save
                                </Button>
                                <Button variant="outline" onClick={() => setEditing(false)}>
                                    <X className="h-4 w-4 mr-2" /> Cancel
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                ) : (
                    <CardHeader className="flex flex-row items-start justify-between space-y-0">
                        <div>
                            <CardTitle>{farm.name}</CardTitle>
                            {(farm.region || farm.country) && (
                                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                                    <MapPin className="h-4 w-4" />
                                    {[farm.region, farm.country].filter(Boolean).join(", ")}
                                </p>
                            )}
                            {farm.timezone && (
                                <p className="mt-0.5 text-xs text-muted-foreground">Timezone: {farm.timezone}</p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                                <Edit2 className="h-4 w-4 mr-2" /> Edit
                            </Button>
                            <Button variant="destructive" size="sm" onClick={handleDelete}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </Button>
                        </div>
                    </CardHeader>
                )}
            </Card>

            {/* Fields Section */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">
                        Fields ({fields.length})
                    </h2>
                    <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <label className="cursor-pointer">
                                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                                Import GeoJSON
                                <input type="file" accept=".json,.geojson" className="hidden" onChange={handleImport} />
                            </label>
                        </Button>
                        <Button asChild>
                            <Link href={`/farms/${farmId}/fields/new`}>
                                <Plus className="h-4 w-4 mr-2" />
                                Draw Field
                            </Link>
                        </Button>
                    </div>
                </div>

                {fields.length === 0 ? (
                    <Card className="border-2 border-dashed">
                        <CardContent className="p-12 text-center">
                            <Map className="mx-auto h-12 w-12 text-muted-foreground/50" />
                            <p className="mt-4 text-sm font-medium">No fields yet</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Draw a field on the map or import a GeoJSON file.
                            </p>
                            <div className="mt-4 flex justify-center gap-3">
                                <Button variant="outline" asChild>
                                    <label className="cursor-pointer">
                                        <Upload className="h-4 w-4 mr-2" /> Import GeoJSON
                                        <input type="file" accept=".json,.geojson" className="hidden" onChange={handleImport} />
                                    </label>
                                </Button>
                                <Button asChild>
                                    <Link href={`/farms/${farmId}/fields/new`}>
                                        <Plus className="h-4 w-4 mr-2" /> Draw Field
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {fields.map((field) => (
                            <Card
                                key={field.id}
                                className={cn("hover:border-primary/20 transition-colors")}
                            >
                                <CardContent className="flex items-center justify-between p-4">
                                    <Link
                                        href={`/farms/${farmId}/fields/${field.id}`}
                                        className="flex-1 flex items-center gap-3"
                                    >
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5">
                                            <Map className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{field.name}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-xs text-muted-foreground">
                                                    {field.area_ha ? `${field.area_ha.toFixed(2)} ha` : "—"}
                                                </span>
                                                {field.crop_type && <Badge variant="secondary">{field.crop_type}</Badge>}
                                                {field.season && <Badge variant="outline">{field.season}</Badge>}
                                            </div>
                                        </div>
                                    </Link>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() => handleDeleteField(field.id, field.name)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        <Link href={`/farms/${farmId}/fields/${field.id}`}>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                        </Link>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
