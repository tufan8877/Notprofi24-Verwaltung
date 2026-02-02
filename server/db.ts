import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const { Pool } = pg;

export const hasDatabaseUrl = !!process.env.DATABASE_URL;

if (!hasDatabaseUrl) {
  console.error("DATABASE_URL is missing. Set it in Render Environment.");
}

// Use SSL for Supabase/Render (fixes self-signed chain issues in many environments)
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: hasDatabaseUrl ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
