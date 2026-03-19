/**
 * OpenFarm API client.
 *
 * Handles JWT token lifecycle (mint / cache / re-mint) and X-Org-Id header injection.
 * All methods return typed responses; throws on HTTP errors.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/v1";

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

/** Mint (or re-use) an API JWT via the NextAuth bridge endpoint. */
async function getToken(): Promise<string> {
    const now = Date.now();
    // Re-use if >60s remaining
    if (cachedToken && tokenExpiresAt - now > 60_000) {
        return cachedToken;
    }

    const res = await fetch("/api/auth/token", { method: "POST" });
    if (!res.ok) {
        throw new Error("Failed to mint API token — are you signed in?");
    }
    const data = await res.json();
    cachedToken = data.token;
    tokenExpiresAt = new Date(data.expires_at).getTime();
    return cachedToken!;
}

/** Get the currently selected org ID from localStorage. */
export function getOrgId(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("openfarm_org_id");
}

export function setOrgId(orgId: string) {
    if (typeof window !== "undefined") {
        localStorage.setItem("openfarm_org_id", orgId);
    }
}

export class ApiError extends Error {
    status: number;
    detail: string;
    constructor(status: number, detail: string) {
        super(detail);
        this.status = status;
        this.detail = detail;
    }
}

/** Core fetch wrapper — adds Authorization + X-Org-Id headers. */
async function apiFetch<T>(
    path: string,
    opts: RequestInit & { orgId?: string | null; skipOrg?: boolean } = {},
): Promise<T> {
    const { orgId, skipOrg, ...fetchOpts } = opts;
    const token = await getToken();
    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        ...(fetchOpts.headers as Record<string, string>),
    };

    const org = orgId ?? getOrgId();
    if (org && !skipOrg) {
        headers["X-Org-Id"] = org;
    }

    // Don't set Content-Type for FormData
    if (!(fetchOpts.body instanceof FormData) && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${API_BASE}${path}`, { ...fetchOpts, headers });

    if (!res.ok) {
        let detail = res.statusText;
        try {
            const body = await res.json();
            detail = body.detail || JSON.stringify(body);
        } catch { }
        throw new ApiError(res.status, detail);
    }

    if (res.status === 204) return undefined as T;
    return res.json();
}

// ── Types ────────────────────────────────────────────────────────────

export interface Paginated<T> {
    items: T[];
    total: number;
    limit: number;
    offset: number;
}

export interface Org {
    id: string;
    name: string;
    created_by: string;
    created_at: string;
}

export interface OrgDetail extends Org {
    member_count: number;
    farm_count: number;
}

export interface OrgBrief {
    id: string;
    name: string;
    role: string;
}

export interface UserMe {
    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
    created_at: string;
    orgs: OrgBrief[];
}

export interface Member {
    id: string;
    user_id: string;
    email: string;
    name: string;
    role: string;
    created_at: string;
}

export interface Invite {
    id: string;
    org_id: string;
    email: string;
    role: string;
    status: string;
    invited_by_name: string | null;
    created_at: string;
}

export interface Farm {
    id: string;
    org_id: string;
    name: string;
    country: string | null;
    region: string | null;
    timezone: string | null;
    created_at: string;
    updated_at: string;
}

export interface Field {
    id: string;
    org_id: string;
    farm_id: string;
    name: string;
    geom: GeoJSON.Geometry | null;
    area_ha: number | null;
    crop_type: string | null;
    season: string | null;
    tags: string[] | null;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface FieldImportResult {
    imported: number;
    errors: string[];
}

// ── Index Configuration ──────────────────────────────────────────────

export type IndexType = "NDVI" | "EVI" | "SAVI" | "NDWI";

export interface IndexConfig {
    label: string;
    colormap: string;
    rescaleMin: number;
    rescaleMax: number;
    gradient: string;
    threshold: number;
    lineColor: string;
    bandColor: string;
}

export const INDEX_CONFIG: Record<IndexType, IndexConfig> = {
    NDVI: {
        label: "NDVI",
        colormap: "rdylgn",
        rescaleMin: -0.2,
        rescaleMax: 0.9,
        gradient:
            "linear-gradient(to right, #a50026 0%, #d73027 10%, #f46d43 20%, #fdae61 30%, #fee08b 40%, #ffffbf 50%, #d9ef8b 60%, #a6d96a 70%, #66bd63 80%, #1a9850 90%, #006837 100%)",
        threshold: 0.3,
        lineColor: "#16a34a",
        bandColor: "rgba(34, 197, 94, 0.15)",
    },
    EVI: {
        label: "EVI",
        colormap: "rdylgn",
        rescaleMin: -0.2,
        rescaleMax: 0.8,
        gradient:
            "linear-gradient(to right, #a50026 0%, #d73027 10%, #f46d43 20%, #fdae61 30%, #fee08b 40%, #ffffbf 50%, #d9ef8b 60%, #a6d96a 70%, #66bd63 80%, #1a9850 90%, #006837 100%)",
        threshold: 0.2,
        lineColor: "#16a34a",
        bandColor: "rgba(34, 197, 94, 0.15)",
    },
    SAVI: {
        label: "SAVI",
        colormap: "rdylgn",
        rescaleMin: -0.2,
        rescaleMax: 0.8,
        gradient:
            "linear-gradient(to right, #a50026 0%, #d73027 10%, #f46d43 20%, #fdae61 30%, #fee08b 40%, #ffffbf 50%, #d9ef8b 60%, #a6d96a 70%, #66bd63 80%, #1a9850 90%, #006837 100%)",
        threshold: 0.25,
        lineColor: "#16a34a",
        bandColor: "rgba(34, 197, 94, 0.15)",
    },
    NDWI: {
        label: "NDWI",
        colormap: "rdbu",
        rescaleMin: -0.5,
        rescaleMax: 0.5,
        gradient:
            "linear-gradient(to right, #67001f 0%, #b2182b 10%, #d6604d 20%, #f4a582 30%, #fddbc7 40%, #f7f7f7 50%, #d1e5f0 60%, #92c5de 70%, #4393c3 80%, #2166ac 90%, #053061 100%)",
        threshold: 0.0,
        lineColor: "#2166ac",
        bandColor: "rgba(33, 102, 172, 0.15)",
    },
};

export const ALL_INDEX_TYPES: IndexType[] = ["NDVI", "EVI", "SAVI", "NDWI"];

// ── Monitoring Types ─────────────────────────────────────────────────

export interface RasterLayer {
    id: string;
    field_id: string;
    layer_type: string;
    satellite: string;
    date: string;
    cog_uri: string;
    tile_url: string | null;
    min: number | null;
    max: number | null;
    params_json: Record<string, any> | null;
    provenance_json: Record<string, any> | null;
    created_at: string;
}

export interface FieldStat {
    id: string;
    field_id: string;
    date: string;
    mean: number | null;
    median: number | null;
    min: number | null;
    max: number | null;
    p10: number | null;
    p90: number | null;
    stddev: number | null;
    quality_score: number | null;
    created_at: string;
}

export interface NdviJob {
    id: string;
    field_id: string;
    type: string;
    status: string;
    progress_json: Record<string, any> | null;
    error: string | null;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
}

export interface Alert {
    id: string;
    field_id: string;
    date: string;
    severity: string;
    rule_name: string;
    rule_params_json: Record<string, any> | null;
    message: string;
    status: string;
    index_type: string | null;
    weather_context: Record<string, any> | null;
    soil_context: Record<string, any> | null;
    created_at: string;
}

// ── Scouting Types ───────────────────────────────────────────────

export interface ScoutingObservation {
    id: string;
    field_id: string;
    alert_id: string | null;
    geom_point: GeoJSON.Point | null;
    title: string;
    note: string | null;
    tags: string[] | null;
    photo_uri: string | null;
    weather_snapshot: Record<string, any> | null;
    created_by: string;
    created_at: string;
}

export interface ScoutingCreate {
    geom_point: { type: "Point"; coordinates: [number, number] };
    title: string;
    note?: string;
    tags?: string[];
    photo_uri?: string;
    alert_id?: string;
}

export interface ScoutingUpdate {
    title?: string;
    note?: string;
    tags?: string[];
}

// ── Weather Types ────────────────────────────────────────────────

export interface WeatherDaily {
    date: string;
    temperature_2m_min: number | null;
    temperature_2m_max: number | null;
    temperature_2m_mean: number | null;
    precipitation_sum: number | null;
    et0_fao_mm: number | null;
    soil_temperature_0cm: number | null;
    soil_temperature_6cm: number | null;
    soil_temperature_18cm: number | null;
    soil_temperature_54cm: number | null;
    soil_moisture_0_1cm: number | null;
    soil_moisture_1_3cm: number | null;
    soil_moisture_3_9cm: number | null;
    soil_moisture_9_27cm: number | null;
    soil_moisture_27_81cm: number | null;
    vapor_pressure_deficit: number | null;
    shortwave_radiation_sum: number | null;
    wind_speed_10m_max: number | null;
    cloud_cover_mean: number | null;
    gdd_daily: number | null;
    gdd_cumulative: number | null;
    water_balance_30d_mm: number | null;
    drought_index: number | null;
    heat_stress_flag: boolean | null;
}

export interface WeatherForecastDay {
    date: string;
    temperature_2m_min: number | null;
    temperature_2m_max: number | null;
    temperature_2m_mean: number | null;
    precipitation_sum: number | null;
    et0_fao_mm: number | null;
    wind_speed_10m_max: number | null;
    cloud_cover_mean: number | null;
}

export interface WeatherSummary {
    field_id: string;
    period_start: string;
    period_end: string;
    avg_temperature: number | null;
    min_temperature: number | null;
    max_temperature: number | null;
    total_precipitation: number | null;
    total_et0: number | null;
    water_deficit_mm: number | null;
    gdd_cumulative: number | null;
    frost_days: number;
    heat_stress_days: number;
    avg_soil_moisture_top: number | null;
    drought_index: number | null;
    data_source: string;
    last_updated: string | null;
}

export interface WeatherResponse {
    field_id: string;
    location: { latitude: number; longitude: number };
    data: WeatherDaily[];
    forecast: WeatherForecastDay[];
    summary: WeatherSummary;
}

// ── Detection Types ──────────────────────────────────────────────

export interface DetectedBoundary {
    id: string;
    org_id: string;
    job_id: string;
    geom: GeoJSON.Geometry | null;
    area_ha: number | null;
    confidence: number | null;
    status: string;
    detection_date: string | null;
    created_at: string;
}

export interface DetectionJob {
    job_id: string;
    status: string;
}

// ── Upload Types ─────────────────────────────────────────────────

export interface PresignedUpload {
    upload_url: string;
    object_key: string;
}

// ── Users ────────────────────────────────────────────────────────────

export const usersApi = {
    me: () => apiFetch<UserMe>("/users/me", { skipOrg: true }),
};

// ── Orgs ─────────────────────────────────────────────────────────────

export const orgsApi = {
    list: () => apiFetch<Org[]>("/orgs", { skipOrg: true }),
    get: (orgId: string) => apiFetch<OrgDetail>(`/orgs/${orgId}`, { orgId }),
    create: (name: string) => apiFetch<Org>("/orgs", { method: "POST", body: JSON.stringify({ name }), skipOrg: true }),
    update: (orgId: string, name: string) => apiFetch<Org>(`/orgs/${orgId}`, { method: "PATCH", body: JSON.stringify({ name }), orgId }),
    members: (orgId: string) => apiFetch<Paginated<Member>>(`/orgs/${orgId}/members`, { orgId }),
    changeMemberRole: (orgId: string, userId: string, role: string) =>
        apiFetch(`/orgs/${orgId}/members/${userId}`, { method: "PATCH", body: JSON.stringify({ role }), orgId }),
    removeMember: (orgId: string, userId: string) =>
        apiFetch(`/orgs/${orgId}/members/${userId}`, { method: "DELETE", orgId }),
    invite: (orgId: string, email: string, role: string) =>
        apiFetch<Invite>(`/orgs/${orgId}/invites`, { method: "POST", body: JSON.stringify({ email, role }), orgId }),
    listInvites: (orgId: string, status = "pending") =>
        apiFetch<Invite[]>(`/orgs/${orgId}/invites?status=${status}`, { orgId }),
    cancelInvite: (orgId: string, inviteId: string) =>
        apiFetch(`/orgs/${orgId}/invites/${inviteId}`, { method: "DELETE", orgId }),
    transferOwnership: (orgId: string, newOwnerUserId: string) =>
        apiFetch(`/orgs/${orgId}/transfer-ownership`, { method: "POST", body: JSON.stringify({ new_owner_user_id: newOwnerUserId }), orgId }),
    auditEvents: (orgId: string, limit = 50, offset = 0) =>
        apiFetch<Paginated<any>>(`/orgs/${orgId}/audit-events?limit=${limit}&offset=${offset}`, { orgId }),
};

// ── Farms ────────────────────────────────────────────────────────────

export const farmsApi = {
    list: (limit = 50, offset = 0) =>
        apiFetch<Paginated<Farm>>(`/farms?limit=${limit}&offset=${offset}`),
    get: (farmId: string) => apiFetch<Farm>(`/farms/${farmId}`),
    create: (data: { name: string; country?: string; region?: string; timezone?: string }) =>
        apiFetch<Farm>("/farms", { method: "POST", body: JSON.stringify(data) }),
    update: (farmId: string, data: { name?: string; country?: string; region?: string; timezone?: string }) =>
        apiFetch<Farm>(`/farms/${farmId}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (farmId: string) =>
        apiFetch(`/farms/${farmId}`, { method: "DELETE" }),
    fields: (farmId: string, limit = 200, offset = 0) =>
        apiFetch<Paginated<Field>>(`/farms/${farmId}/fields?limit=${limit}&offset=${offset}`),
};

