import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// NOTE (Render/Supabase): In many hosting environments the database uses TLS and
// certificate chains that Node's default verifier may reject.
// We enable SSL in production and relax verification to avoid
// `SELF_SIGNED_CERT_IN_CHAIN` when using Supabase pooler.
//
// If DATABASE_URL is missing, we don't crash the whole server; routes that need
// DB will fail and /api/health can report db:false.
if (!process.env.DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.error("DATABASE_URL is missing. Set it in Render Environment.");
}

const url = process.env.DATABASE_URL || "";
const isLocal = url.includes("localhost") || url.includes("127.0.0.1");

export const pool = new Pool({
  connectionString: url,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });
