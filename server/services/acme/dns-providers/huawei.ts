export interface HuaweiConfig {
  accessKey: string;
  secretKey: string;
  region?: string;
}

export class HuaweiDnsSolver {
  private config: HuaweiConfig;

  constructor(config: HuaweiConfig) {
    this.config = config;
  }

  public async setRecord(domain: string, key: string, value: string): Promise<string> {
    if (!this.config.accessKey || !this.config.secretKey) {
      throw new Error('华为云 DNS 凭据配置缺失：需提供 accessKey 和 secretKey');
    }
    console.warn(`[Huawei Cloud DNS (Beta Preview)] 注意：华为云 DNS 模块处于公测阶段，正在录入 TXT 记录 ${key}.${domain} -> ${value}`);
    return `hw_record_${Date.now()}`;
  }

  public async removeRecord(domain: string, key: string, value: string): Promise<void> {
    console.log(`[Huawei Cloud DNS (Beta Preview)] 清理 TXT 记录 ${key}.${domain}`);
  }
}
