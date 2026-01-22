/**
 * Master Admin Creation Script
 *
 * Creates a platform-level master admin user who can access all tenants and manage invoices.
 *
 * Usage:
 *   npx tsx scripts/create-master-admin.ts --email admin@example.com --password secretpass
 *   # or
 *   npm run create:master-admin -- --email admin@example.com --password secretpass
 *
 * Options:
 *   --email       Required. Email address for the master admin
 *   --password    Required. Password for the master admin (min 8 characters)
 *   --firstName   Optional. First name
 *   --lastName    Optional. Last name
 *
 * Environment:
 *   DATABASE_URL - Required PostgreSQL connection string
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import * as schema from '../drizzle/schema';

// Load environment variables from .env.local
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
    // .env.local not found, rely on existing env vars
  }
}
loadEnv();

// Parse command line arguments
function parseArgs(): { email: string; password: string; firstName?: string; lastName?: string } {
  const args = process.argv.slice(2);
  const result: Record<string, string> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const value = args[i + 1];
    if (key && value) {
      result[key] = value;
    }
  }

  if (!result.email) {
    console.error('Error: --email is required');
    console.error('Usage: npx tsx scripts/create-master-admin.ts --email admin@example.com --password secretpass');
    process.exit(1);
  }

  if (!result.password) {
    console.error('Error: --password is required');
    console.error('Usage: npx tsx scripts/create-master-admin.ts --email admin@example.com --password secretpass');
    process.exit(1);
  }

  if (result.password.length < 8) {
    console.error('Error: Password must be at least 8 characters');
    process.exit(1);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(result.email)) {
    console.error('Error: Invalid email format');
    process.exit(1);
  }

  return {
    email: result.email,
    password: result.password,
    firstName: result.firstName,
    lastName: result.lastName,
  };
}

async function main() {
  console.log('=== Master Admin Creation Script ===\n');

  const { email, password, firstName, lastName } = parseArgs();

  // Connect to database
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const client = postgres(databaseUrl, { prepare: false });
  const db = drizzle(client, { schema });

  try {
    // Check if email already exists
    console.log(`Checking if email ${email} is already registered...`);
    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.email, email.toLowerCase()),
    });

    if (existingUser) {
      if (existingUser.isMasterAdmin) {
        console.log('\nMaster admin with this email already exists.');
        console.log(`User ID: ${existingUser.id}`);
        console.log(`Email: ${existingUser.email}`);
        process.exit(0);
      } else {
        console.error('\nError: A regular user with this email already exists.');
        console.error('Please use a different email or convert the existing user.');
        process.exit(1);
      }
    }

    // Hash password
    console.log('Hashing password...');
    const passwordHash = await bcrypt.hash(password, 12);

    // Create master admin user
    console.log('Creating master admin user...');
    const [newUser] = await db.insert(schema.users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        firstName: firstName || null,
        lastName: lastName || null,
        role: 'owner', // Master admins get owner role (highest)
        tenantId: null, // Master admins have no tenant
        isMasterAdmin: true,
      })
      .returning();

    console.log('\n=== Master Admin Created Successfully ===');
    console.log(`User ID: ${newUser.id}`);
    console.log(`Email: ${newUser.email}`);
    console.log(`Name: ${[firstName, lastName].filter(Boolean).join(' ') || '(not set)'}`);
    console.log(`Role: Master Admin`);
    console.log('\nYou can now log in at /login and access /master/tenants');

  } catch (error) {
    console.error('\nError creating master admin:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