// ── Fields ───────────────────────────────────────────────────────────

export const fieldsApi = {
    get: (fieldId: string) => apiFetch<Field>(`/fields/${fieldId}`),
    create: (data: { farm_id: string; name: string; geom: any; crop_type?: string; season?: string; tags?: string[] }) =>
        apiFetch<Field>("/fields", { method: "POST", body: JSON.stringify(data) }),
    update: (fieldId: string, data: { name?: string; geom?: any; crop_type?: string; season?: string; tags?: string[] }) =>
        apiFetch<Field>(`/fields/${fieldId}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (fieldId: string) =>
        apiFetch(`/fields/${fieldId}`, { method: "DELETE" }),
    import: (farmId: string, file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        return apiFetch<FieldImportResult>(`/fields/import?farm_id=${farmId}`, { method: "POST", body: formData });
    },
    backfillIndices: (fieldId: string, months = 24) =>
        apiFetch<{ field_id: string; status: string; message: string }>(
            `/fields/${fieldId}/backfill-indices`,
            { method: "POST", body: JSON.stringify({ months }) },
        ),
    backfillStatus: (fieldId: string) =>
        apiFetch<{ field_id: string; has_active_backfill: boolean; pending_jobs: number; running_jobs: number; completed_jobs: number }>(
            `/fields/${fieldId}/backfill-status`,
        ),
};

// ── Monitoring ───────────────────────────────────────────────────────

export const monitoringApi = {
    layers: (fieldId: string, type: IndexType = "NDVI", limit = 50) =>
        apiFetch<Paginated<RasterLayer>>(`/fields/${fieldId}/layers?type=${type}&limit=${limit}`),
    stats: (fieldId: string, type: IndexType = "NDVI", limit = 200) =>
        apiFetch<Paginated<FieldStat>>(`/fields/${fieldId}/stats?type=${type}&limit=${limit}`),
    layerTypes: (fieldId: string) =>
        apiFetch<string[]>(`/fields/${fieldId}/layers/types`),
};

// ── Jobs ─────────────────────────────────────────────────────────────

export const jobsApi = {
    createNdvi: (fieldId: string, dateFrom: string, dateTo: string) =>
        apiFetch<NdviJob>(`/fields/${fieldId}/jobs/ndvi`, {
            method: "POST",
            body: JSON.stringify({ date_from: dateFrom, date_to: dateTo }),
        }),
    createIndex: (fieldId: string, indexType: IndexType, dateFrom: string, dateTo: string, params?: { savi_l?: number }) =>
        apiFetch<NdviJob>(`/fields/${fieldId}/jobs/index`, {
            method: "POST",
            body: JSON.stringify({ index_type: indexType.toLowerCase(), date_from: dateFrom, date_to: dateTo, ...params }),
        }),
    get: (jobId: string) => apiFetch<NdviJob>(`/jobs/${jobId}`),
};

// ── Alerts ───────────────────────────────────────────────────────────

export const alertsApi = {
    list: (opts: { status?: string; limit?: number; offset?: number } = {}) => {
        const params = new URLSearchParams();
        if (opts.status) params.set("status", opts.status);
        params.set("limit", String(opts.limit ?? 50));
        params.set("offset", String(opts.offset ?? 0));
        return apiFetch<Paginated<Alert>>(`/alerts?${params}`);
    },
    listForField: (fieldId: string, limit = 50, indexType?: string) => {
        const params = new URLSearchParams({ field_id: fieldId, limit: String(limit) });
        if (indexType) params.set("index_type", indexType);
        return apiFetch<Paginated<Alert>>(`/alerts?${params}`);
    },
    listForFarm: (farmId: string, limit = 50) =>
        apiFetch<Paginated<Alert>>(`/alerts?farm_id=${farmId}&limit=${limit}`),
    update: (alertId: string, data: { status: string }) =>
        apiFetch<Alert>(`/alerts/${alertId}`, { method: "PATCH", body: JSON.stringify(data) }),
};

// ── Scouting ─────────────────────────────────────────────────────

export const scoutingApi = {
    list: (fieldId: string, limit = 50, offset = 0) =>
        apiFetch<Paginated<ScoutingObservation>>(
            `/fields/${fieldId}/scouting?limit=${limit}&offset=${offset}`,
        ),
    create: (fieldId: string, data: ScoutingCreate) =>
        apiFetch<ScoutingObservation>(`/fields/${fieldId}/scouting`, {
            method: "POST",
            body: JSON.stringify(data),
        }),
    update: (fieldId: string, obsId: string, data: ScoutingUpdate) =>
        apiFetch<ScoutingObservation>(`/fields/${fieldId}/scouting/${obsId}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        }),
    delete: (fieldId: string, obsId: string) =>
        apiFetch(`/fields/${fieldId}/scouting/${obsId}`, { method: "DELETE" }),
};

