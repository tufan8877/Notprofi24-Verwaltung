import pg from "pg";

const { Pool } = pg;

export const hasDatabaseUrl = typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;

export const pool: pg.Pool | null = hasDatabaseUrl
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      // Supabase/Render: SSL pragmatisch
      ssl: { rejectUnauthorized: false },
    })
  : null;
