import '../config/env.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pool: pg.Pool | null = null;
let migrationApplied = false;
let pgHealthy = false;
let pgLastError: string | null = null;

export function isPostgresConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

export function getPostgresPool(): pg.Pool | null {
  if (!isPostgresConfigured()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    pool.on('error', (err) => {
      console.error('[AdmitPilot Postgres] Unexpected pool client error:', err.message);
      pgLastError = err.message;
    });
  }
  return pool;
}

export async function ensurePostgresMigrations(): Promise<boolean> {
  const activePool = getPostgresPool();
  if (!activePool) return false;
  if (migrationApplied && pgHealthy) return true;

  try {
    const migrationsDir = path.resolve(__dirname, '../../../../supabase/migrations');
    const migration002Path = path.join(migrationsDir, '002_agency_credentials_and_tracking.sql');
    const sql = await fs.readFile(migration002Path, 'utf-8');
    await activePool.query(sql);
    migrationApplied = true;
    pgHealthy = true;
    pgLastError = null;
    console.log('[AdmitPilot Postgres] Connected to Supabase PostgreSQL & verified schema 002.');
    return true;
  } catch (err: any) {
    pgHealthy = false;
    pgLastError = err.message;
    console.error('[AdmitPilot Postgres] Migration / connection check failed:', err.message);
    return false;
  }
}

export function getPostgresStatus(): {
  configured: boolean;
  connected: boolean;
  host?: string;
  error?: string | null;
} {
  return {
    configured: isPostgresConfigured(),
    connected: pgHealthy,
    host: process.env.PGHOST || undefined,
    error: pgLastError,
  };
}
