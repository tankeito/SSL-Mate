import crypto from 'crypto';

export interface AliyunConfig {
  accessKeyId: string;
  accessKeySecret: string;
}

export class AliyunDnsSolver {
  private config: AliyunConfig;

  constructor(config: AliyunConfig) {
    this.config = config;
  }

  private percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/\+/g, '%20')
      .replace(/\*/g, '%2A')
      .replace(/%7E/g, '~');
  }

  private async request(action: string, params: Record<string, string>): Promise<any> {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = crypto.randomBytes(16).toString('hex');

    const publicParams: Record<string, string> = {
      Format: 'JSON',
      Version: '2015-01-09',
      AccessKeyId: this.config.accessKeyId.trim(),
      SignatureMethod: 'HMAC-SHA1',
      Timestamp: timestamp,
      SignatureVersion: '1.0',
      SignatureNonce: nonce,
      Action: action,
      ...params
    };

    const sortedKeys = Object.keys(publicParams).sort();
    const canonicalizedQueryString = sortedKeys
      .map(key => `${this.percentEncode(key)}=${this.percentEncode(publicParams[key])}`)
      .join('&');

    const stringToSign = `GET&${this.percentEncode('/')}&${this.percentEncode(canonicalizedQueryString)}`;
    const signKey = `${this.config.accessKeySecret.trim()}&`;
    const signature = crypto.createHmac('sha1', signKey).update(stringToSign).digest('base64');

    const url = `https://alidns.aliyuncs.com/?${canonicalizedQueryString}&Signature=${this.percentEncode(signature)}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json() as any;

    if (!res.ok || data.Code) {
      throw new Error(`Aliyun DNS API Error [${data.Code || res.status}]: ${data.Message || res.statusText}`);
    }

    return data;
  }

  private parseDomain(fullDomain: string) {
    const clean = fullDomain.replace(/^\*\./, '');
    const parts = clean.split('.');
    if (parts.length < 2) {
      return { mainDomain: clean, rr: '_acme-challenge' };
    }
    // Simplistic TLD extraction
    const mainDomain = parts.slice(-2).join('.');
    const sub = parts.slice(0, -2).join('.');
    const rr = sub ? `_acme-challenge.${sub}` : '_acme-challenge';
    return { mainDomain, rr };
  }

  public async setRecord(domain: string, key: string, value: string): Promise<string> {
    const { mainDomain, rr } = this.parseDomain(domain);
    const data = await this.request('AddDomainRecord', {
      DomainName: mainDomain,
      RR: rr,
      Type: 'TXT',
      Value: value,
      TTL: '600'
    });

    return data.RecordId;
  }

  public async removeRecord(domain: string, key: string, value: string): Promise<void> {
    try {
      const { mainDomain, rr } = this.parseDomain(domain);
      const data = await this.request('DescribeSubDomainRecords', {
        SubDomain: `${rr}.${mainDomain}`,
        Type: 'TXT'
      });

      if (data.DomainRecords && data.DomainRecords.Record) {
        for (const rec of data.DomainRecords.Record) {
          if (rec.Value === value) {
            await this.request('DeleteDomainRecord', { RecordId: rec.RecordId });
          }
        }
      }
    } catch (err) {
      console.warn('Aliyun DNS remove record warning:', err);
    }
  }
}
