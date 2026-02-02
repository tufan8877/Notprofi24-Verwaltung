import pg from "pg";

const { Pool } = pg;

export const hasDatabaseUrl = !!process.env.DATABASE_URL;

// Pool wird nur erstellt, wenn DATABASE_URL vorhanden ist
export const pool: pg.Pool | null = hasDatabaseUrl
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      // Supabase/Render: SSL pragmatisch
      ssl: { rejectUnauthorized: false },
    })
  : null;