// ── Detection ────────────────────────────────────────────────────

export const detectionApi = {
    trigger: (orgId: string, bbox: number[], farmId: string, windowA?: string, windowB?: string) =>
        apiFetch<DetectionJob>(`/orgs/${orgId}/detect-boundaries`, {
            method: "POST",
            body: JSON.stringify({
                bbox,
                farm_id: farmId,
                ...(windowA && { window_a: windowA }),
                ...(windowB && { window_b: windowB }),
            }),
        }),
    list: (orgId: string, params?: { job_id?: string; status?: string; limit?: number; offset?: number }) => {
        const q = new URLSearchParams();
        if (params?.job_id) q.set("job_id", params.job_id);
        if (params?.status) q.set("status", params.status);
        if (params?.limit) q.set("limit", String(params.limit));
        if (params?.offset) q.set("offset", String(params.offset));
        const qs = q.toString();
        return apiFetch<Paginated<DetectedBoundary>>(
            `/orgs/${orgId}/detected-boundaries${qs ? `?${qs}` : ""}`,
        );
    },
    accept: (orgId: string, boundaryId: string, name: string, farmId: string, geom?: GeoJSON.Geometry) =>
        apiFetch<{ field_id: string; area_ha: number }>(
            `/orgs/${orgId}/detected-boundaries/${boundaryId}/accept`,
            {
                method: "POST",
                body: JSON.stringify({
                    name,
                    farm_id: farmId,
                    ...(geom && { geom }),
                }),
            },
        ),
    discard: (orgId: string, boundaryId: string) =>
        apiFetch(`/orgs/${orgId}/detected-boundaries/${boundaryId}/discard`, {
            method: "POST",
        }),
};

