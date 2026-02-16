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
    created_at: string;
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
    members: (orgId: string) => apiFetch<Member[]>(`/orgs/${orgId}/members`, { orgId }),
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
};

// ── Monitoring ───────────────────────────────────────────────────────

export const monitoringApi = {
    layers: (fieldId: string, type = "NDVI", limit = 50) =>
        apiFetch<RasterLayer[]>(`/fields/${fieldId}/layers?type=${type}&limit=${limit}`),
    stats: (fieldId: string, type = "NDVI", limit = 200) =>
        apiFetch<FieldStat[]>(`/fields/${fieldId}/stats?type=${type}&limit=${limit}`),
};

// ── Jobs ─────────────────────────────────────────────────────────────

export const jobsApi = {
    createNdvi: (fieldId: string, dateFrom: string, dateTo: string) =>
        apiFetch<NdviJob>(`/fields/${fieldId}/jobs/ndvi`, {
            method: "POST",
            body: JSON.stringify({ date_from: dateFrom, date_to: dateTo }),
        }),
    get: (jobId: string) => apiFetch<NdviJob>(`/jobs/${jobId}`),
};

// ── Alerts ───────────────────────────────────────────────────────────

export const alertsApi = {
    listForField: (fieldId: string, limit = 50) =>
        apiFetch<Paginated<Alert>>(`/alerts?field_id=${fieldId}&limit=${limit}`),
    listForFarm: (farmId: string, limit = 50) =>
        apiFetch<Paginated<Alert>>(`/alerts?farm_id=${farmId}&limit=${limit}`),
    update: (alertId: string, data: { status: string }) =>
        apiFetch<Alert>(`/alerts/${alertId}`, { method: "PATCH", body: JSON.stringify(data) }),
};

export default apiFetch;
