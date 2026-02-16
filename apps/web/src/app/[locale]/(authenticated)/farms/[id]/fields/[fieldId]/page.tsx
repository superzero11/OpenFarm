"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import dynamic from "next/dynamic";
import maplibregl from "maplibre-gl";
import { useOrg } from "@/components/org-context";
import { fieldsApi } from "@/lib/api";
import type { Field, RasterLayer } from "@/lib/api";
import { toast } from "sonner";
import {
    ArrowLeft,
    Edit2,
    Loader2,
    Save,
    Trash2,
    X,
    Bell,
    ClipboardList,
    Share2,
    PanelRight,
    PanelRightClose,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useConfirm } from "@/components/confirm-dialog";
import { useTranslations } from "next-intl";
import { MAP_STYLES, type MapStyleId } from "@/lib/pmtiles";

const DrawMap = dynamic(() => import("@/components/map/draw-map"), {
    ssr: false,
    loading: () => (
        <div className="flex h-full w-full items-center justify-center bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
    ),
});

const BaseMap = dynamic(() => import("@/components/map/base-map"), {
    ssr: false,
    loading: () => (
        <div className="flex h-full w-full items-center justify-center bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
    ),
});

const NdviTab = dynamic(() => import("@/components/field/ndvi-tab"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
    ),
});

const LocationSearch = dynamic(() => import("@/components/map/location-search"), {
    ssr: false,
});

const MapStyleSwitcher = dynamic(() => import("@/components/map/map-style-switcher"), {
    ssr: false,
});

const NdviLegend = dynamic(() => import("@/components/field/ndvi-legend"), {
    ssr: false,
});

/* ── NDVI overlay helpers ──────────────────────────────────── */

const NDVI_SOURCE = "ndvi-tiles";
const NDVI_LAYER = "ndvi-raster";

function removeNdviOverlay(map: maplibregl.Map) {
    if (map.getLayer(NDVI_LAYER)) map.removeLayer(NDVI_LAYER);
    if (map.getSource(NDVI_SOURCE)) map.removeSource(NDVI_SOURCE);
}

function addNdviOverlay(map: maplibregl.Map, layer: RasterLayer, field: Field) {
    if (!layer.tile_url || !field.geom) return;
    const bounds = computeGeomBounds(field.geom);
    if (!map.getSource(NDVI_SOURCE)) {
        map.addSource(NDVI_SOURCE, {
            type: "raster",
            tiles: [layer.tile_url],
            tileSize: 256,
            ...(bounds ? { bounds } : {}),
        });
    }
    if (!map.getLayer(NDVI_LAYER)) {
        map.addLayer(
            {
                id: NDVI_LAYER,
                type: "raster",
                source: NDVI_SOURCE,
                paint: { "raster-opacity": 0.75 },
                minzoom: 10,
                maxzoom: 18,
            },
            map.getLayer("field-outline") ? "field-outline" : undefined,
        );
    }
}

function computeGeomBounds(geom: GeoJSON.Geometry): [number, number, number, number] | undefined {
    const coords: number[][] = [];
    const extract = (g: any) => {
        if (g.type === "Polygon") g.coordinates[0].forEach((c: number[]) => coords.push(c));
        else if (g.type === "MultiPolygon")
            g.coordinates.forEach((poly: number[][][]) =>
                poly[0].forEach((c: number[]) => coords.push(c)),
            );
    };
    extract(geom);
    if (coords.length === 0) return undefined;
    let minLng = Infinity,
        minLat = Infinity,
        maxLng = -Infinity,
        maxLat = -Infinity;
    for (const [lng, lat] of coords) {
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
    }
    return [minLng, minLat, maxLng, maxLat];
}

/* ── Page ──────────────────────────────────────────────────── */