// ── Weather ──────────────────────────────────────────────────────

export const weatherApi = {
    get: (fieldId: string, startDate: string, endDate: string, includeForecast = true) =>
        apiFetch<WeatherResponse>(
            `/fields/${fieldId}/weather?start_date=${startDate}&end_date=${endDate}&include_forecast=${includeForecast}`,
        ),
    summary: (fieldId: string, days = 30) =>
        apiFetch<WeatherSummary>(`/fields/${fieldId}/weather/summary?days=${days}`),
    backfill: (fieldId: string, days = 90) =>
        apiFetch<{ field_id: string; status: string; message: string }>(
            `/fields/${fieldId}/weather/backfill`,
            { method: "POST", body: JSON.stringify({ days }) },
        ),
};

// ── Share Types ──────────────────────────────────────────────────

export interface ShareLink {
    id: string;
    field_id: string;
    token: string;
    scope: string;
    expires_at: string | null;
    created_at: string;
}

export interface ShareReport {
    field: {
        id: string;
        name: string;
        area_ha: number | null;
        crop_type: string | null;
        geom: GeoJSON.Geometry | null;
    };
    latest_layer: RasterLayer | null;
    layers_by_type: Record<string, RasterLayer>;
    available_index_types: string[];
    stats: FieldStat[];
    stats_by_type: Record<string, FieldStat[]>;
    alerts: Alert[];
    scouting: ScoutingObservation[];
    weather_summary: Record<string, any> | null;
    weather_data: WeatherDaily[];
    soil_summary: Record<string, any> | null;
}

