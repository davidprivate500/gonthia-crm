/**
 * Demo Client Seed Script
 *
 * Creates a realistic demo client with organic-looking data for the CRM.
 *
 * Usage:
 *   npx tsx scripts/seed-client.ts
 *   # or
 *   npm run seed:demo-client
 *
 * Environment:
 *   DATABASE_URL - Required PostgreSQL connection string
 *   DEMO_SEED - Optional seed for deterministic randomness (default: 1337)
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

// ============================================================================
// Configuration
// ============================================================================

const DEMO_SEED = parseInt(process.env.DEMO_SEED || '1337', 10);
const TENANT_SLUG = 'meridian-trading-group';
const ADMIN_EMAIL = 'carlos.mendez@meridiantrading.io';
const ADMIN_PASSWORD = 'Meridian2024!';

// Growth curve: Monthly new contacts (Jan 2024 - current)
const MONTHLY_GROWTH = [
  { month: '2024-01', target: 52 },
  { month: '2024-02', target: 95 },
  { month: '2024-03', target: 185 },
  { month: '2024-04', target: 285 },
  { month: '2024-05', target: 385 },
  { month: '2024-06', target: 485 },
  { month: '2024-07', target: 580 },
  { month: '2024-08', target: 610 },
  { month: '2024-09', target: 595 },
  { month: '2024-10', target: 620 },
  { month: '2024-11', target: 605 },
  { month: '2024-12', target: 640 },
  { month: '2025-01', target: 615 },
];

// ============================================================================
// Seeded Random Number Generator (Mulberry32)
// ============================================================================

class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  float(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  pickWeighted<T>(items: T[], weights: number[]): T {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = this.next() * totalWeight;
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // Log-normal distribution for realistic monetary values
  lognormal(mean: number, stddev: number): number {
    const u1 = this.next();
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.exp(Math.log(mean) + stddev * z);
  }

  // Pareto distribution for whale customers
  pareto(alpha: number, xm: number): number {
    return xm / Math.pow(this.next(), 1 / alpha);
  }

  uuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (this.int(0, 15));
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// ============================================================================
// Data Pools - Realistic Names and Values
// ============================================================================

const FIRST_NAMES = [
  'Alexander', 'Benjamin', 'Charlotte', 'Daniel', 'Elena', 'Felix', 'Gabriela',
  'Hugo', 'Isabella', 'Julian', 'Katherine', 'Leonardo', 'Mia', 'Nicolas',
  'Olivia', 'Patrick', 'Quinn', 'Rafael', 'Sofia', 'Thomas', 'Victoria',
  'William', 'Xavier', 'Yolanda', 'Zachary', 'Adriana', 'Bruno', 'Camila',
  'David', 'Emma', 'Francisco', 'Grace', 'Henry', 'Ivy', 'Jacob', 'Karen',
  'Lucas', 'Maria', 'Nathan', 'Oscar', 'Paula', 'Ricardo', 'Sarah', 'Tyler',
  'Valentina', 'Wesley', 'Ximena', 'Yusuf', 'Zoe', 'Andrea', 'Carlos',
  'Diana', 'Eduardo', 'Fernanda', 'Gabriel', 'Helena', 'Ivan', 'Jessica',
  'Kevin', 'Laura', 'Marco', 'Natalia', 'Omar', 'Patricia', 'Roberto',
  'Sandra', 'Victor', 'Ana', 'Miguel', 'Carmen', 'Luis', 'Rosa', 'Jorge',
  'Teresa', 'Manuel', 'Pilar', 'Alberto', 'Lucia', 'Ramon', 'Beatriz',
  'Sergio', 'Monica', 'Antonio', 'Cristina', 'Fernando', 'Alicia', 'Javier',
  'Claudia', 'Diego', 'Veronica', 'Pablo', 'Silvia', 'Enrique', 'Gloria'
];

const LAST_NAMES = [
  'Anderson', 'Bergstrom', 'Chen', 'Delgado', 'Edwards', 'Fischer', 'Garcia',
  'Hansen', 'Ivanov', 'Jensen', 'Kim', 'Larsen', 'Martinez', 'Nielsen',
  'Olsen', 'Petrov', 'Quinn', 'Rodriguez', 'Schmidt', 'Tanaka', 'Ueda',
  'Volkova', 'Wagner', 'Xu', 'Yamamoto', 'Zhang', 'Alonso', 'Becker',
  'Costa', 'Dubois', 'Eriksson', 'Fernandez', 'Gonzalez', 'Hoffmann',
  'Ishikawa', 'Johannsen', 'Kowalski', 'Lopez', 'Muller', 'Nakamura',
  'Ortiz', 'Patel', 'Ramirez', 'Silva', 'Torres', 'Vargas', 'Weber',
  'Yamada', 'Zimmermann', 'Alvarez', 'Blanco', 'Cabrera', 'Diaz', 'Espinoza',
  'Flores', 'Gutierrez', 'Hernandez', 'Jimenez', 'Lara', 'Medina', 'Navarro',
  'Perez', 'Reyes', 'Sanchez', 'Vega', 'Castillo', 'Moreno', 'Romero',
  'Ruiz', 'Soto', 'Mendoza', 'Cruz', 'Aguilar', 'Ramos', 'Herrera'
];

const EMAIL_DOMAINS = [
  'gmail.com', 'outlook.com', 'yahoo.com', 'protonmail.com', 'icloud.com',
  'hotmail.com', 'mail.com', 'zoho.com', 'fastmail.com', 'tutanota.com'
];

const COMPANY_PREFIXES = [
  'Global', 'Prime', 'Elite', 'Apex', 'Summit', 'Crown', 'Atlas', 'Nova',
  'Vanguard', 'Pioneer', 'Horizon', 'Pinnacle', 'Sterling', 'Pacific',
  'Continental', 'Metropolitan', 'National', 'United', 'Premier', 'Dynamic'
];

const COMPANY_CORES = [
  'Capital', 'Trading', 'Ventures', 'Holdings', 'Partners', 'Investments',
  'Financial', 'Wealth', 'Asset', 'Equity', 'Securities', 'Markets',
  'Advisory', 'Consulting', 'Solutions', 'Management', 'Services', 'Group'
];

const COMPANY_SUFFIXES = ['Inc', 'LLC', 'Corp', 'Ltd', 'SA', 'GmbH', ''];

const INDUSTRIES = [
  'Financial Services', 'Investment Banking', 'Wealth Management',
  'Fintech', 'Trading', 'Asset Management', 'Private Equity',
  'Venture Capital', 'Insurance', 'Real Estate Investment'
];

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

const COUNTRIES = [
  { name: 'United States', code: 'US', cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami'] },
  { name: 'United Kingdom', code: 'GB', cities: ['London', 'Manchester', 'Birmingham', 'Edinburgh', 'Bristol'] },
  { name: 'Germany', code: 'DE', cities: ['Berlin', 'Munich', 'Frankfurt', 'Hamburg', 'Cologne'] },
  { name: 'Spain', code: 'ES', cities: ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Bilbao'] },
  { name: 'France', code: 'FR', cities: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice'] },
  { name: 'Netherlands', code: 'NL', cities: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven'] },
  { name: 'Switzerland', code: 'CH', cities: ['Zurich', 'Geneva', 'Basel', 'Bern', 'Lausanne'] },
  { name: 'Singapore', code: 'SG', cities: ['Singapore'] },
  { name: 'Australia', code: 'AU', cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide'] },
  { name: 'Canada', code: 'CA', cities: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa'] },
];

const ACTIVITY_SUBJECTS = {
  call: [
    'Initial discovery call', 'Follow-up call', 'Quarterly review call',
    'Product demo call', 'Pricing discussion', 'Technical consultation',
    'Account review', 'Upsell opportunity call', 'Retention call',
    'Onboarding call', 'Support call', 'Strategy session'
  ],
  email: [
    'Welcome email sent', 'Proposal sent', 'Contract sent for review',
    'Follow-up on proposal', 'Meeting confirmation', 'Document request',
    'Invoice sent', 'Thank you note', 'Introduction email',
    'Product update notification', 'Newsletter sent', 'Re-engagement email'
  ],
  meeting: [
    'Initial consultation', 'Product demonstration', 'Contract negotiation',
    'Quarterly business review', 'Strategy planning session', 'Team introduction',
    'Technical workshop', 'Executive briefing', 'Partnership discussion',
    'Renewal meeting', 'Expansion planning', 'Issue resolution meeting'
  ],
  note: [
    'Updated contact preferences', 'Noted budget constraints', 'Decision timeline confirmed',
    'Competitor mentioned', 'Referral opportunity identified', 'Risk factors noted',
    'Key stakeholder identified', 'Budget approved', 'Contract terms discussed',
    'Technical requirements documented', 'Integration needs noted', 'Success criteria defined'
  ],
  task: [
    'Send proposal by Friday', 'Schedule follow-up call', 'Prepare contract',
    'Update CRM records', 'Send product documentation', 'Coordinate with legal',
    'Prepare presentation', 'Review account history', 'Send pricing options',
    'Schedule demo', 'Complete due diligence', 'Finalize agreement terms'
  ]
};

const ACTIVITY_DESCRIPTIONS = {
  call: [
    'Discussed current challenges and potential solutions. Client showed interest in premium tier.',
    'Reviewed account performance and identified optimization opportunities.',
    'Addressed technical questions regarding integration. Scheduled follow-up with tech team.',
    'Covered pricing options and payment terms. Client requested formal proposal.',
    'Introduced new features and gathered feedback on product roadmap.',
  ],
  email: [
    'Sent comprehensive proposal including pricing, timeline, and implementation plan.',
    'Followed up on previous conversation. Attached relevant case studies.',
    'Provided requested documentation and answered outstanding questions.',
    'Confirmed meeting details and shared agenda for upcoming session.',
    'Sent contract for legal review with marked changes highlighted.',
  ],
  meeting: [
    'Productive session covering business objectives and success metrics. Next steps defined.',
    'Demo well received. Client team had good questions about scalability.',
    'Negotiated terms successfully. Minor legal review pending.',
    'Quarterly review showed positive ROI. Expansion discussion initiated.',
    'Technical deep-dive with engineering team. Integration timeline estimated.',
  ],
  note: [
    'Client prefers email communication over phone calls.',
    'Budget cycle ends in Q4 - timing opportunity for renewal.',
    'Main competitor is offering aggressive pricing - need to emphasize value.',
    'Key decision maker is CFO, not CTO as initially thought.',
    'Client mentioned potential referral to sister company.',
  ],
  task: [
    'Priority: High. Client waiting on this for budget approval.',
    'Coordinate with Sarah from Product team for technical details.',
    'Need legal review before sending. Allow 3 business days.',
    'Check with finance on special pricing eligibility.',
    'Prepare ROI analysis based on client-specific metrics.',
  ]
};

const TAG_DEFINITIONS = [
  { name: 'High Value', color: '#ef4444' },
  { name: 'Enterprise', color: '#f97316' },
  { name: 'Growth Account', color: '#eab308' },
  { name: 'At Risk', color: '#dc2626' },
  { name: 'Referral', color: '#22c55e' },
  { name: 'Partner Lead', color: '#3b82f6' },
  { name: 'Inbound', color: '#8b5cf6' },
  { name: 'Outbound', color: '#6366f1' },
  { name: 'Webinar Lead', color: '#ec4899' },
  { name: 'Conference', color: '#14b8a6' },
  { name: 'Strategic', color: '#f59e0b' },
  { name: 'VIP', color: '#a855f7' },
];

const PIPELINE_STAGES = [
  { name: 'New Lead', color: '#94a3b8', position: 0, isWon: false, isLost: false },
  { name: 'Qualified', color: '#3b82f6', position: 1, isWon: false, isLost: false },
  { name: 'Proposal Sent', color: '#8b5cf6', position: 2, isWon: false, isLost: false },
  { name: 'Negotiation', color: '#f59e0b', position: 3, isWon: false, isLost: false },
  { name: 'Closed Won', color: '#22c55e', position: 4, isWon: true, isLost: false },
  { name: 'Closed Lost', color: '#ef4444', position: 5, isWon: false, isLost: true },
];

const TEAM_MEMBERS = [
  { firstName: 'Carlos', lastName: 'Mendez', role: 'owner' as const, email: 'carlos.mendez@meridiantrading.io', title: 'CEO & Founder' },
  { firstName: 'Sarah', lastName: 'Chen', role: 'admin' as const, email: 'sarah.chen@meridiantrading.io', title: 'VP of Sales' },
  { firstName: 'Michael', lastName: 'Thompson', role: 'admin' as const, email: 'michael.thompson@meridiantrading.io', title: 'Head of Operations' },
  { firstName: 'Elena', lastName: 'Rodriguez', role: 'member' as const, email: 'elena.rodriguez@meridiantrading.io', title: 'Senior Account Executive' },
  { firstName: 'James', lastName: 'Wilson', role: 'member' as const, email: 'james.wilson@meridiantrading.io', title: 'Account Executive' },
  { firstName: 'Aisha', lastName: 'Patel', role: 'member' as const, email: 'aisha.patel@meridiantrading.io', title: 'Account Executive' },
  { firstName: 'Lucas', lastName: 'Andersson', role: 'member' as const, email: 'lucas.andersson@meridiantrading.io', title: 'Sales Development Rep' },
  { firstName: 'Maria', lastName: 'Santos', role: 'member' as const, email: 'maria.santos@meridiantrading.io', title: 'Sales Development Rep' },
  { firstName: 'David', lastName: 'Kim', role: 'member' as const, email: 'david.kim@meridiantrading.io', title: 'Customer Success Manager' },
  { firstName: 'Laura', lastName: 'Fischer', role: 'member' as const, email: 'laura.fischer@meridiantrading.io', title: 'Customer Success Manager' },
  { firstName: 'Robert', lastName: 'Martinez', role: 'readonly' as const, email: 'robert.martinez@meridiantrading.io', title: 'Finance Analyst' },
  { firstName: 'Jennifer', lastName: 'Lee', role: 'readonly' as const, email: 'jennifer.lee@meridiantrading.io', title: 'Compliance Officer' },
];

// ============================================================================
// Helper Functions
// ============================================================================

function formatPhone(rng: SeededRNG, countryCode: string): string {
  const formats: Record<string, () => string> = {
    US: () => `+1 ${rng.int(200, 999)}-${rng.int(200, 999)}-${rng.int(1000, 9999)}`,
    GB: () => `+44 ${rng.int(20, 79)} ${rng.int(1000, 9999)} ${rng.int(1000, 9999)}`,
    DE: () => `+49 ${rng.int(30, 89)} ${rng.int(10000000, 99999999)}`,
    ES: () => `+34 ${rng.int(600, 699)} ${rng.int(100, 999)} ${rng.int(100, 999)}`,
    FR: () => `+33 ${rng.int(6, 7)} ${rng.int(10, 99)} ${rng.int(10, 99)} ${rng.int(10, 99)} ${rng.int(10, 99)}`,
    NL: () => `+31 ${rng.int(6, 6)}${rng.int(10000000, 99999999)}`,
    CH: () => `+41 ${rng.int(76, 79)} ${rng.int(100, 999)} ${rng.int(10, 99)} ${rng.int(10, 99)}`,
    SG: () => `+65 ${rng.int(8, 9)}${rng.int(1000000, 9999999)}`,
    AU: () => `+61 ${rng.int(4, 4)}${rng.int(10000000, 99999999)}`,
    CA: () => `+1 ${rng.int(200, 999)}-${rng.int(200, 999)}-${rng.int(1000, 9999)}`,
  };
  return (formats[countryCode] || formats.US)();
}

function generateEmail(firstName: string, lastName: string, domain: string): string {
  const formats = [
    `${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}${lastName.toLowerCase()}`,
    `${firstName[0].toLowerCase()}${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}_${lastName.toLowerCase()}`,
    `${firstName.toLowerCase()}${lastName[0].toLowerCase()}`,
  ];
  return `${formats[Math.floor(Math.random() * formats.length)]}@${domain}`;
}

function generateCompanyDomain(companyName: string): string {
  const clean = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .slice(0, 20);
  const tlds = ['com', 'io', 'co', 'net', 'biz'];
  return `${clean}.${tlds[Math.floor(Math.random() * tlds.length)]}`;
}

function getBusinessHourDate(rng: SeededRNG, baseDate: Date): Date {
  const date = new Date(baseDate);
  // Set to business hours (9 AM - 6 PM)
  const hour = rng.int(9, 17);
  const minute = rng.int(0, 59);
  date.setHours(hour, minute, rng.int(0, 59), 0);

  // Skip weekends
  const day = date.getDay();
  if (day === 0) date.setDate(date.getDate() + 1);
  if (day === 6) date.setDate(date.getDate() + 2);

  return date;
}

function distributeAcrossMonth(rng: SeededRNG, yearMonth: string, count: number): Date[] {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates: Date[] = [];

  for (let i = 0; i < count; i++) {
    const day = rng.int(1, daysInMonth);
    const baseDate = new Date(year, month - 1, day);
    dates.push(getBusinessHourDate(rng, baseDate));
  }

  return dates.sort((a, b) => a.getTime() - b.getTime());
}

// ============================================================================
// Main Seed Function
// ============================================================================

async function seed() {
  console.log('\n========================================');
  console.log('   Meridian Trading Group - Data Seed');
  console.log('========================================\n');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  console.log(`Using seed: ${DEMO_SEED}`);
  const rng = new SeededRNG(DEMO_SEED);

  const client = postgres(databaseUrl, { prepare: false });
  const db = drizzle(client, { schema });

  try {
    // Check for existing tenant
    const existingTenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.name, 'Meridian Trading Group'),
    });

    if (existingTenant) {
      console.log('Tenant already exists. Skipping seed (idempotent).');
      console.log(`Tenant ID: ${existingTenant.id}`);
      await client.end();
      return;
    }

    console.log('Creating new tenant and data...\n');

    // ========================================================================
    // 1. Create Tenant
    // ========================================================================
    console.log('1. Creating tenant...');
    const [tenant] = await db.insert(schema.tenants).values({
      name: 'Meridian Trading Group',
    }).returning();
    console.log(`   Tenant ID: ${tenant.id}`);

    // ========================================================================
    // 2. Create Users
    // ========================================================================
    console.log('2. Creating team members...');
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const userRecords = await db.insert(schema.users).values(
      TEAM_MEMBERS.map((member) => ({
        email: member.email,
        passwordHash,
        tenantId: tenant.id,
        role: member.role,
        firstName: member.firstName,
        lastName: member.lastName,
        inviteAcceptedAt: new Date(),
      }))
    ).returning();

    const userMap = new Map(userRecords.map(u => [u.email, u]));
    const adminUser = userMap.get(ADMIN_EMAIL)!;
    const salesUsers = userRecords.filter(u =>
      u.role === 'member' || u.role === 'admin'
    );

    console.log(`   Created ${userRecords.length} users`);

    // ========================================================================
    // 3. Create Pipeline Stages
    // ========================================================================
    console.log('3. Creating pipeline stages...');
    const stageRecords = await db.insert(schema.pipelineStages).values(
      PIPELINE_STAGES.map(stage => ({
        tenantId: tenant.id,
        name: stage.name,
        color: stage.color,
        position: stage.position,
        isWon: stage.isWon,
        isLost: stage.isLost,
      }))
    ).returning();

    const stageMap = new Map(stageRecords.map(s => [s.name, s]));
    console.log(`   Created ${stageRecords.length} stages`);

    // ========================================================================
    // 4. Create Tags
    // ========================================================================
    console.log('4. Creating tags...');
    const tagRecords = await db.insert(schema.tags).values(
      TAG_DEFINITIONS.map(tag => ({
        tenantId: tenant.id,
        name: tag.name,
        color: tag.color,
      }))
    ).returning();
    console.log(`   Created ${tagRecords.length} tags`);

    // ========================================================================
    // 5. Create Companies
    // ========================================================================
    console.log('5. Creating companies...');
    const companyCount = rng.int(280, 350);
    const companyData: schema.NewCompany[] = [];
    const usedCompanyNames = new Set<string>();

    for (let i = 0; i < companyCount; i++) {
      let companyName: string;
      do {
        const prefix = rng.pick(COMPANY_PREFIXES);
        const core = rng.pick(COMPANY_CORES);
        const suffix = rng.pick(COMPANY_SUFFIXES);
        companyName = suffix ? `${prefix} ${core} ${suffix}` : `${prefix} ${core}`;
      } while (usedCompanyNames.has(companyName));
      usedCompanyNames.add(companyName);

      const country = rng.pick(COUNTRIES);
      const city = rng.pick(country.cities);
      const owner = rng.pick(salesUsers);

      companyData.push({
        tenantId: tenant.id,
        name: companyName,
        domain: generateCompanyDomain(companyName),
        industry: rng.pick(INDUSTRIES),
        size: rng.pickWeighted(COMPANY_SIZES, [5, 20, 35, 25, 10, 5]),
        ownerId: owner.id,
        city,
        country: country.name,
        phone: formatPhone(rng, country.code),
        website: `https://${generateCompanyDomain(companyName)}`,
      });
    }

    const companyRecords = await db.insert(schema.companies).values(companyData).returning();
    console.log(`   Created ${companyRecords.length} companies`);

    // ========================================================================
    // 6. Create Contacts (with growth curve)
    // ========================================================================
    console.log('6. Creating contacts with growth curve...');
    const contactData: schema.NewContact[] = [];
    const contactDates: Date[] = [];
    const usedEmails = new Set<string>();

    for (const { month, target } of MONTHLY_GROWTH) {
      const variance = rng.int(-Math.floor(target * 0.1), Math.floor(target * 0.1));
      const actualCount = target + variance;
      const dates = distributeAcrossMonth(rng, month, actualCount);

      for (const date of dates) {
        const firstName = rng.pick(FIRST_NAMES);
        const lastName = rng.pick(LAST_NAMES);
        const domain = rng.pick(EMAIL_DOMAINS);

        let email: string;
        let attempts = 0;
        do {
          const suffix = attempts > 0 ? rng.int(1, 999).toString() : '';
          email = generateEmail(firstName, lastName + suffix, domain);
          attempts++;
        } while (usedEmails.has(email) && attempts < 10);
        usedEmails.add(email);

        const company = rng.next() < 0.7 ? rng.pick(companyRecords) : null;
        const country = rng.pick(COUNTRIES);
        const owner = rng.pick(salesUsers);

        // Status distribution: realistic funnel
        const statusWeights = {
          lead: 35,
          prospect: 25,
          customer: 30,
          churned: 8,
          other: 2,
        };
        const status = rng.pickWeighted(
          Object.keys(statusWeights) as schema.Contact['status'][],
          Object.values(statusWeights)
        );

        contactData.push({
          tenantId: tenant.id,
          firstName,
          lastName,
          email,
          phone: formatPhone(rng, country.code),
          companyId: company?.id,
          ownerId: owner.id,
          status,
          createdAt: date,
          updatedAt: date,
        });
        contactDates.push(date);
      }
    }

    // Bulk insert contacts in batches
    const BATCH_SIZE = 500;
    const contactRecords: schema.Contact[] = [];
    for (let i = 0; i < contactData.length; i += BATCH_SIZE) {
      const batch = contactData.slice(i, i + BATCH_SIZE);
      const inserted = await db.insert(schema.contacts).values(batch).returning();
      contactRecords.push(...inserted);
    }
    console.log(`   Created ${contactRecords.length} contacts`);

    // Monthly breakdown
    const monthlyContacts = new Map<string, number>();
    for (const contact of contactRecords) {
      const month = contact.createdAt.toISOString().slice(0, 7);
      monthlyContacts.set(month, (monthlyContacts.get(month) || 0) + 1);
    }
    console.log('   Monthly distribution:');
    for (const [month, count] of [...monthlyContacts.entries()].sort()) {
      console.log(`     ${month}: ${count} contacts`);
    }

    // ========================================================================
    // 7. Create Contact Tags
    // ========================================================================
    console.log('7. Assigning tags to contacts...');
    const contactTagData: { contactId: string; tagId: string }[] = [];

    for (const contact of contactRecords) {
      // 60% of contacts get at least one tag
      if (rng.next() < 0.6) {
        const numTags = rng.int(1, 3);
        const shuffledTags = rng.shuffle(tagRecords);
        for (let i = 0; i < numTags && i < shuffledTags.length; i++) {
          contactTagData.push({
            contactId: contact.id,
            tagId: shuffledTags[i].id,
          });
        }
      }
    }

    for (let i = 0; i < contactTagData.length; i += BATCH_SIZE) {
      const batch = contactTagData.slice(i, i + BATCH_SIZE);
      await db.insert(schema.contactTags).values(batch);
    }
    console.log(`   Created ${contactTagData.length} contact-tag associations`);

    // ========================================================================
    // 8. Create Deals (with $8M/month target)
    // ========================================================================
    console.log('8. Creating deals...');
    const customerContacts = contactRecords.filter(c =>
      c.status === 'customer' || c.status === 'prospect'
    );

    const dealData: schema.NewDeal[] = [];
    const TARGET_MONTHLY_VALUE = 8_000_000;
    const monthlyDeals = new Map<string, { count: number; value: number }>();

    // Initialize monthly tracking
    for (const { month } of MONTHLY_GROWTH) {
      monthlyDeals.set(month, { count: 0, value: 0 });
    }

    // Generate deals with Pareto distribution for values
    for (const contact of customerContacts) {
      if (rng.next() > 0.85) continue; // 85% of customers have deals

      const numDeals = rng.pickWeighted([1, 2, 3], [70, 25, 5]);
      const month = contact.createdAt.toISOString().slice(0, 7);
      const monthData = monthlyDeals.get(month);
      if (!monthData) continue;

      for (let i = 0; i < numDeals; i++) {
        // Value distribution: mostly small, some medium, few large (whales)
        let value: number;
        const roll = rng.next();
        if (roll < 0.7) {
          // Small deals: $1k - $25k
          value = rng.lognormal(8000, 0.8);
        } else if (roll < 0.95) {
          // Medium deals: $25k - $150k
          value = rng.lognormal(50000, 0.6);
        } else {
          // Large deals (whales): $150k - $1M+
          value = rng.pareto(1.5, 150000);
        }
        value = Math.min(Math.max(Math.round(value * 100) / 100, 1000), 2000000);

        // Stage distribution - mix of active pipeline and closed deals
        // Use random distribution to simulate various deal ages and states
        const stageRoll = rng.next();
        let stage: schema.PipelineStage;

        if (stageRoll < 0.08) {
          // 8% - New leads (recent opportunities)
          stage = stageMap.get('New Lead')!;
        } else if (stageRoll < 0.18) {
          // 10% - Qualified (being evaluated)
          stage = stageMap.get('Qualified')!;
        } else if (stageRoll < 0.30) {
          // 12% - Proposal sent (active negotiations)
          stage = stageMap.get('Proposal Sent')!;
        } else if (stageRoll < 0.42) {
          // 12% - In negotiation (close to decision)
          stage = stageMap.get('Negotiation')!;
        } else if (stageRoll < 0.85) {
          // 43% - Closed Won (historical wins)
          stage = stageMap.get('Closed Won')!;
        } else {
          // 15% - Closed Lost (didn't convert)
          stage = stageMap.get('Closed Lost')!;
        }

        const owner = rng.pick(salesUsers);
        const dealDate = new Date(contact.createdAt);
        dealDate.setDate(dealDate.getDate() + rng.int(1, 30));

        dealData.push({
          tenantId: tenant.id,
          title: `${contact.company?.name || contact.firstName + ' ' + contact.lastName} - ${rng.pick(['Platform License', 'Enterprise Agreement', 'Annual Subscription', 'Premium Package', 'Growth Plan', 'Pro Tier'])}`,
          value: value.toString(),
          currency: 'USD',
          stageId: stage.id,
          position: dealData.filter(d => d.stageId === stage.id).length,
          ownerId: owner.id,
          contactId: contact.id,
          companyId: contact.companyId,
          expectedCloseDate: new Date(dealDate.getTime() + rng.int(30, 120) * 24 * 60 * 60 * 1000),
          probability: stage.isWon ? 100 : stage.isLost ? 0 : rng.int(20, 80),
          createdAt: dealDate,
          updatedAt: dealDate,
        });

        monthData.count++;
        if (stage.isWon) {
          monthData.value += value;
        }
      }
    }

    // Bulk insert deals
    const dealRecords: schema.Deal[] = [];
    for (let i = 0; i < dealData.length; i += BATCH_SIZE) {
      const batch = dealData.slice(i, i + BATCH_SIZE);
      const inserted = await db.insert(schema.deals).values(batch).returning();
      dealRecords.push(...inserted);
    }
    console.log(`   Created ${dealRecords.length} deals`);

    // Calculate actual revenue
    let totalWonValue = 0;
    for (const deal of dealRecords) {
      const stage = stageRecords.find(s => s.id === deal.stageId);
      if (stage?.isWon && deal.value) {
        totalWonValue += parseFloat(deal.value);
      }
    }
    console.log(`   Total won deal value: $${totalWonValue.toLocaleString()}`);

    // ========================================================================
    // 9. Create Activities
    // ========================================================================
    console.log('9. Creating activities...');
    const activityTypes: schema.Activity['type'][] = ['note', 'call', 'email', 'meeting', 'task'];
    const activityData: schema.NewActivity[] = [];

    for (const contact of contactRecords) {
      // Activity count based on status
      let activityCount: number;
      switch (contact.status) {
        case 'customer':
          activityCount = rng.int(5, 15);
          break;
        case 'prospect':
          activityCount = rng.int(3, 10);
          break;
        case 'lead':
          activityCount = rng.int(1, 5);
          break;
        default:
          activityCount = rng.int(0, 3);
      }

      for (let i = 0; i < activityCount; i++) {
        const type = rng.pickWeighted(activityTypes, [25, 25, 30, 10, 10]);
        const subjects = ACTIVITY_SUBJECTS[type];
        const descriptions = ACTIVITY_DESCRIPTIONS[type];
        const creator = rng.pick(salesUsers);

        // Activity date between contact creation and now
        const contactTime = contact.createdAt.getTime();
        const now = Date.now();
        const activityTime = contactTime + rng.next() * (now - contactTime);
        const activityDate = getBusinessHourDate(rng, new Date(activityTime));

        // Find associated deal if any
        const contactDeals = dealRecords.filter(d => d.contactId === contact.id);
        const associatedDeal = contactDeals.length > 0 && rng.next() < 0.6
          ? rng.pick(contactDeals)
          : null;

        activityData.push({
          tenantId: tenant.id,
          type,
          subject: rng.pick(subjects),
          description: rng.pick(descriptions),
          contactId: contact.id,
          companyId: contact.companyId,
          dealId: associatedDeal?.id,
          createdById: creator.id,
          scheduledAt: type === 'task' || type === 'meeting' ? activityDate : null,
          completedAt: rng.next() < 0.7 ? activityDate : null,
          durationMinutes: type === 'call' ? rng.int(5, 45) : type === 'meeting' ? rng.int(30, 90) : null,
          createdAt: activityDate,
          updatedAt: activityDate,
        });
      }
    }

    // Bulk insert activities
    for (let i = 0; i < activityData.length; i += BATCH_SIZE) {
      const batch = activityData.slice(i, i + BATCH_SIZE);
      await db.insert(schema.activities).values(batch);
    }
    console.log(`   Created ${activityData.length} activities`);

    // ========================================================================
    // 10. Create Audit Logs (sample) - only using basic CRUD actions
    // ========================================================================
    console.log('10. Creating audit logs...');
    const auditData: schema.NewAuditLog[] = [];

    // Log some contact creates
    const sampleContacts = rng.shuffle(contactRecords).slice(0, 500);
    for (const contact of sampleContacts) {
      auditData.push({
        tenantId: tenant.id,
        userId: contact.ownerId || adminUser.id,
        action: 'create',
        entityType: 'contact',
        entityId: contact.id,
        newValues: { firstName: contact.firstName, lastName: contact.lastName, email: contact.email },
        createdAt: contact.createdAt,
      });
    }

    // Log some deal creates
    const sampleDeals = rng.shuffle(dealRecords).slice(0, 300);
    for (const deal of sampleDeals) {
      auditData.push({
        tenantId: tenant.id,
        userId: deal.ownerId || adminUser.id,
        action: 'create',
        entityType: 'deal',
        entityId: deal.id,
        newValues: { title: deal.title, value: deal.value },
        createdAt: deal.createdAt,
      });
    }

    // Log some company creates
    const sampleCompanies = rng.shuffle(companyRecords).slice(0, 200);
    for (const company of sampleCompanies) {
      auditData.push({
        tenantId: tenant.id,
        userId: company.ownerId || adminUser.id,
        action: 'create',
        entityType: 'company',
        entityId: company.id,
        newValues: { name: company.name, domain: company.domain },
        createdAt: company.createdAt,
      });
    }

    // Bulk insert audit logs
    for (let i = 0; i < auditData.length; i += BATCH_SIZE) {
      const batch = auditData.slice(i, i + BATCH_SIZE);
      await db.insert(schema.auditLogs).values(batch);
    }
    console.log(`   Created ${auditData.length} audit log entries`);

    // ========================================================================
    // Summary
    // ========================================================================
    console.log('\n========================================');
    console.log('           SEED COMPLETE');
    console.log('========================================\n');

    console.log('TENANT DETAILS:');
    console.log(`  Name: Meridian Trading Group`);
    console.log(`  ID: ${tenant.id}`);
    console.log(`  Slug: ${TENANT_SLUG}`);

    console.log('\nADMIN LOGIN:');
    console.log(`  Email: ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);

    console.log('\nDATA SUMMARY:');
    console.log(`  Users: ${userRecords.length}`);
    console.log(`  Pipeline Stages: ${stageRecords.length}`);
    console.log(`  Tags: ${tagRecords.length}`);
    console.log(`  Companies: ${companyRecords.length}`);
    console.log(`  Contacts: ${contactRecords.length}`);
    console.log(`  Contact Tags: ${contactTagData.length}`);
    console.log(`  Deals: ${dealRecords.length}`);
    console.log(`  Activities: ${activityData.length}`);
    console.log(`  Audit Logs: ${auditData.length}`);

    const totalRows = userRecords.length + stageRecords.length + tagRecords.length +
      companyRecords.length + contactRecords.length + contactTagData.length +
      dealRecords.length + activityData.length + auditData.length + 1;
    console.log(`  TOTAL ROWS: ${totalRows.toLocaleString()}`);

    console.log('\nMONTHLY METRICS:');
    const statusCounts = {
      lead: contactRecords.filter(c => c.status === 'lead').length,
      prospect: contactRecords.filter(c => c.status === 'prospect').length,
      customer: contactRecords.filter(c => c.status === 'customer').length,
      churned: contactRecords.filter(c => c.status === 'churned').length,
    };
    console.log(`  Status Distribution:`);
    console.log(`    Leads: ${statusCounts.lead}`);
    console.log(`    Prospects: ${statusCounts.prospect}`);
    console.log(`    Customers: ${statusCounts.customer}`);
    console.log(`    Churned: ${statusCounts.churned}`);

    console.log('\n  Pipeline Value by Stage:');
    for (const stage of stageRecords) {
      const stageDeals = dealRecords.filter(d => d.stageId === stage.id);
      const stageValue = stageDeals.reduce((sum, d) => sum + parseFloat(d.value || '0'), 0);
      console.log(`    ${stage.name}: ${stageDeals.length} deals, $${stageValue.toLocaleString()}`);
    }

    console.log('\nVERIFICATION QUERIES:');
    console.log('  Total contacts: SELECT COUNT(*) FROM contacts WHERE tenant_id = \'' + tenant.id + '\';');
    console.log('  Total pipeline value: SELECT SUM(CAST(value AS DECIMAL)) FROM deals WHERE tenant_id = \'' + tenant.id + '\';');
    console.log('  Won deals value: SELECT SUM(CAST(value AS DECIMAL)) FROM deals d JOIN pipeline_stages s ON d.stage_id = s.id WHERE d.tenant_id = \'' + tenant.id + '\' AND s.is_won = true;');

    console.log('\n========================================\n');

    await client.end();
  } catch (error) {
    console.error('Seed failed:', error);
    await client.end();
    process.exit(1);
  }
}

// Run the seed
seed().catch(console.error);
