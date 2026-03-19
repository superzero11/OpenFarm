"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import {
    scoutingApi,
    uploadsApi,
    alertsApi,
    getPhotoUrl,
    type ScoutingObservation,
    type ScoutingCreate,
    type Alert,
    type Paginated,
} from "@/lib/api";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/confirm-dialog";
import {
    Plus,
    Trash2,
    Edit3,
    MapPin,
    Camera,
    X,
    Loader2,
    AlertTriangle,
    Check,
    Image as ImageIcon,
    Crosshair,
    Tag,
    CloudRain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useTranslations } from "next-intl";

/* ── Constants ─────────────────────────────────────────────── */

const SCOUTING_SOURCE = "scouting-points";
const SCOUTING_LAYER = "scouting-circles";
const SCOUTING_LAYER_STROKE = "scouting-circles-stroke";
const PICK_SOURCE = "scouting-pick-point";
const PICK_LAYER = "scouting-pick-marker";

const MARKER_COLOR = "#f59e0b"; // amber-500
const PICK_COLOR = "#3b82f6"; // blue-500

/* ── Props ─────────────────────────────────────────────────── */

interface ScoutingTabProps {
    fieldId: string;
    mapInstance: maplibregl.Map | null;
    activeTab?: string;
}

/* ── Component ─────────────────────────────────────────────── */