// ── Uploads ──────────────────────────────────────────────────────

const MINIO_URL = process.env.NEXT_PUBLIC_MINIO_URL || "http://localhost:9000/openfarm";

export const uploadsApi = {
    presign: (filename: string, contentType = "image/jpeg") =>
        apiFetch<PresignedUpload>("/uploads/presign", {
            method: "POST",
            body: JSON.stringify({ filename, content_type: contentType }),
        }),
    /** Upload file to MinIO via presigned URL, returns the object key. */
    async upload(file: File): Promise<string> {
        const ext = file.name.split(".").pop() || "jpg";
        const ct = file.type || "image/jpeg";
        const { upload_url, object_key } = await this.presign(file.name, ct);
        // PUT directly to MinIO (presigned URL)
        // Do NOT send Content-Type header — it's not part of the signed
        // headers so MinIO would reject the request with 403.
        const res = await fetch(upload_url, {
            method: "PUT",
            body: file,
        });
        if (!res.ok) throw new Error("Upload failed");
        return object_key;
    },
};

/** Construct a public URL for a photo stored in MinIO. */
export function getPhotoUrl(objectKey: string): string {
    return `${MINIO_URL}/${objectKey}`;
}

// ── Soil Types ───────────────────────────────────────────────────

export interface SoilLayer {
    depth_top_cm: number;
    depth_bottom_cm: number;
    sand_pct: number | null;
    silt_pct: number | null;
    clay_pct: number | null;
    ph: number | null;
    soc_g_kg: number | null;
    bd_kg_dm3: number | null;
    cec_cmol_kg: number | null;
    nitrogen_g_kg: number | null;
    cfvo_pct: number | null;
    fc_vol_pct: number | null;
    wp_vol_pct: number | null;
    awc_mm: number | null;
    ksat_cm_day: number | null;
    texture_class: string | null;
    sand_q05: number | null;
    sand_q95: number | null;
    clay_q05: number | null;
    clay_q95: number | null;
    ph_q05: number | null;
    ph_q95: number | null;
    soc_q05: number | null;
    soc_q95: number | null;
    ksat_q05: number | null;
    ksat_q95: number | null;
}

