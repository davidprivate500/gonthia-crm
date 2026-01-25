import { ApiResponse } from './response';

const API_BASE = '/api/v1';
const MASTER_API_BASE = '/api/master';
const CSRF_COOKIE_NAME = 'gonthia-csrf-token';

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(^| )${CSRF_COOKIE_NAME}=([^;]+)`));
  return match ? match[2] : null;
}

async function ensureCsrfToken(): Promise<string | null> {
  let token = getCsrfToken();
  if (!token) {
    // Fetch CSRF token from API
    const response = await fetch('/api/v1/csrf', { credentials: 'include' });
    if (response.ok) {
      const data = await response.json();
      token = data.token;
    }
  }
  return token;
}

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

function buildSearchParams(params?: Record<string, string | number | boolean | undefined>): URLSearchParams {
  const searchParams = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value));
      }
    }
  }
  return searchParams;
}

async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<ApiResponse<T>> {
  const { body, ...rest } = options;
  const method = rest.method || 'GET';

  // Get CSRF token for mutating requests
  const csrfToken = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
    ? await ensureCsrfToken()
    : null;

  const config: RequestInit = {
    ...rest,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
      ...rest.headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json();

  if (!response.ok) {
    throw data;
  }

  return data;
}

async function masterApiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<ApiResponse<T>> {
  const { body, ...rest } = options;
  const method = rest.method || 'GET';

  // Get CSRF token for mutating requests
  const csrfToken = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
    ? await ensureCsrfToken()
    : null;

  const config: RequestInit = {
    ...rest,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
      ...rest.headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${MASTER_API_BASE}${endpoint}`, config);
  const data = await response.json();

  if (!response.ok) {
    throw data;
  }

  return data;
}

