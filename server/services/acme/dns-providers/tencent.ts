import crypto from 'crypto';

export interface TencentConfig {
  secretId: string;
  secretKey: string;
}

export class TencentDnsSolver {
  private config: TencentConfig;

  constructor(config: TencentConfig) {
    this.config = config;
  }

  private sha256Hex(s: string): string {
    return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
  }

  private hmacSha256(key: Buffer | string, s: string): Buffer {
    return crypto.createHmac('sha256', key).update(s, 'utf8').digest();
  }

  private async request(action: string, payload: Record<string, any>): Promise<any> {
    const service = 'dnspod';
    const host = 'dnspod.tencentcloudapi.com';
    const version = '2021-03-23';
    const endpoint = `https://${host}`;

    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

    const httpRequestMethod = 'POST';
    const canonicalUri = '/';
    const canonicalQueryString = '';
    const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
    const signedHeaders = 'content-type;host;x-tc-action';
    const hashedRequestPayload = this.sha256Hex(JSON.stringify(payload));

    const canonicalRequest = `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${hashedRequestPayload}`;

    const algorithm = 'TC3-HMAC-SHA256';
    const credentialScope = `${date}/${service}/tc3_request`;
    const hashedCanonicalRequest = this.sha256Hex(canonicalRequest);
    const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

    const secretDate = this.hmacSha256(`TC3${this.config.secretKey.trim()}`, date);
    const secretService = this.hmacSha256(secretDate, service);
    const secretSigning = this.hmacSha256(secretService, 'tc3_request');
    const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign, 'utf8').digest('hex');

    const authorization = `${algorithm} Credential=${this.config.secretId.trim()}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Host': host,
        'X-TC-Action': action,
        'X-TC-Timestamp': timestamp.toString(),
        'X-TC-Version': version,
        'Authorization': authorization
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    });

    const data = await res.json() as any;
    if (data.Response && data.Response.Error) {
      throw new Error(`Tencent DNS API Error: [${data.Response.Error.Code}] ${data.Response.Error.Message}`);
    }

    return data.Response;
  }

  private parseDomain(fullDomain: string) {
    const clean = fullDomain.replace(/^\*\./, '');
    const parts = clean.split('.');
    if (parts.length < 2) {
      return { mainDomain: clean, subDomain: '_acme-challenge' };
    }
    const mainDomain = parts.slice(-2).join('.');
    const sub = parts.slice(0, -2).join('.');
    const subDomain = sub ? `_acme-challenge.${sub}` : '_acme-challenge';
    return { mainDomain, subDomain };
  }

  public async setRecord(domain: string, key: string, value: string): Promise<string> {
    const { mainDomain, subDomain } = this.parseDomain(domain);
    const data = await this.request('CreateRecord', {
      Domain: mainDomain,
      SubDomain: subDomain,
      RecordType: 'TXT',
      RecordLine: '默认',
      Value: value,
      TTL: 600
    });

    return data.RecordId ? data.RecordId.toString() : '';
  }

  public async removeRecord(domain: string, key: string, value: string): Promise<void> {
    try {
      const { mainDomain, subDomain } = this.parseDomain(domain);
      const data = await this.request('DescribeRecordList', {
        Domain: mainDomain,
        Subdomain: subDomain,
        RecordType: 'TXT'
      });

      if (data.RecordList && Array.isArray(data.RecordList)) {
        for (const rec of data.RecordList) {
          if (rec.Value === value) {
            await this.request('DeleteRecord', {
              Domain: mainDomain,
              RecordId: rec.RecordId
            });
          }
        }
      }
    } catch (err) {
      console.warn('Tencent DNSPod remove record warning:', err);
    }
  }
}
