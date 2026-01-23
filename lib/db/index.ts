import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/drizzle/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Configure postgres client with SSL for Supabase/Vercel compatibility
const client = postgres(process.env.DATABASE_URL, {
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
