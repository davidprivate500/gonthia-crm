/**
 * Cleanup script to remove the demo tenant and all associated data
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import postgres from 'postgres';

// Load environment variables
function loadEnv() {
  const envPath = resolve(__dirname, '../.env.local');
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env.local not found
  }
}

loadEnv();

async function cleanup() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  try {
    // Find the tenant
    const tenants = await sql`SELECT id FROM tenants WHERE name = 'Meridian Trading Group'`;
    if (tenants.length === 0) {
      console.log('No tenant found to delete');
      await sql.end();
      return;
    }

    const tenantId = tenants[0].id;
    console.log('Deleting tenant:', tenantId);

    // Delete in order due to FKs
    await sql`DELETE FROM audit_logs WHERE tenant_id = ${tenantId}`;
    console.log('Deleted audit_logs');

    await sql`DELETE FROM activities WHERE tenant_id = ${tenantId}`;
    console.log('Deleted activities');

    await sql`DELETE FROM contact_tags WHERE contact_id IN (SELECT id FROM contacts WHERE tenant_id = ${tenantId})`;
    console.log('Deleted contact_tags');

    await sql`DELETE FROM deals WHERE tenant_id = ${tenantId}`;
    console.log('Deleted deals');

    await sql`DELETE FROM contacts WHERE tenant_id = ${tenantId}`;
    console.log('Deleted contacts');

    await sql`DELETE FROM companies WHERE tenant_id = ${tenantId}`;
    console.log('Deleted companies');

    await sql`DELETE FROM pipeline_stages WHERE tenant_id = ${tenantId}`;
    console.log('Deleted pipeline_stages');

    await sql`DELETE FROM tags WHERE tenant_id = ${tenantId}`;
    console.log('Deleted tags');

    await sql`DELETE FROM api_keys WHERE tenant_id = ${tenantId}`;
    console.log('Deleted api_keys');

    await sql`DELETE FROM import_jobs WHERE tenant_id = ${tenantId}`;
    console.log('Deleted import_jobs');

    await sql`DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ${tenantId})`;
    console.log('Deleted password_reset_tokens');

    await sql`DELETE FROM users WHERE tenant_id = ${tenantId}`;
    console.log('Deleted users');

    await sql`DELETE FROM tenants WHERE id = ${tenantId}`;
    console.log('Deleted tenant');

    console.log('\nCleanup complete!');
    await sql.end();
  } catch (error) {
    console.error('Cleanup failed:', error);
    await sql.end();
    process.exit(1);
  }
}

cleanup();