export default function ScoutingTab({ fieldId, mapInstance, activeTab }: ScoutingTabProps) {
    const t = useTranslations("scoutingTab");
    const confirm = useConfirm();

    // Data
    const [observations, setObservations] = useState<ScoutingObservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);

    // Lightbox state
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [lightboxTitle, setLightboxTitle] = useState("");

    // Form state
    const [formOpen, setFormOpen] = useState(false);
    const [editingObs, setEditingObs] = useState<ScoutingObservation | null>(null);
    const [title, setTitle] = useState("");
    const [note, setNote] = useState("");
    const [tagsInput, setTagsInput] = useState("");
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [alertId, setAlertId] = useState<string>("");
    const [pickedPoint, setPickedPoint] = useState<[number, number] | null>(null);
    const [pickingMode, setPickingMode] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Alerts for linking
    const [fieldAlerts, setFieldAlerts] = useState<Alert[]>([]);

    // Refs for map listeners
    const pickingRef = useRef(false);
    const mapClickRef = useRef<((e: maplibregl.MapMouseEvent) => void) | null>(null);
    const highlightedRef = useRef<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    /* ── Load observations ─────────────────────────────────── */

    const loadObservations = useCallback(async () => {
        try {
            const res = await scoutingApi.list(fieldId, 200);
            setObservations(res.items);
            setTotal(res.total);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [fieldId]);

    useEffect(() => {
        loadObservations();
    }, [loadObservations]);

    // Load field alerts (all — for linked alert display; open subset for dropdown)
    useEffect(() => {
        alertsApi
            .listForField(fieldId, 200)
            .then((res) => setFieldAlerts(res.items))
            .catch(() => { });
    }, [fieldId]);

    const openAlerts = fieldAlerts.filter((a) => a.status === "open");

    /* ── Map markers ───────────────────────────────────────── */

    // Add/update scouting markers on the map (pin icon)
    useEffect(() => {
        const map = mapInstance;
        if (!map) return;

        const geojson: GeoJSON.FeatureCollection = {
            type: "FeatureCollection",
            features: observations
                .filter((o) => o.geom_point)
                .map((o) => ({
                    type: "Feature" as const,
                    properties: { id: o.id, title: o.title },
                    geometry: o.geom_point!,
                })),
        };

        const addLayers = () => {
            if (!map.getSource(SCOUTING_SOURCE)) {
                map.addSource(SCOUTING_SOURCE, { type: "geojson", data: geojson });
            } else {
                (map.getSource(SCOUTING_SOURCE) as maplibregl.GeoJSONSource).setData(geojson);
            }

            if (!map.getLayer(SCOUTING_LAYER)) {
                map.addLayer({
                    id: SCOUTING_LAYER_STROKE,
                    type: "circle",
                    source: SCOUTING_SOURCE,
                    paint: {
                        "circle-radius": 10,
                        "circle-color": "transparent",
                        "circle-stroke-width": 2.5,
                        "circle-stroke-color": "#ffffff",
                    },
                });
                map.addLayer({
                    id: SCOUTING_LAYER,
                    type: "circle",
                    source: SCOUTING_SOURCE,
                    paint: {
                        "circle-radius": 7,
                        "circle-color": MARKER_COLOR,
                        "circle-opacity": 0.9,
                    },
                });
            }
        };

        if (map.isStyleLoaded()) {
            addLayers();
        } else {
            map.once("style.load", addLayers);
        }

        return () => {
            // Don't remove on unmount — keep markers while tab switches within same mount
        };
    }, [mapInstance, observations]);

    // Toggle scouting layer visibility based on active tab
    useEffect(() => {
        const map = mapInstance;
        if (!map) return;
        const visible = activeTab === "scouting" ? "visible" : "none";
        try {
            if (map.getLayer(SCOUTING_LAYER)) map.setLayoutProperty(SCOUTING_LAYER, "visibility", visible);
            if (map.getLayer(SCOUTING_LAYER_STROKE)) map.setLayoutProperty(SCOUTING_LAYER_STROKE, "visibility", visible);
        } catch { /* layer may not exist yet */ }
    }, [mapInstance, activeTab]);

    // Click handler on map markers → show popup + highlight sidebar card
    const observationsRef = useRef(observations);
    observationsRef.current = observations;

    useEffect(() => {
        const map = mapInstance;
        if (!map) return;

        const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: "260px", className: "openfarm-popup" });

        const onClick = (e: maplibregl.MapMouseEvent) => {
            if (pickingRef.current) return;
            const features = map.queryRenderedFeatures(e.point, {
                layers: [SCOUTING_LAYER],
            });
            if (features.length > 0) {
                const obsId = features[0].properties?.id as string;
                highlightedRef.current = obsId;

                // Scroll to sidebar card
                const el = document.getElementById(`scouting-obs-${obsId}`);
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
                el?.classList.add("ring-2", "ring-primary");
                setTimeout(() => el?.classList.remove("ring-2", "ring-primary"), 2000);

                // Show popup on map
                const obs = observationsRef.current.find((o) => o.id === obsId);
                if (obs && obs.geom_point) {
                    const coords = obs.geom_point.coordinates as [number, number];
                    const date = new Date(obs.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
                    const tagsHtml = obs.tags?.length ? obs.tags.map((tg) => `<span class="openfarm-popup-tag">${tg}</span>`).join("") : "";
                    const noteHtml = obs.note ? `<div class="openfarm-popup-note">${obs.note.length > 100 ? obs.note.slice(0, 100) + "\u2026" : obs.note}</div>` : "";
                    const html = `<div class="openfarm-popup-body">
                        <div class="openfarm-popup-title">\ud83d\udccd ${obs.title}</div>
                        <div class="openfarm-popup-meta">${date}</div>
                        ${noteHtml}
                        ${tagsHtml ? `<div class="openfarm-popup-tags">${tagsHtml}</div>` : ""}
                    </div>`;
                    popup.setLngLat(coords).setHTML(html).addTo(map);
                }
            }
        };

        map.on("click", SCOUTING_LAYER, onClick);

        // Change cursor on hover
        const onEnter = () => { map.getCanvas().style.cursor = "pointer"; };
        const onLeave = () => { map.getCanvas().style.cursor = ""; };
        map.on("mouseenter", SCOUTING_LAYER, onEnter);
        map.on("mouseleave", SCOUTING_LAYER, onLeave);

        return () => {
            popup.remove();
            map.off("click", SCOUTING_LAYER, onClick);
            map.off("mouseenter", SCOUTING_LAYER, onEnter);
            map.off("mouseleave", SCOUTING_LAYER, onLeave);
        };
    }, [mapInstance]);

    // Cleanup map layers on unmount
    useEffect(() => {
        return () => {
            const map = mapInstance;
            if (!map) return;
            try {
                if (map.getLayer(SCOUTING_LAYER)) map.removeLayer(SCOUTING_LAYER);
                if (map.getLayer(SCOUTING_LAYER_STROKE)) map.removeLayer(SCOUTING_LAYER_STROKE);
                if (map.getSource(SCOUTING_SOURCE)) map.removeSource(SCOUTING_SOURCE);
                if (map.getLayer(PICK_LAYER)) map.removeLayer(PICK_LAYER);
                if (map.getSource(PICK_SOURCE)) map.removeSource(PICK_SOURCE);
            } catch {
                // style may have been removed already
            }
        };
    }, [mapInstance]);

    /* ── Point picking ─────────────────────────────────────── */

    const stopPointPick = useCallback(() => {
        const map = mapInstance;
        if (!map) return;
        setPickingMode(false);
        pickingRef.current = false;
        map.getCanvas().style.cursor = "";
        if (mapClickRef.current) {
            map.off("click", mapClickRef.current);
            mapClickRef.current = null;
        }
    }, [mapInstance]);

    const startPointPick = useCallback(() => {
        const map = mapInstance;
        if (!map) return;

        setPickingMode(true);
        pickingRef.current = true;
        map.getCanvas().style.cursor = "crosshair";

        const handler = (e: maplibregl.MapMouseEvent) => {
            const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
            setPickedPoint(lngLat);

            // Show/update pick marker
            const geojson: GeoJSON.FeatureCollection = {
                type: "FeatureCollection",
                features: [
                    {
                        type: "Feature",
                        properties: {},
                        geometry: {
                            type: "Point",
                            coordinates: lngLat,
                        },
                    },
                ],
            };

            if (!map.getSource(PICK_SOURCE)) {
                map.addSource(PICK_SOURCE, { type: "geojson", data: geojson });
                map.addLayer({
                    id: PICK_LAYER,
                    type: "circle",
                    source: PICK_SOURCE,
                    paint: {
                        "circle-radius": 8,
                        "circle-color": PICK_COLOR,
                        "circle-opacity": 0.9,
                        "circle-stroke-width": 3,
                        "circle-stroke-color": "#ffffff",
                    },
                });
            } else {
                (map.getSource(PICK_SOURCE) as maplibregl.GeoJSONSource).setData(geojson);
            }

            // Stop picking after one click
            stopPointPick();
        };

        mapClickRef.current = handler;
        map.once("click", handler);
    }, [mapInstance, stopPointPick]);

    const clearPickedPoint = useCallback(() => {
        setPickedPoint(null);
        stopPointPick();
        const map = mapInstance;
        if (!map) return;
        try {
            if (map.getLayer(PICK_LAYER)) map.removeLayer(PICK_LAYER);
            if (map.getSource(PICK_SOURCE)) map.removeSource(PICK_SOURCE);
        } catch { }
    }, [mapInstance, stopPointPick]);

    /* ── Form helpers ──────────────────────────────────────── */

    const resetForm = useCallback(() => {
        setTitle("");
        setNote("");
        setTagsInput("");
        setPhotoFile(null);
        setPhotoPreview(null);
        setAlertId("");
        setPickedPoint(null);
        setEditingObs(null);
        setFormOpen(false);
        stopPointPick();
        // remove pick marker
        const map = mapInstance;
        if (map) {
            try {
                if (map.getLayer(PICK_LAYER)) map.removeLayer(PICK_LAYER);
                if (map.getSource(PICK_SOURCE)) map.removeSource(PICK_SOURCE);
            } catch { }
        }
    }, [mapInstance, stopPointPick]);

    const openEditForm = useCallback((obs: ScoutingObservation) => {
        setEditingObs(obs);
        setTitle(obs.title);
        setNote(obs.note || "");
        setTagsInput(obs.tags?.join(", ") || "");
        setFormOpen(true);
    }, []);

    const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            toast.error("File too large (max 10 MB)");
            return;
        }
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
    }, []);

    /* ── Submit ─────────────────────────────────────────────── */

    const handleSubmit = async () => {
        if (editingObs) {
            // Update existing
            setSubmitting(true);
            try {
                const tags = tagsInput
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                const updated = await scoutingApi.update(fieldId, editingObs.id, {
                    title: title.trim(),
                    note: note.trim() || undefined,
                    tags: tags.length > 0 ? tags : undefined,
                });
                setObservations((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
                toast.success(t("observationUpdated"));
                resetForm();
            } catch (err: any) {
                toast.error(err.detail || t("failedUpdate"));
            } finally {
                setSubmitting(false);
            }
            return;
        }

        // Create new
        if (!pickedPoint) {
            toast.error(t("pickPoint"));
            return;
        }
        if (!title.trim()) return;

        setSubmitting(true);
        try {
            // Upload photo if selected
            let photoUri: string | undefined;
            if (photoFile) {
                try {
                    photoUri = await uploadsApi.upload(photoFile);
                } catch {
                    toast.error(t("uploadFailed"));
                    setSubmitting(false);
                    return;
                }
            }

            const tags = tagsInput
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);

            const data: ScoutingCreate = {
                geom_point: {
                    type: "Point",
                    coordinates: pickedPoint,
                },
                title: title.trim(),
                note: note.trim() || undefined,
                tags: tags.length > 0 ? tags : undefined,
                photo_uri: photoUri,
                alert_id: alertId || undefined,
            };

            const created = await scoutingApi.create(fieldId, data);
            setObservations((prev) => [created, ...prev]);
            setTotal((t) => t + 1);
            toast.success(t("observationCreated"));
            resetForm();
        } catch (err: any) {
            toast.error(err.detail || t("failedCreate"));
        } finally {
            setSubmitting(false);
        }
    };

    /* ── Delete ─────────────────────────────────────────────── */

    const handleDelete = async (obsId: string) => {
        const confirmed = await confirm({
            title: t("delete"),
            description: t("confirmDelete"),
            confirmLabel: t("delete"),
            cancelLabel: t("cancel"),
            variant: "destructive",
        });
        if (!confirmed) return;

        setDeletingId(obsId);
        try {
            await scoutingApi.delete(fieldId, obsId);
            setObservations((prev) => prev.filter((o) => o.id !== obsId));
            setTotal((t) => t - 1);
            toast.success(t("observationDeleted"));
        } catch (err: any) {
            toast.error(err.detail || t("failedDelete"));
        } finally {
            setDeletingId(null);
        }
    };

    /* ── Fly to observation on map ─────────────────────────── */

    const flyToObservation = useCallback(
        (obs: ScoutingObservation) => {
            if (!mapInstance || !obs.geom_point) return;
            const [lng, lat] = obs.geom_point.coordinates;
            mapInstance.flyTo({ center: [lng, lat], zoom: 17, duration: 1000 });
        },
        [mapInstance],
    );

    /* ── Render: Loading ───────────────────────────────────── */

    if (loading) {
        return (
            <div className="space-y-3 p-4">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
            </div>
        );
    }

    /* ── Render: Form ──────────────────────────────────────── */

    if (formOpen) {
        return (
            <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                        {editingObs ? t("editObservation") : t("addObservation")}
                    </h3>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={resetForm}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Location picker (only for new observations) */}
                {!editingObs && (
                    <div className="space-y-1.5">
                        <Label className="text-xs">{t("locationLabel")}</Label>
                        {pickedPoint ? (
                            <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/50">
                                <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span className="text-xs text-foreground">
                                    {pickedPoint[1].toFixed(5)}, {pickedPoint[0].toFixed(5)}
                                </span>
                                <span className="text-[10px] text-green-600 font-medium ml-auto">{t("pointSet")}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-1 text-[10px]"
                                    onClick={clearPickedPoint}
                                >
                                    {t("clearPoint")}
                                </Button>
                            </div>
                        ) : pickingMode ? (
                            <div className="flex items-center gap-2 rounded-md border border-blue-300 bg-blue-50 dark:bg-blue-950/20 px-3 py-2">
                                <Crosshair className="h-3.5 w-3.5 text-blue-500 animate-pulse shrink-0" />
                                <span className="text-xs text-blue-700 dark:text-blue-300">
                                    {t("pickingPoint")}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-1 text-[10px] ml-auto"
                                    onClick={stopPointPick}
                                >
                                    {t("cancel")}
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full h-9 text-xs"
                                onClick={startPointPick}
                            >
                                <Crosshair className="h-3.5 w-3.5 mr-2" />
                                {t("pickPoint")}
                            </Button>
                        )}
                    </div>
                )}

                {/* Title */}
                <div className="space-y-1.5">
                    <Label htmlFor="scout-title" className="text-xs">
                        {t("titleLabel")} *
                    </Label>
                    <Input
                        id="scout-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={t("titlePlaceholder")}
                        className="h-9"
                        maxLength={255}
                    />
                </div>

                {/* Note */}
                <div className="space-y-1.5">
                    <Label htmlFor="scout-note" className="text-xs">
                        {t("noteLabel")}
                    </Label>
                    <textarea
                        id="scout-note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={t("notePlaceholder")}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px] resize-none"
                    />
                </div>

                {/* Tags */}
                <div className="space-y-1.5">
                    <Label htmlFor="scout-tags" className="text-xs">
                        {t("tagsLabel")}
                    </Label>
                    <Input
                        id="scout-tags"
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        placeholder={t("tagsPlaceholder")}
                        className="h-9"
                    />
                </div>

                {/* Photo upload (only for new observations) */}
                {!editingObs && (
                    <div className="space-y-1.5">
                        <Label className="text-xs">{t("photoLabel")}</Label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePhotoChange}
                        />
                        {photoPreview ? (
                            <div className="relative rounded-lg overflow-hidden border">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={photoPreview}
                                    alt="Preview"
                                    className="w-full h-32 object-cover"
                                />
                                <div className="absolute top-1 right-1 flex gap-1">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="h-6 px-2 text-[10px]"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        {t("changePhoto")}
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={() => {
                                            setPhotoFile(null);
                                            setPhotoPreview(null);
                                        }}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 transition-colors py-6 flex flex-col items-center gap-1.5"
                            >
                                <Camera className="h-5 w-5 text-muted-foreground/50" />
                                <span className="text-xs text-muted-foreground">
                                    {t("dropPhoto")}
                                </span>
                                <span className="text-[10px] text-muted-foreground/60">
                                    {t("maxSize")}
                                </span>
                            </button>
                        )}
                    </div>
                )}

                {/* Link to alert (only for new observations) */}
                {!editingObs && (
                    <div className="space-y-1.5">
                        <Label htmlFor="scout-alert" className="text-xs">
                            {t("alertLabel")}
                        </Label>
                        {openAlerts.length > 0 ? (
                            <Select
                                value={alertId}
                                onValueChange={(val) => setAlertId(val === "__none__" ? "" : val)}
                            >
                                <SelectTrigger id="scout-alert" className="h-9 text-sm">
                                    <SelectValue placeholder={t("alertPlaceholder")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">
                                        {t("alertPlaceholder")}
                                    </SelectItem>
                                    {openAlerts.map((a) => (
                                        <SelectItem key={a.id} value={a.id}>
                                            [{a.severity}] {a.message.substring(0, 60)}
                                            {a.message.length > 60 ? "…" : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <p className="text-xs text-muted-foreground italic px-1">
                                {t("noOpenAlerts")}
                            </p>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                    <Button
                        className="flex-1 h-9"
                        onClick={handleSubmit}
                        disabled={submitting || (!editingObs && (!pickedPoint || !title.trim()))}
                    >
                        {submitting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Check className="h-4 w-4 mr-2" />
                        )}
                        {submitting ? t("saving") : t("save")}
                    </Button>
                    <Button variant="outline" className="flex-1 h-9" onClick={resetForm}>
                        {t("cancel")}
                    </Button>
                </div>
            </div>
        );
    }

    /* ── Render: Empty state ───────────────────────────────── */

    if (observations.length === 0) {
        return (
            <div className="p-4">
                <div className="flex flex-col items-center justify-center text-center py-8">
                    <MapPin className="h-8 w-8 text-primary/40 mb-2" />
                    <p className="text-sm font-medium">{t("noObservations")}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("noObservationsDesc")}</p>
                    <Button
                        size="sm"
                        className="mt-4 h-8"
                        onClick={() => setFormOpen(true)}
                    >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        {t("addObservation")}
                    </Button>
                </div>
            </div>
        );
    }

    /* ── Render: Observation list ───────────────────────────── */

    return (
        <div className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                    {t("observations", { count: total })}
                </p>
                <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setFormOpen(true)}
                >
                    <Plus className="h-3 w-3 mr-1" />
                    {t("addObservation")}
                </Button>
            </div>

            {/* List */}
            <div className="space-y-2">
                {observations.map((obs) => (
                    <div
                        key={obs.id}
                        id={`scouting-obs-${obs.id}`}
                        className="rounded-lg border bg-card shadow-sm p-3 transition-all hover:shadow-md"
                    >
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-2">
                            <div
                                className="flex-1 min-w-0 cursor-pointer"
                                onClick={() => flyToObservation(obs)}
                            >
                                <h4 className="text-sm font-medium leading-tight">
                                    {obs.title}
                                </h4>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {new Date(obs.created_at).toLocaleDateString(undefined, {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                    {obs.geom_point && (
                                        <span className="ml-1.5">
                                            <MapPin className="h-2.5 w-2.5 inline -mt-0.5" />{" "}
                                            {obs.geom_point.coordinates[1].toFixed(4)},{" "}
                                            {obs.geom_point.coordinates[0].toFixed(4)}
                                        </span>
                                    )}
                                </p>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => openEditForm(obs)}
                                    title={t("editObservation")}
                                >
                                    <Edit3 className="h-3 w-3" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                    onClick={() => handleDelete(obs.id)}
                                    disabled={deletingId === obs.id}
                                    title={t("delete")}
                                >
                                    {deletingId === obs.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-3 w-3" />
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Note */}
                        {obs.note && (
                            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                                {obs.note}
                            </p>
                        )}

                        {/* Weather snapshot */}
                        {obs.weather_snapshot && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                                <CloudRain className="h-3 w-3 shrink-0" />
                                {obs.weather_snapshot.precipitation_7d_mm != null && (
                                    <span>{t("precip7d")}: {obs.weather_snapshot.precipitation_7d_mm}mm</span>
                                )}
                                {obs.weather_snapshot.temp_max_c != null && (
                                    <span>{obs.weather_snapshot.temp_min_c}–{obs.weather_snapshot.temp_max_c}°C</span>
                                )}
                                {obs.weather_snapshot.soil_moisture_top != null && (
                                    <span>{t("soilMoisture")}: {(obs.weather_snapshot.soil_moisture_top * 100).toFixed(0)}%</span>
                                )}
                                {obs.weather_snapshot.wind_max_kmh != null && (
                                    <span>{t("wind")}: {obs.weather_snapshot.wind_max_kmh} km/h</span>
                                )}
                            </div>
                        )}

                        {/* Photo thumbnail */}
                        {obs.photo_uri && (
                            <div className="mt-2 rounded-md overflow-hidden border">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={getPhotoUrl(obs.photo_uri)}
                                    alt={obs.title}
                                    className="w-full h-24 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => {
                                        setLightboxUrl(getPhotoUrl(obs.photo_uri!));
                                        setLightboxTitle(obs.title);
                                    }}
                                    loading="lazy"
                                />
                            </div>
                        )}

                        {/* Linked alert card */}
                        {obs.alert_id && (() => {
                            const linked = fieldAlerts.find((a) => a.id === obs.alert_id);
                            const isClosed = linked?.status === "closed";
                            return (
                                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-2">
                                    <div className="flex items-start gap-1.5">
                                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                                                    {t("linkedAlert")}
                                                </p>
                                                {linked && (
                                                    <Badge
                                                        variant={isClosed ? "outline" : "secondary"}
                                                        className={`text-[8px] px-1 py-0 h-3.5 ${isClosed ? "text-muted-foreground" : "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200"}`}
                                                    >
                                                        {isClosed ? "Closed" : "Open"}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5 leading-relaxed">
                                                {linked
                                                    ? `[${linked.severity}] ${linked.message}`
                                                    : t("linkedAlert")}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Tags */}
                        {obs.tags && obs.tags.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 mt-2">
                                {obs.tags.map((tag) => (
                                    <Badge
                                        key={tag}
                                        variant="secondary"
                                        className="text-[9px] px-1.5 py-0 h-4"
                                    >
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Photo lightbox */}
            <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
                <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black/95 border-none [&>button]:text-white [&>button]:hover:bg-white/20">
                    <DialogTitle className="sr-only">{lightboxTitle}</DialogTitle>
                    {lightboxUrl && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                            src={lightboxUrl}
                            alt={lightboxTitle}
                            className="w-full max-h-[80vh] object-contain"
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