export interface SoilProfile {
    id: string;
    field_id: string;
    source: string;
    source_resolution_m: number | null;
    fetched_at: string;
    layers: SoilLayer[];
}

export interface SoilFieldSummary {
    id: string;
    field_id: string;
    dominant_texture: string | null;
    avg_ph: number | null;
    total_soc_stock_t_ha: number | null;
    rootzone_awc_mm: number | null;
    drainage_class: string | null;
    acidification_risk: number | null;
    compaction_risk: number | null;
    leaching_risk: number | null;
    rooting_constraint: number | null;
    waterlogging_risk: number | null;
    topsoil_soc_stock_t_ha: number | null;
    data_quality_score: number | null;
    computed_at: string;
}

export interface SoilRefreshResponse {
    field_id: string;
    job_id: string;
    status: string;
    message: string;
}

// Intelligence response types

export interface SamplingZoneFeature {
    type: "Feature";
    geometry: GeoJSON.Geometry;
    properties: Record<string, any>;
}

export interface SamplingZonesResponse {
    type: "FeatureCollection";
    features: SamplingZoneFeature[];
}

export interface CropSuitabilityItem {
    crop: string;
    name: string;
    score: number;
    rating: string;
    limiting_factors: string[];
}

export interface CropSuitabilityResponse {
    crops: CropSuitabilityItem[];
    field_crop_type: string | null;
    field_crop_suitability: CropSuitabilityItem | null;
    weather_available: boolean;
    message: string | null;
}