export const api = {
  // Auth
  auth: {
    register: (data: { email: string; password: string; organizationName: string; firstName?: string; lastName?: string }) =>
      apiFetch('/auth/register', { method: 'POST', body: data }),
    login: (data: { email: string; password: string }) =>
      apiFetch('/auth/login', { method: 'POST', body: data }),
    logout: () => apiFetch('/auth/logout', { method: 'POST' }),
    me: () => apiFetch('/auth/me'),
    forgotPassword: (data: { email: string }) =>
      apiFetch('/auth/forgot-password', { method: 'POST', body: data }),
    resetPassword: (data: { token: string; password: string }) =>
      apiFetch('/auth/reset-password', { method: 'POST', body: data }),
  },

  // Organization
  organization: {
    get: () => apiFetch('/organization'),
    update: (data: { name: string }) =>
      apiFetch('/organization', { method: 'PATCH', body: data }),
    listUsers: (params?: { page?: number; pageSize?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
      return apiFetch(`/organization/users?${searchParams}`);
    },
    inviteUser: (data: { email: string; role: string; firstName?: string; lastName?: string }) =>
      apiFetch('/organization/users', { method: 'POST', body: data }),
    updateUserRole: (userId: string, data: { role: string }) =>
      apiFetch(`/organization/users/${userId}`, { method: 'PATCH', body: data }),
    removeUser: (userId: string) =>
      apiFetch(`/organization/users/${userId}`, { method: 'DELETE' }),
  },

  // Contacts
  contacts: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiFetch(`/contacts?${buildSearchParams(params)}`),
    get: (id: string) => apiFetch(`/contacts/${id}`),
    create: (data: Record<string, unknown>) => apiFetch('/contacts', { method: 'POST', body: data }),
    update: (id: string, data: Record<string, unknown>) =>
      apiFetch(`/contacts/${id}`, { method: 'PATCH', body: data }),
    delete: (id: string) => apiFetch(`/contacts/${id}`, { method: 'DELETE' }),
  },

  // Companies
  companies: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiFetch(`/companies?${buildSearchParams(params)}`),
    get: (id: string) => apiFetch(`/companies/${id}`),
    create: (data: Record<string, unknown>) => apiFetch('/companies', { method: 'POST', body: data }),
    update: (id: string, data: Record<string, unknown>) =>
      apiFetch(`/companies/${id}`, { method: 'PATCH', body: data }),
    delete: (id: string) => apiFetch(`/companies/${id}`, { method: 'DELETE' }),
  },

  // Pipeline
  pipeline: {
    getBoard: (params?: { ownerId?: string }) =>
      apiFetch(`/pipeline/board?${buildSearchParams(params)}`),
    listStages: () => apiFetch('/pipeline/stages'),
    createStage: (data: Record<string, unknown>) =>
      apiFetch('/pipeline/stages', { method: 'POST', body: data }),
    updateStage: (id: string, data: Record<string, unknown>) =>
      apiFetch(`/pipeline/stages/${id}`, { method: 'PATCH', body: data }),
    deleteStage: (id: string) =>
      apiFetch(`/pipeline/stages/${id}`, { method: 'DELETE' }),
    reorderStages: (stages: { id: string; position: number }[]) =>
      apiFetch('/pipeline/stages', { method: 'PUT', body: { stages } }),
  },

  // Deals
  deals: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiFetch(`/deals?${buildSearchParams(params)}`),
    get: (id: string) => apiFetch(`/deals/${id}`),
    create: (data: Record<string, unknown>) => apiFetch('/deals', { method: 'POST', body: data }),
    update: (id: string, data: Record<string, unknown>) =>
      apiFetch(`/deals/${id}`, { method: 'PATCH', body: data }),
    delete: (id: string) => apiFetch(`/deals/${id}`, { method: 'DELETE' }),
    move: (id: string, data: { stageId: string; position?: number }) =>
      apiFetch(`/deals/${id}/move`, { method: 'POST', body: data }),
  },

  // Activities
  activities: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiFetch(`/activities?${buildSearchParams(params)}`),
    get: (id: string) => apiFetch(`/activities/${id}`),
    create: (data: Record<string, unknown>) => apiFetch('/activities', { method: 'POST', body: data }),
    update: (id: string, data: Record<string, unknown>) =>
      apiFetch(`/activities/${id}`, { method: 'PATCH', body: data }),
    delete: (id: string) => apiFetch(`/activities/${id}`, { method: 'DELETE' }),
    complete: (id: string) =>
      apiFetch(`/activities/${id}/complete`, { method: 'POST' }),
    uncomplete: (id: string) =>
      apiFetch(`/activities/${id}/complete`, { method: 'DELETE' }),
  },

  // Tags
  tags: {
    list: (params?: { search?: string }) =>
      apiFetch(`/tags?${buildSearchParams(params)}`),
    create: (data: { name: string; color?: string }) =>
      apiFetch('/tags', { method: 'POST', body: data }),
    update: (id: string, data: { name?: string; color?: string }) =>
      apiFetch(`/tags/${id}`, { method: 'PATCH', body: data }),
    delete: (id: string) => apiFetch(`/tags/${id}`, { method: 'DELETE' }),
  },

  // Search
  search: (params: { q: string; types?: string; limit?: number }) =>
    apiFetch(`/search?${buildSearchParams(params)}`),

  // Reports & Dashboard
  reports: {
    dashboard: (params?: { preset?: string; from?: string; to?: string }) =>
      apiFetch(`/reports/dashboard?${buildSearchParams(params)}`),
    metrics: (params?: { preset?: string; from?: string; to?: string }) =>
      apiFetch(`/reports/metrics?${buildSearchParams(params)}`),
    monthly: (params?: { preset?: string; from?: string; to?: string }) =>
      apiFetch(`/reports/monthly?${buildSearchParams(params)}`),
  },

  // Dashboard (legacy - use reports.dashboard)
  dashboard: (params?: { preset?: string; from?: string; to?: string }) =>
    apiFetch(`/reports/dashboard?${buildSearchParams(params)}`),

  // API Keys
  apiKeys: {
    list: (params?: { page?: number; pageSize?: number; includeRevoked?: boolean }) =>
      apiFetch(`/api-keys?${buildSearchParams(params)}`),
    create: (data: { name: string; expiresAt?: string }) =>
      apiFetch('/api-keys', { method: 'POST', body: data }),
    revoke: (id: string) => apiFetch(`/api-keys/${id}`, { method: 'DELETE' }),
  },

  // Audit Logs
  auditLogs: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiFetch(`/audit-logs?${buildSearchParams(params)}`),
  },

  // Import/Export
  import: {
    list: (params?: Record<string, string | number | undefined>) =>
      apiFetch(`/import?${buildSearchParams(params)}`),
    get: (id: string) => apiFetch(`/import/${id}`),
    getJob: (id: string) => apiFetch(`/import/${id}`),
    create: (formData: FormData) =>
      fetch(`${API_BASE}/import`, { method: 'POST', body: formData, credentials: 'include' }).then(r => r.json()),
  },
  export: (params: { entityType: string; format?: string }) =>
    fetch(`${API_BASE}/export?${buildSearchParams(params)}`, { credentials: 'include' }),

  // Master Admin APIs
  master: {
    // Platform settings
    settings: {
      get: () => masterApiFetch('/settings'),
      update: (data: Record<string, unknown>) =>
        masterApiFetch('/settings', { method: 'PUT', body: data }),
    },

    // Tenants
    tenants: {
      list: (params?: Record<string, string | number | undefined>) =>
        masterApiFetch(`/tenants?${buildSearchParams(params)}`),
      get: (id: string) => masterApiFetch(`/tenants/${id}`),
      updateBilling: (id: string, data: Record<string, unknown>) =>
        masterApiFetch(`/tenants/${id}`, { method: 'PUT', body: data }),
    },

    // Invoices
    invoices: {
      listForTenant: (tenantId: string, params?: Record<string, string | number | undefined>) =>
        masterApiFetch(`/tenants/${tenantId}/invoices?${buildSearchParams(params)}`),
      create: (tenantId: string, data: Record<string, unknown>) =>
        masterApiFetch(`/tenants/${tenantId}/invoices`, { method: 'POST', body: data }),
      get: (invoiceId: string) => masterApiFetch(`/invoices/${invoiceId}`),
      update: (invoiceId: string, data: Record<string, unknown>) =>
        masterApiFetch(`/invoices/${invoiceId}`, { method: 'PATCH', body: data }),
      delete: (invoiceId: string) =>
        masterApiFetch(`/invoices/${invoiceId}`, { method: 'DELETE' }),
    },

    // Demo Generator
    demoGenerator: {
      list: (params?: Record<string, string | number | undefined>) =>
        masterApiFetch(`/demo-generator?${buildSearchParams(params)}`),
      get: (jobId: string) => masterApiFetch(`/demo-generator/${jobId}`),
      create: (data: Record<string, unknown>) =>
        masterApiFetch('/demo-generator', { method: 'POST', body: data }),
      preview: (data: Record<string, unknown>) =>
        masterApiFetch('/demo-generator/preview', { method: 'POST', body: data }),
      validatePlan: (data: Record<string, unknown>) =>
        masterApiFetch('/demo-generator/validate-plan', { method: 'POST', body: data }),
      delete: (jobId: string) =>
        masterApiFetch(`/demo-generator/${jobId}`, { method: 'DELETE' }),
      // Patch endpoints
      getTenantKpis: (tenantId: string, params: { from: string; to: string }) =>
        masterApiFetch(`/demo-generator/tenants/${tenantId}/kpis?${buildSearchParams(params)}`),
      validatePatch: (tenantId: string, data: Record<string, unknown>) =>
        masterApiFetch(`/demo-generator/tenants/${tenantId}/patch/validate`, { method: 'POST', body: data }),
      applyPatch: (tenantId: string, data: Record<string, unknown>) =>
        masterApiFetch(`/demo-generator/tenants/${tenantId}/patch/apply`, { method: 'POST', body: data }),
      getPatchJob: (jobId: string) =>
        masterApiFetch(`/demo-generator/patch-jobs/${jobId}`),
      listPatchJobs: (params?: { tenantId?: string; status?: string; page?: number; limit?: number }) =>
        masterApiFetch(`/demo-generator/patch-jobs?${buildSearchParams(params as Record<string, string | number | undefined>)}`),
    },

    // Reports (cross-tenant analytics)
    reports: {
      metrics: (params?: { preset?: string; from?: string; to?: string; tenantId?: string }) =>
        masterApiFetch(`/reports/metrics?${buildSearchParams(params)}`),
      monthly: (params?: { preset?: string; from?: string; to?: string; tenantId?: string }) =>
        masterApiFetch(`/reports/monthly?${buildSearchParams(params)}`),
    },

    // Impersonation
    impersonate: (tenantId: string) =>
      masterApiFetch<{ success: boolean; message: string; redirectUrl: string; tenantName: string }>(
        '/auth/impersonate',
        { method: 'POST', body: { tenantId } }
      ),
    exitImpersonation: () =>
      masterApiFetch<{ success: boolean; message: string; redirectUrl: string }>(
        '/auth/exit-impersonation',
        { method: 'POST' }
      ),
  },

  // Tenant Billing APIs (for tenants to view their own invoices)
  billing: {
    info: {
      get: () => apiFetch('/billing/info'),
      update: (data: Record<string, unknown>) =>
        apiFetch('/billing/info', { method: 'PUT', body: data }),
    },
    invoices: {
      list: (params?: Record<string, string | number | undefined>) =>
        apiFetch(`/billing/invoices?${buildSearchParams(params)}`),
      get: (invoiceId: string) => apiFetch(`/billing/invoices/${invoiceId}`),
    },
  },
};
