import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/drizzle/schema';

/**
 * Transform Supabase direct connection URL to pooler URL.
 * The Vercel Supabase integration injects the direct connection URL,
 * but serverless functions need the transaction pooler.
 *
 * Direct URL pattern: postgresql://postgres.xxx:PWD@db.xxx.supabase.co:5432/postgres
 * Pooler URL pattern: postgresql://postgres.xxx:PWD@aws-1-eu-central-1.pooler.supabase.com:6543/postgres
 */
function transformToPoolerUrl(url: string): string {
  // Check if this is a Supabase direct connection URL
  const directPattern = /db\.([a-z0-9]+)\.supabase\.co:?(\d+)?/;
  const match = url.match(directPattern);

  if (match) {
    // Replace direct connection host with pooler host
    // Region is eu-central-1 based on the project setup
    const poolerUrl = url.replace(
      directPattern,
      'aws-1-eu-central-1.pooler.supabase.com:6543'
    );
    console.log('[DB] Transformed direct URL to pooler URL');
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
