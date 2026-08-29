export type Role = 'admin' | 'operator' | 'viewer';
export type AuthSource = 'local' | 'authmate';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash?: string;
  authSource: AuthSource;
  ssoSub?: string;
  role: Role;
  avatarUrl?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
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
  config: Record<string, any>; // Automatically encrypted in storage
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
  eabHmacKey?: string; // Encrypted in storage
  accountPrivateKeyPem?: string; // Encrypted in storage
  accountUrl?: string;
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
    // Local / SSH
    targetPath?: string;
    certFileName?: string;
    keyFileName?: string;
    fullchainFileName?: string;
    reloadCommand?: string;
    
    // Cloud
    domain?: string;
    zoneId?: string;
    certName?: string;
    region?: string;
    
    // Panels
    siteName?: string;
    websiteId?: string;
    
    // Webhook
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
  domains: string[]; // e.g. ["example.com", "*.example.com"]
  acmeAccountId: string;
  dnsCredentialId?: string; // For DNS-01 challenge
  validationType: 'dns-01' | 'http-01';
  keyType: KeyType;
  
  // Deploy Targets (1 or multiple)
  deployTargets: DeployTarget[];
  
  // Auto-renewal and alerts
  autoRenew: boolean;
  renewDaysBefore: number; // e.g. 30
  cronExpr: string; // e.g. "0 2 * * *"
  notifyChannelIds: string[];
  
  // Runtime status
  status: TaskStatus;
  lastRunStatus: TaskRunStatus;
  lastRunAt?: string;
  lastRunMessage?: string;
  nextRenewAt?: string;
  currentCertId?: string;
  
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
  certPem: string;
  privkeyPem: string; // Encrypted in storage
  fullchainPem: string;
  fingerprintSha256: string;
  keyType: string;
  issuedAt: string;
  expiresAt: string;
  isRevoked: boolean;
  createdAt: string;
}

export type NotifyChannelType = 'dingtalk' | 'feishu' | 'wecom' | 'email' | 'telegram' | 'webhook';

export interface NotifyChannel {
  id: string;
  name: string;
  type: NotifyChannelType;
  config: Record<string, any>; // Encrypted in storage
  isEnabled: boolean;
  events: ('renew_success' | 'renew_failed' | 'expiring_soon')[];
  createdAt: string;
  updatedAt: string;
}

export interface DomainMonitor {
  id: string;
  domain: string;
  port: number;
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
  logs: Array<{ timestamp: string; level: 'info' | 'warn' | 'error' | 'success'; message: string }>;
  durationMs: number;
  startedAt: string;
  finishedAt?: string;
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

export interface DatabaseSchema {
  users: User[];
  credentials: Credential[];
  acmeAccounts: AcmeAccount[];
  tasks: CertTask[];
  certificates: Certificate[];
  notifyChannels: NotifyChannel[];
  domainMonitors: DomainMonitor[];
  executionLogs: TaskExecutionLog[];
  settings: SystemSettings;
}
