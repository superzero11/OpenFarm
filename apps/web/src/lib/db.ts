import { Pool } from "pg";
import { logger as rootLogger } from "@/lib/logger";

const logger = rootLogger.child({ component: "db" });

/**
 * Direct Postgres connection - used ONLY for user upsert in NextAuth callback.
 * Per PRD rule: "Next.js does not talk to Postgres except user upsert on auth bootstrap."
 */

let pool: Pool | null = null;

function getPool(): Pool {
    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 10,
        });
    }
    return pool;
}

export interface UpsertedUser {
    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
}

/**
 * Upsert user on first login. Creates user + default org + owner membership.
 * Returns the user record with its UUID.
 */
export async function upsertUser(
    email: string,
    name: string,
    image?: string | null
): Promise<UpsertedUser> {
    const db = getPool();

    // Upsert user
    const userResult = await db.query<UpsertedUser>(
        `INSERT INTO users (email, name, avatar_url)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
       updated_at = NOW()
     RETURNING id, email, name, avatar_url`,
        [email, name, image || null]
    );

    const user = userResult.rows[0];
    logger.info({ userId: user.id, email }, "user_upserted");

    // Check if user has any org membership
    const membershipResult = await db.query(
        `SELECT 1 FROM org_members WHERE user_id = $1 LIMIT 1`,
        [user.id]
    );

    if (membershipResult.rowCount === 0) {
        // Auto-create default org
        const orgName = `${name}'s Workspace`;
        const orgResult = await db.query<{ id: string }>(
            `INSERT INTO orgs (name, created_by) VALUES ($1, $2) RETURNING id`,
            [orgName, user.id]
        );
        const orgId = orgResult.rows[0].id;

        // Add owner membership
        await db.query(
            `INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'owner')`,
            [orgId, user.id]
        );

        // Audit event
        await db.query(
            `INSERT INTO audit_events (org_id, user_id, event_type, metadata_json)
       VALUES ($1, $2, 'org_created', $3)`,
            [orgId, user.id, JSON.stringify({ name: orgName, auto_created: true })]
        );
        logger.info({ userId: user.id, orgId, orgName }, "default_org_created");
    }

    // Accept any pending invites for this email
    const pendingInvites = await db.query<{ id: string; org_id: string; role: string }>(
        `SELECT id, org_id, role FROM invites WHERE email = $1 AND status = 'pending'`,
        [email]
    );

    for (const invite of pendingInvites.rows) {
        // Check not already a member
        const existing = await db.query(
            `SELECT 1 FROM org_members WHERE org_id = $1 AND user_id = $2`,
            [invite.org_id, user.id]
        );
        if (existing.rowCount === 0) {
            await db.query(
                `INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, $3)`,
                [invite.org_id, user.id, invite.role]
            );
        }
        await db.query(
            `UPDATE invites SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
            [invite.id]
        );
    }

    // Audit login
    const firstOrg = await db.query<{ org_id: string }>(
        `SELECT org_id FROM org_members WHERE user_id = $1 LIMIT 1`,
        [user.id]
    );
    if (firstOrg.rows.length > 0) {
        await db.query(
            `INSERT INTO audit_events (org_id, user_id, event_type) VALUES ($1, $2, 'login')`,
            [firstOrg.rows[0].org_id, user.id]
        );
    }

    return user;
}
