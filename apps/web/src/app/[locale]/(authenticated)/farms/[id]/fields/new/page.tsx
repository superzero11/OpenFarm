"use client";

import React, { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import dynamic from "next/dynamic";
import { fieldsApi } from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, ChevronDown, ChevronUp, Check, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";
import type maplibregl from "maplibre-gl";
import { MAP_STYLES, type MapStyleId } from "@/lib/pmtiles";
import { MAP_CHROME } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamic imports - these need browser APIs
const DrawMap = dynamic(() => import("@/components/map/draw-map"), {
    ssr: false,
    loading: () => (
        <Skeleton className="h-full w-full rounded-none" />
    ),
});

const LocationSearch = dynamic(() => import("@/components/map/location-search"), {
    ssr: false,
});

const MapStyleSwitcher = dynamic(() => import("@/components/map/map-style-switcher"), {
    ssr: false,
});

export default function NewFieldPage() {
    const t = useTranslations("createField");
    const params = useParams();
    const router = useRouter();
    const farmId = params.id as string;

    const [name, setName] = useState("");
    const [cropType, setCropType] = useState("");
    const [season, setSeason] = useState("");
    const [geometry, setGeometry] = useState<GeoJSON.Geometry | null>(null);
    const [saving, setSaving] = useState(false);
    const [panelOpen, setPanelOpen] = useState(true);
    const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
    const [mapStyle, setMapStyle] = useState<MapStyleId>("satellite");

    const handleGeomChange = useCallback((geom: GeoJSON.Geometry | null) => {
        setGeometry(geom);
    }, []);

    const handleLocationSelect = useCallback((lngLat: [number, number]) => {
        mapInstance?.flyTo({ center: lngLat, zoom: 16, duration: 1500 });
    }, [mapInstance]);

    const handleStyleChange = useCallback((styleId: MapStyleId) => {
        if (!mapInstance) return;
        const styleDef = MAP_STYLES.find((s) => s.id === styleId);
        if (styleDef) {
            mapInstance.setStyle(styleDef.style);
            setMapStyle(styleId);
        }
    }, [mapInstance]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error(t("nameRequired"));
            return;
        }
        if (!geometry) {
            toast.error(t("drawFirst"));
            return;
        }

        setSaving(true);
        try {
            const field = await fieldsApi.create({
                farm_id: farmId,
                name: name.trim(),
                geom: geometry,
                crop_type: cropType.trim() || undefined,
                season: season.trim() || undefined,
            });
            toast.success(`Field "${field.name}" created (${field.area_ha?.toFixed(2) ?? "?"} ha)`);
            router.push(`/farms/${farmId}/fields/${field.id}`);
        } catch (err: any) {
            toast.error(err.detail || t("createField"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="relative h-full w-full overflow-hidden">
            {/* Full-screen map */}
            <div className="absolute inset-0">
                <DrawMap onGeometryChange={handleGeomChange} onMapReady={setMapInstance} />
            </div>

            {/* Back button + Style switcher + Search - top left */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                <Link
                    href={`/farms/${farmId}`}
                    className={cn("inline-flex h-10 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium text-foreground transition-colors hover:bg-surface-3", MAP_CHROME)}
                >
                    <ArrowLeft className="h-4 w-4" />
                    {t("backToFarm")}
                </Link>
                <MapStyleSwitcher currentStyle={mapStyle} onStyleChange={handleStyleChange} />
                <LocationSearch onSelect={handleLocationSelect} />
            </div>

            {/* Floating field details panel - top right */}
            <div className="absolute top-4 right-4 z-10 w-80">
                <div className={cn("overflow-hidden rounded-xl", MAP_CHROME)}>
                    {/* Panel header - always visible, acts as toggle */}
                    <button
                        type="button"
                        onClick={() => setPanelOpen(!panelOpen)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-2 transition-colors"
                    >
                        <span className="text-sm font-semibold">{t("fieldDetails")}</span>
                        {panelOpen ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                    </button>

                    {/* Collapsible body */}
                    {panelOpen && (
                        <div className="border-t border-border px-4 pb-4">
                            <form onSubmit={handleSubmit} className="space-y-3 pt-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="field-name" className="text-xs">
                                        {t("fieldName")} <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="field-name"
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder={t("placeholderName")}
                                        required
                                        className="h-9"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="crop-type" className="text-xs">{t("cropType")}</Label>
                                    <Input
                                        id="crop-type"
                                        type="text"
                                        value={cropType}
                                        onChange={(e) => setCropType(e.target.value)}
                                        placeholder={t("placeholderCrop")}
                                        className="h-9"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="season" className="text-xs">{t("season")}</Label>
                                    <Input
                                        id="season"
                                        type="text"
                                        value={season}
                                        onChange={(e) => setSeason(e.target.value)}
                                        placeholder={t("placeholderSeason")}
                                        className="h-9"
                                    />
                                </div>

                                {/* Geometry status */}
                                <div className={`flex items-center gap-1.5 rounded-lg p-2.5 text-xs font-medium ${geometry ? "bg-primary-subtle text-primary" : "bg-muted text-muted-foreground"}`}>
                                    {geometry ? <Check className="h-4 w-4" aria-hidden="true" /> : <TriangleAlert className="h-4 w-4" aria-hidden="true" />}
                                    {geometry ? t("polygonDrawn") : t("drawPolygon")}
                                </div>

                                <Button
                                    type="submit"
                                    disabled={saving || !geometry || !name.trim()}
                                    className="w-full h-9"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                                    {t("createField")}
                                </Button>
                            </form>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}
