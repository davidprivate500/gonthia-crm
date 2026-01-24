import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/drizzle/schema';

/**
 * Transform Supabase direct connection URL to pooler URL.
 * The Vercel Supabase integration injects the direct connection URL,
 * but serverless functions need the transaction pooler.
 *
 * Direct URL format:  postgresql://postgres:PWD@db.PROJECT_ID.supabase.co:5432/postgres
 * Pooler URL format:  postgresql://postgres.PROJECT_ID:PWD@aws-1-eu-central-1.pooler.supabase.com:6543/postgres
 *
 * Key differences:
 * 1. Username changes from "postgres" to "postgres.PROJECT_ID"
 * 2. Host changes from "db.PROJECT_ID.supabase.co" to "aws-1-eu-central-1.pooler.supabase.com"
 * 3. Port changes from 5432 to 6543
 */
function transformToPoolerUrl(url: string): string {
  // Match Supabase direct connection URL pattern
  // postgresql://postgres:PASSWORD@db.PROJECT_ID.supabase.co:5432/postgres
  const directPattern = /^(postgresql:\/\/)postgres:([^@]+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?(.*)$/;
  const match = url.match(directPattern);

  if (match) {
    const [, protocol, password, projectId, pathAndParams] = match;
    // Transform to pooler URL format
    const poolerUrl = `${protocol}postgres.${projectId}:${password}@aws-1-eu-central-1.pooler.supabase.com:6543${pathAndParams || '/postgres'}`;
    console.log('[DB] Transformed direct URL to pooler URL for project:', projectId);
    return poolerUrl;
  }

  return url;
}

// Use DATABASE_URL_POOLER if available, otherwise transform DATABASE_URL to pooler
let databaseUrl = process.env.DATABASE_URL_POOLER || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL or DATABASE_URL_POOLER environment variable is not set');
}

// In production, ensure we're using the pooler URL for serverless compatibility
if (process.env.NODE_ENV === 'production') {
  databaseUrl = transformToPoolerUrl(databaseUrl);
}

// Configure postgres client with SSL for Supabase/Vercel compatibility
const client = postgres(databaseUrl, {
  prepare: false,
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
  connection: {
    application_name: 'gonthia-crm',
  },
});
export const db = drizzle(client, { schema });

// BUG-001 FIX: Expose sql client for transactions
export const sql = client;

// Re-export schema for convenience
export * from '@/drizzle/schema';