export default function FieldDetailPage() {
    const t = useTranslations("fieldDetail");
    const confirm = useConfirm();
    const params = useParams();
    const router = useRouter();
    const { currentOrg } = useOrg();
    const farmId = params.id as string;
    const fieldId = params.fieldId as string;

    const [field, setField] = useState<Field | null>(null);
    const [loading, setLoading] = useState(true);

    // Edit mode
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editCropType, setEditCropType] = useState("");
    const [editSeason, setEditSeason] = useState("");
    const [editGeom, setEditGeom] = useState<GeoJSON.Geometry | null>(null);
    const [saving, setSaving] = useState(false);

    // Map
    const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
    const [mapStyle, setMapStyle] = useState<MapStyleId>("satellite");
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // NDVI overlay
    const [ndviLayer, setNdviLayer] = useState<RasterLayer | null>(null);
    const ndviLayerRef = useRef<RasterLayer | null>(null);
    const fieldRef = useRef<Field | null>(null);

    // Keep refs in sync for style.load handler
    useEffect(() => {
        ndviLayerRef.current = ndviLayer;
    }, [ndviLayer]);
    useEffect(() => {
        fieldRef.current = field;
    }, [field]);

    const loadField = useCallback(async () => {
        try {
            const f = await fieldsApi.get(fieldId);
            setField(f);
            setEditName(f.name);
            setEditCropType(f.crop_type || "");
            setEditSeason(f.season || "");
            setEditGeom(f.geom);
        } catch {
            toast.error(t("fieldNotFound"));
            router.push(`/farms/${farmId}`);
        } finally {
            setLoading(false);
        }
    }, [fieldId, farmId, router, t]);

    useEffect(() => {
        if (currentOrg) loadField();
    }, [currentOrg, loadField]);

    // Add field polygon (and NDVI if active) to map
    const setupMapLayers = useCallback((map: maplibregl.Map) => {
        const f = fieldRef.current;
        if (!f?.geom) return;

        // Remove existing layers/source first to avoid stale state
        if (map.getLayer("field-outline")) map.removeLayer("field-outline");
        if (map.getLayer("field-fill")) map.removeLayer("field-fill");
        if (map.getSource("field-polygon")) map.removeSource("field-polygon");

        map.addSource("field-polygon", {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: f.geom },
        });
        map.addLayer({
            id: "field-fill",
            type: "fill",
            source: "field-polygon",
            paint: { "fill-color": "#22c55e", "fill-opacity": 0.2 },
        });
        map.addLayer({
            id: "field-outline",
            type: "line",
            source: "field-polygon",
            paint: { "line-color": "#16a34a", "line-width": 2 },
        });

        // Re-add NDVI if active
        const ndvi = ndviLayerRef.current;
        if (ndvi?.tile_url) {
            addNdviOverlay(map, ndvi, f);
        }
    }, []);

    // Callback from BaseMap when ready
    const handleMapReady = useCallback(
        (map: maplibregl.Map) => {
            setMapInstance(map);
            setupMapLayers(map);

            // Fit to field bounds
            if (field?.geom) {
                try {
                    const bounds = new maplibregl.LngLatBounds();
                    const coords = getAllCoords(field.geom);
                    coords.forEach(([lng, lat]) => bounds.extend([lng, lat]));
                    if (!bounds.isEmpty()) {
                        map.fitBounds(bounds, { padding: 60, maxZoom: 17 });
                    }
                } catch { }
            }
        },
        [field, setupMapLayers],
    );

    // Location search
    const handleLocationSelect = useCallback(
        (lngLat: [number, number]) => {
            mapInstance?.flyTo({ center: lngLat, zoom: 16, duration: 1500 });
        },
        [mapInstance],
    );

    // Map style change — poll isStyleLoaded() to re-add layers reliably
    const handleStyleChange = useCallback(
        (styleId: MapStyleId) => {
            if (!mapInstance) return;
            const styleDef = MAP_STYLES.find((s) => s.id === styleId);
            if (!styleDef) return;

            mapInstance.setStyle(styleDef.style);
            setMapStyle(styleId);

            // Poll until the new style is loaded, then re-add our layers
            const poll = setInterval(() => {
                try {
                    if (mapInstance.isStyleLoaded()) {
                        clearInterval(poll);
                        setupMapLayers(mapInstance);
                    }
                } catch {
                    clearInterval(poll);
                }
            }, 50);

            // Safety: stop polling after 5s
            setTimeout(() => clearInterval(poll), 5000);
        },
        [mapInstance, setupMapLayers],
    );

    // NDVI tile overlay management
    useEffect(() => {
        const map = mapInstance;
        if (!map || !map.isStyleLoaded()) return;
        removeNdviOverlay(map);
        if (ndviLayer?.tile_url && field) {
            addNdviOverlay(map, ndviLayer, field);
        }
    }, [ndviLayer, field, mapInstance]);

    const handleShowLayer = useCallback((layer: RasterLayer | null) => {
        setNdviLayer(layer);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const data: any = {};
            if (editName.trim() !== field?.name) data.name = editName.trim();
            if (editCropType.trim() !== (field?.crop_type || ""))
                data.crop_type = editCropType.trim() || null;
            if (editSeason.trim() !== (field?.season || ""))
                data.season = editSeason.trim() || null;
            if (editGeom && JSON.stringify(editGeom) !== JSON.stringify(field?.geom))
                data.geom = editGeom;

            const updated = await fieldsApi.update(fieldId, data);
            setField(updated);
            setEditing(false);
            toast.success(t("fieldUpdated"));
        } catch (err: any) {
            toast.error(err.detail || t("failedUpdate"));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        const ok = await confirm({
            title: t("delete"),
            description: t("confirmDelete"),
            confirmLabel: t("delete"),
            variant: "destructive",
        });
        if (!ok) return;
        try {
            await fieldsApi.delete(fieldId);
            toast.success(t("fieldDeleted"));
            router.push(`/farms/${farmId}`);
        } catch (err: any) {
            toast.error(err.detail || t("failedDelete"));
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center bg-muted">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!field) return null;

    return (
        <div className="relative h-full w-full overflow-hidden">
            {/* Full-screen map */}
            <div className="absolute inset-0">
                {editing ? (
                    <DrawMap
                        initialGeometry={field.geom}
                        onGeometryChange={(g) => setEditGeom(g)}
                        onMapReady={(m) => setMapInstance(m)}
                    />
                ) : (
                    <BaseMap onMapReady={handleMapReady} />
                )}
            </div>

            {/* Top-left: Back + Style Switcher + Search */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                <Link
                    href={`/farms/${farmId}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-background/90 backdrop-blur-sm px-3 py-2 text-sm font-medium text-foreground shadow-md border border-border/50 hover:bg-background transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    {t("backToFarm")}
                </Link>
                <MapStyleSwitcher currentStyle={mapStyle} onStyleChange={handleStyleChange} />
                <LocationSearch onSelect={handleLocationSelect} />
            </div>

            {/* NDVI Legend — bottom-left, visible when NDVI overlay is active */}
            {ndviLayer && (
                <div className="absolute bottom-6 left-4 z-20 transition-opacity duration-200">
                    <NdviLegend layer={ndviLayer} />
                </div>
            )}

            {/* Sidebar toggle button — always visible */}
            <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="absolute top-4 z-20 rounded-lg bg-background/90 backdrop-blur-sm p-2 shadow-md border border-border/50 hover:bg-background transition-all"
                style={{ right: sidebarOpen ? "21.5rem" : "1rem" }}
                title={sidebarOpen ? "Hide panel" : "Show panel"}
            >
                {sidebarOpen ? (
                    <PanelRightClose className="h-4 w-4 text-foreground" />
                ) : (
                    <PanelRight className="h-4 w-4 text-foreground" />
                )}
            </button>

            {/* Floating tabbed sidebar — right */}
            <div
                className={`absolute top-4 right-4 bottom-4 z-10 w-80 transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "translate-x-[calc(100%+1rem)]"
                    }`}
            >
                <div className="rounded-xl bg-background/95 backdrop-blur-sm shadow-lg border border-border/50 overflow-hidden flex flex-col h-full">
                    <Tabs defaultValue="info" className="flex flex-col flex-1 overflow-hidden">
                        <TabsList className="grid w-full grid-cols-5 rounded-none border-b border-border/50 bg-transparent h-auto p-0 shrink-0">
                            <TabsTrigger
                                value="info"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent text-xs gap-1 py-2.5"
                            >
                                {t("tabInfo")}
                            </TabsTrigger>
                            <TabsTrigger
                                value="ndvi"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent text-xs gap-1 py-2.5"
                            >
                                {t("tabNdvi")}
                            </TabsTrigger>
                            <TabsTrigger
                                value="alerts"
                                disabled
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent text-xs gap-1 py-2.5"
                            >
                                <Bell className="h-3.5 w-3.5" />
                                {t("tabAlerts")}
                            </TabsTrigger>
                            <TabsTrigger
                                value="scouting"
                                disabled
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent text-xs gap-1 py-2.5"
                            >
                                <ClipboardList className="h-3.5 w-3.5" />
                                {t("tabScouting")}
                            </TabsTrigger>
                            <TabsTrigger
                                value="share"
                                disabled
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent text-xs gap-1 py-2.5"
                            >
                                <Share2 className="h-3.5 w-3.5" />
                                {t("tabShare")}
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-y-auto">
                            {editing ? (
                                <div className="p-4">
                                    <h3 className="text-sm font-semibold mb-3">{t("editField")}</h3>
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="edit-name" className="text-xs">
                                                {t("name")}
                                            </Label>
                                            <Input
                                                id="edit-name"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="edit-crop" className="text-xs">
                                                {t("cropType")}
                                            </Label>
                                            <Input
                                                id="edit-crop"
                                                value={editCropType}
                                                onChange={(e) => setEditCropType(e.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="edit-season" className="text-xs">
                                                {t("season")}
                                            </Label>
                                            <Input
                                                id="edit-season"
                                                value={editSeason}
                                                onChange={(e) => setEditSeason(e.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {t("editHint")}
                                        </p>
                                        <div className="flex gap-2">
                                            <Button
                                                className="flex-1 h-9"
                                                onClick={handleSave}
                                                disabled={saving}
                                            >
                                                {saving ? (
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                ) : (
                                                    <Save className="h-4 w-4 mr-2" />
                                                )}
                                                {t("save")}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="flex-1 h-9"
                                                onClick={() => setEditing(false)}
                                            >
                                                <X className="h-4 w-4 mr-2" /> {t("cancel")}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <TabsContent value="info" className="mt-0 p-4">
                                        {/* Field header */}
                                        <div className="mb-4">
                                            <h2 className="text-base font-bold">{field.name}</h2>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {field.area_ha
                                                    ? `${field.area_ha.toFixed(2)} ha`
                                                    : ""}
                                                {field.crop_type && ` · ${field.crop_type}`}
                                                {field.season && ` · ${field.season}`}
                                            </p>
                                        </div>

                                        {/* Field info */}
                                        <dl className="space-y-2.5">
                                            <InfoRow label={t("name")} value={field.name} />
                                            <InfoRow
                                                label={t("area")}
                                                value={
                                                    field.area_ha
                                                        ? `${field.area_ha.toFixed(2)} ha`
                                                        : "—"
                                                }
                                            />
                                            <InfoRow
                                                label={t("cropType")}
                                                value={field.crop_type || "—"}
                                            />
                                            <InfoRow
                                                label={t("season")}
                                                value={field.season || "—"}
                                            />
                                            <InfoRow
                                                label={t("tags")}
                                                value={field.tags?.join(", ") || "—"}
                                            />
                                            <InfoRow
                                                label={t("created")}
                                                value={new Date(
                                                    field.created_at,
                                                ).toLocaleDateString()}
                                            />
                                            <InfoRow
                                                label={t("updated")}
                                                value={new Date(
                                                    field.updated_at,
                                                ).toLocaleDateString()}
                                            />
                                        </dl>

                                        <Separator className="my-4" />

                                        {/* Actions */}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full"
                                            onClick={() => setEditing(true)}
                                        >
                                            <Edit2 className="h-3.5 w-3.5 mr-2" />
                                            {t("edit")}
                                        </Button>

                                        <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs font-medium text-destructive">
                                                        {t("delete")}
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                                        {t("confirmDelete")}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    className="h-7 px-3 text-xs shrink-0"
                                                    onClick={handleDelete}
                                                >
                                                    <Trash2 className="h-3 w-3 mr-2" />
                                                    {t("delete")}
                                                </Button>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="ndvi" className="mt-0 p-4">
                                        <NdviTab fieldId={fieldId} onShowLayer={handleShowLayer} />
                                    </TabsContent>

                                    <TabsContent value="alerts" className="mt-0">
                                        <div className="flex flex-col items-center justify-center text-center py-12">
                                            <p className="text-sm text-muted-foreground">
                                                {t("alertsPlaceholder")}
                                            </p>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="scouting" className="mt-0">
                                        <div className="flex flex-col items-center justify-center text-center py-12">
                                            <p className="text-sm text-muted-foreground">
                                                {t("scoutingPlaceholder")}
                                            </p>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="share" className="mt-0">
                                        <div className="flex flex-col items-center justify-center text-center py-12">
                                            <p className="text-sm text-muted-foreground">
                                                {t("sharePlaceholder")}
                                            </p>
                                        </div>
                                    </TabsContent>
                                </>
                            )}
                        </div>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-sm">{value}</dd>
        </div>
    );
}

function getAllCoords(geom: GeoJSON.Geometry): number[][] {
    if (geom.type === "Point") return [geom.coordinates as number[]];
    if (geom.type === "Polygon") return (geom.coordinates as number[][][]).flat();
    if (geom.type === "MultiPolygon") return (geom.coordinates as number[][][][]).flat(2);
    return [];
}