export interface NutrientContextResponse {
    zone_class: string;
    confidence: number;
    factors: string[];
    interpretation: string;
    disclaimer: string;
}

export interface CarbonEstimateResponse {
    current_soc_t_ha: number | null;
    topsoil_soc_t_ha: number | null;
    saturation_t_ha: number | null;
    saturation_pct: number | null;
    seq_potential_low_t_ha_yr: number | null;
    seq_potential_high_t_ha_yr: number | null;
    climate_zone: string | null;
    disclaimer: string;
}

export interface SoilWeatherStressResponse {
    status: string;
    severity: number;
    moisture_status: string;
    awc_rootzone_mm: number | null;
    water_balance_30d_mm: number | null;
    factors: string[];
}

export const soilApi = {
    get: (fieldId: string) =>
        apiFetch<SoilProfile>(`/fields/${fieldId}/soil`),
    getSummary: (fieldId: string) =>
        apiFetch<SoilFieldSummary>(`/fields/${fieldId}/soil/summary`),
    refresh: (fieldId: string) =>
        apiFetch<SoilRefreshResponse>(`/fields/${fieldId}/soil/refresh`, {
            method: "POST",
        }),
    getSamplingZones: (fieldId: string) =>
        apiFetch<SamplingZonesResponse>(`/fields/${fieldId}/soil/sampling-zones`),
    getCropSuitability: (fieldId: string) =>
        apiFetch<CropSuitabilityResponse>(`/fields/${fieldId}/soil/crop-suitability`),
    getNutrientContext: (fieldId: string) =>
        apiFetch<NutrientContextResponse>(`/fields/${fieldId}/soil/nutrient-context`),
    getCarbon: (fieldId: string) =>
        apiFetch<CarbonEstimateResponse>(`/fields/${fieldId}/soil/carbon`),
    getWeatherStress: (fieldId: string) =>
        apiFetch<SoilWeatherStressResponse>(`/fields/${fieldId}/soil/weather-stress`),
};

// ── Share Links ──────────────────────────────────────────────────

export const shareApi = {
    list: (fieldId: string) =>
        apiFetch<ShareLink[]>(`/fields/${fieldId}/share`),
    create: (fieldId: string, expiresInDays: number | null) =>
        apiFetch<ShareLink>(`/fields/${fieldId}/share`, {
            method: "POST",
            body: JSON.stringify({ expires_in_days: expiresInDays }),
        }),
    revoke: (fieldId: string, token: string) =>
        apiFetch(`/fields/${fieldId}/share/${token}`, { method: "DELETE" }),
    /** Public endpoint — no auth required. Uses plain fetch. */
    async getReport(token: string): Promise<ShareReport> {
        const res = await fetch(`${API_BASE}/share/${token}`);
        if (res.status === 410) throw new Error("expired");
        if (res.status === 404) throw new Error("not_found");
        if (!res.ok) throw new Error(`Report fetch failed: ${res.status}`);
        return res.json();
    },
};

export default apiFetch;
