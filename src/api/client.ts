const API_BASE = '/api';

export class ApiError extends Error {
  public status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('sslmate_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers
  });

  if (res.status === 401) {
    localStorage.removeItem('sslmate_token');
    if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/oauth/callback')) {
      window.location.href = '/login';
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || `Request failed with status ${res.status}`, res.status);
  }

  return data as T;
}

export const api = {
  // Auth & Users
  login: (data: any) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getSsoUrl: () => request<{ authUrl: string; state: string }>('/auth/sso/url'),
  ssoCallback: (code: string, state: string) => request('/auth/sso/callback', { method: 'POST', body: JSON.stringify({ code, state }) }),
  getMe: () => request('/auth/me'),
  changePassword: (data: any) => request('/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),
  getSystemInfo: () => request<{ name: string; version: string; ssoEnabled: boolean; issuerUrl: string }>('/system/info'),
  getUsers: () => request<any[]>('/users'),
  createUser: (data: any) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) => request(`/users/${id}`, { method: 'DELETE' }),
  setup2FA: (userId: string) => request<{ secret: string; otpauthUrl: string; email: string }>(`/users/${userId}/2fa/setup`, { method: 'POST' }),
  verify2FA: (userId: string, data: { secret: string; code: string }) => request<{ success: boolean; message: string }>(`/users/${userId}/2fa/verify`, { method: 'POST', body: JSON.stringify(data) }),
  disable2FA: (userId: string) => request<{ success: boolean; message: string }>(`/users/${userId}/2fa/disable`, { method: 'POST' }),

  // Tasks
  getTasks: () => request<any[]>('/tasks'),
  getTask: (id: string) => request(`/tasks/${id}`),
  createTask: (data: any) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: string, data: any) => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTask: (id: string) => request(`/tasks/${id}`, { method: 'DELETE' }),
  runTask: (id: string) => request<{ success: boolean; message: string; taskId: string }>(`/tasks/${id}/run`, { method: 'POST' }),
  getTaskLogs: (id: string) => request<any[]>(`/tasks/${id}/logs`),

  // Credentials
  getCredentials: () => request<any[]>('/credentials'),
  createCredential: (data: any) => request('/credentials', { method: 'POST', body: JSON.stringify(data) }),
  updateCredential: (id: string, data: any) => request(`/credentials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCredential: (id: string) => request(`/credentials/${id}`, { method: 'DELETE' }),
  testCredential: (data: any) => request<{ success: boolean; message: string; sites?: any[] }>('/credentials/test', { method: 'POST', body: JSON.stringify(data) }),
  getCredentialSites: (id: string) => request<{ sites: string[] }>(`/credentials/${id}/sites`),

  // ACME Accounts
  getAcmeAccounts: () => request<any[]>('/acme-accounts'),
  createAcmeAccount: (data: any) => request('/acme-accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAcmeAccount: (id: string, data: any) => request(`/acme-accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAcmeAccount: (id: string) => request(`/acme-accounts/${id}`, { method: 'DELETE' }),

  // Certificates
  getCerts: () => request<any[]>('/certs'),
  getCert: (id: string) => request(`/certs/${id}`),
  inspectCert: (certPem: string) => request('/certs/inspect', { method: 'POST', body: JSON.stringify({ certPem }) }),
  deleteCert: (id: string) => request(`/certs/${id}`, { method: 'DELETE' }),

  // Monitors
  getMonitors: () => request<any[]>('/monitors'),
  createMonitor: (data: { domain: string; port?: number; remark?: string }) => request('/monitors', { method: 'POST', body: JSON.stringify(data) }),
  createBatchMonitors: (items: Array<{ domain: string; port?: number; remark?: string }>) => request<{ totalAdded: number; duplicatesSkipped: number; monitors: any[] }>('/monitors/batch', { method: 'POST', body: JSON.stringify({ items }) }),
  updateMonitor: (id: string, data: { port?: number; remark?: string }) => request(`/monitors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  checkMonitor: (id: string) => request(`/monitors/${id}/check`, { method: 'POST' }),
  deleteMonitor: (id: string) => request(`/monitors/${id}`, { method: 'DELETE' }),

  // Notify Channels
  getChannels: () => request<any[]>('/notify/channels'),
  createChannel: (data: any) => request('/notify/channels', { method: 'POST', body: JSON.stringify(data) }),
  updateChannel: (id: string, data: any) => request(`/notify/channels/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteChannel: (id: string) => request(`/notify/channels/${id}`, { method: 'DELETE' }),
  testChannel: (data: any) => request<{ success: boolean; message: string }>('/notify/test', { method: 'POST', body: JSON.stringify(data) }),

  // System & Stats
  getStats: () => request<any>('/system/stats'),
  getSettings: () => request<any>('/system/settings'),
  updateSettings: (data: any) => request('/system/settings', { method: 'PUT', body: JSON.stringify(data) })
};
