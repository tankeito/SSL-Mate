export interface CloudflareConfig {
  apiToken?: string;
  authEmail?: string;
  authKey?: string;
}

export class CloudflareDnsSolver {
  private config: CloudflareConfig;

  constructor(config: CloudflareConfig) {
    this.config = config;
  }

  private getHeaders(): Record<string, string> {
    if (this.config.apiToken) {
      return {
        'Authorization': `Bearer ${this.config.apiToken.trim()}`,
        'Content-Type': 'application/json'
      };
    }
    return {
      'X-Auth-Email': this.config.authEmail?.trim() || '',
      'X-Auth-Key': this.config.authKey?.trim() || '',
      'Content-Type': 'application/json'
    };
  }

  private async getZoneId(domain: string): Promise<string> {
    const cleanDomain = domain.replace(/^\*\./, '');
    const parts = cleanDomain.split('.');
    
    // Try matching root zone (e.g. for sub.example.com, try example.com)
    for (let i = 0; i < parts.length - 1; i++) {
      const zoneCandidate = parts.slice(i).join('.');
      const url = `https://api.cloudflare.com/client/v4/zones?name=${zoneCandidate}`;
      const res = await fetch(url, { headers: this.getHeaders() });
      if (res.ok) {
        const data = await res.json() as any;
        if (data.success && data.result && data.result.length > 0) {
          return data.result[0].id;
        }
      }
    }
    throw new Error(`Cloudflare Zone not found for domain: ${domain}`);
  }

  public async setRecord(domain: string, key: string, value: string): Promise<string> {
    const zoneId = await this.getZoneId(domain);
    const recordName = `_acme-challenge.${domain.replace(/^\*\./, '')}`;

    // Create TXT record
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        type: 'TXT',
        name: recordName,
        content: value,
        ttl: 120
      })
    });

    const data = await res.json() as any;
    if (!res.ok || !data.success) {
      const msg = data.errors?.map((e: any) => e.message).join(', ') || res.statusText;
      throw new Error(`Cloudflare TXT record creation failed: ${msg}`);
    }

    return data.result.id;
  }

  public async removeRecord(domain: string, key: string, value: string): Promise<void> {
    try {
      const zoneId = await this.getZoneId(domain);
      const recordName = `_acme-challenge.${domain.replace(/^\*\./, '')}`;

      // Find record id
      const listUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=TXT&name=${recordName}&content=${encodeURIComponent(value)}`;
      const listRes = await fetch(listUrl, { headers: this.getHeaders() });
      if (listRes.ok) {
        const listData = await listRes.json() as any;
        if (listData.result && listData.result.length > 0) {
          for (const rec of listData.result) {
            const delUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${rec.id}`;
            await fetch(delUrl, { method: 'DELETE', headers: this.getHeaders() });
          }
        }
      }
    } catch (err) {
      console.warn('Cloudflare remove record warning:', err);
    }
  }
}
