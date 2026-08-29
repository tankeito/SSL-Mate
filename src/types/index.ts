export type Role = 'admin' | 'operator' | 'viewer';
export type AuthSource = 'local' | 'authmate';

export interface User {
  id: string;
  username: string;
  email: string;
  authSource: AuthSource;
  role: Role;
  avatarUrl?: string;
  isActive?: boolean;
  twoFactorEnabled?: boolean;
  lastLoginAt?: string;
  updatedAt?: string;
  ssoSub?: string;
  createdAt: string;
}

export type CredentialType = 
  | 'dns_cloudflare'
  | 'dns_aliyun'
  | 'dns_tencent'
  | 'dns_huawei'
  | 'dns_manual'
  | 'ssh_host'
  | 'aliyun_cloud'
  | 'tencent_cloud'
  | 'cloudflare_zone'
  | 'bt_panel'
  | 'one_panel'
  | 'safeline'
  | 'generic_webhook';

export interface Credential {
  id: string;
  name: string;
  type: CredentialType;
  config: Record<string, any>;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export type CAProvider = 'letsencrypt' | 'letsencrypt_staging' | 'zerossl' | 'google' | 'custom';
export type KeyType = 'ec256' | 'ec384' | 'rsa2048' | 'rsa4096';

export interface AcmeAccount {
  id: string;
  name: string;
  caProvider: CAProvider;
  email: string;
  directoryUrl: string;
  eabKid?: string;
  hasEabHmac?: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DeployTargetType = 
  | 'local_file'
  | 'ssh'
  | 'aliyun_cdn'
  | 'tencent_cdn'
  | 'cloudflare'
  | 'bt_panel'
  | 'one_panel'
  | 'safeline'
  | 'webhook';

export interface DeployTarget {
  id: string;
  type: DeployTargetType;
  name: string;
  credentialId?: string;
  enabled: boolean;
  config: {
    targetPath?: string;
    certFileName?: string;
    keyFileName?: string;
    fullchainFileName?: string;
    reloadCommand?: string;
    domain?: string;
    zoneId?: string;
    certName?: string;
    region?: string;
    siteName?: string;
    websiteId?: string;
    webhookUrl?: string;
    authHeader?: string;
    customPayload?: string;
  };
}

export type TaskStatus = 'active' | 'pending' | 'error' | 'expired' | 'renewing';
export type TaskRunStatus = 'idle' | 'running' | 'success' | 'failed';

export interface CertTask {
  id: string;
  name: string;
  domains: string[];
  acmeAccountId: string;
  dnsCredentialId?: string;
  validationType: 'dns-01' | 'http-01';
  keyType: KeyType;
  deployTargets: DeployTarget[];
  autoRenew: boolean;
  renewDaysBefore: number;
  cronExpr: string;
  notifyChannelIds: string[];
  status: TaskStatus;
  lastRunStatus: TaskRunStatus;
  lastRunAt?: string;
  lastRunMessage?: string;
  nextRenewAt?: string;
  currentCertId?: string;
  daysRemaining?: number | null;
  certExpiresAt?: string | null;
  certIssuer?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Certificate {
  id: string;
  taskId?: string;
  primaryDomain: string;
  sanDomains: string[];
  issuer: string;
  serialNumber: string;
  certPem?: string;
  privkeyPem?: string;
  fullchainPem?: string;
  fingerprintSha256: string;
  keyType: string;
  issuedAt: string;
  expiresAt: string;
  daysLeft?: number;
  isExpired?: boolean;
  isRevoked: boolean;
  createdAt: string;
}

export type NotifyChannelType = 'dingtalk' | 'feishu' | 'wecom' | 'email' | 'telegram' | 'webhook';

export interface NotifyChannel {
  id: string;
  name: string;
  type: NotifyChannelType;
  config: Record<string, any>;
  isEnabled: boolean;
  events: ('renew_success' | 'renew_failed' | 'expiring_soon')[];
  createdAt: string;
  updatedAt: string;
}

export interface DomainMonitor {
  id: string;
  domain: string;
  port: number;
  remark?: string;
  status: 'healthy' | 'warning' | 'expired' | 'unreachable';
  issuer?: string;
  expiresAt?: string;
  daysLeft?: number;
  lastCheckAt?: string;
  lastCheckError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskExecutionLog {
  id: string;
  taskId: string;
  taskName: string;
  triggerType: 'auto_cron' | 'manual' | 'webhook';
  status: 'running' | 'success' | 'failed';
  stage?: string;
  errorMessage?: string;
  logs: Array<{ timestamp: string; level: 'info' | 'warn' | 'error' | 'success'; message: string; stage?: string }>;
  durationMs: number;
  startedAt: string;
  finishedAt?: string;
}

export interface DashboardStats {
  totalTasks: number;
  activeTasks: number;
  totalCerts: number;
  activeCerts: number;
  expiringSoonCerts: number;
  expiredCerts: number;
  tasksSuccessCount: number;
  tasksFailedCount: number;
  tasksRunningCount: number;
  totalMonitors: number;
  healthyMonitors: number;
  warningMonitors: number;
  recentLogs: TaskExecutionLog[];
}

export interface SystemSettings {
  authmate: {
    issuerUrl: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    enabled: boolean;
  };
  globalRenewCheckCron: string;
  defaultRenewDaysBefore: number;
}
