import tls from 'tls';
import crypto from 'crypto';

export interface OcspCheckResult {
  ocspStapling: boolean;
  status: 'good' | 'revoked' | 'unknown' | 'no_stapling';
  responseSize?: number;
  revocationReason?: string;
  revocationTime?: string;
  checkedAt: string;
}

export class OcspService {
  /**
   * Parse status from raw ASN.1 DER OCSP response buffer
   */
  public static parseOcspResponse(buffer: Buffer): { status: 'good' | 'revoked' | 'unknown'; reason?: string } {
    if (!buffer || buffer.length < 4) {
      return { status: 'unknown' };
    }

    try {
      // Find the responseStatus (ENUMERATED tag 0x0A)
      let offset = 0;
      if (buffer[offset] === 0x30) { // SEQUENCE
        offset += 2; // skip sequence header
      }

      // Check responseStatus: tag 0x0A, length 0x01
      for (let i = 0; i < Math.min(30, buffer.length - 2); i++) {
        if (buffer[i] === 0x0a && buffer[i + 1] === 0x01) {
          const respStatus = buffer[i + 2];
          if (respStatus !== 0) {
            return { status: 'unknown', reason: `CA 返回异常状态代码: ${respStatus}` };
          }
          break;
        }
      }

      // In BasicOCSPResponse, certStatus is tagged context-specific:
      // [0] IMPLICIT NULL = good (tag 0x80)
      // [1] IMPLICIT RevokedInfo = revoked (tag 0xA1 or 0x81)
      // [2] IMPLICIT UnknownInfo = unknown (tag 0x82)
      for (let i = 0; i < buffer.length - 2; i++) {
        if (buffer[i] === 0x80 && buffer[i + 1] === 0x00) {
          return { status: 'good' };
        }
        if (buffer[i] === 0xa1 || buffer[i] === 0x81) {
          return { status: 'revoked', reason: '证书已被 CA 机构正式吊销' };
        }
      }

      // Default to good if response was successful
      return { status: 'good' };
    } catch {
      return { status: 'unknown' };
    }
  }

  /**
   * Check whether target domain supports OCSP Stapling and determine its live revocation status
   */
  public static async checkDomainOcsp(domain: string, port: number = 443): Promise<OcspCheckResult> {
    const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].trim();

    return new Promise<OcspCheckResult>((resolve) => {
      let ocspResponseBuffer: Buffer | null = null;
      let resolved = false;

      const finish = (result: OcspCheckResult) => {
        if (!resolved) {
          resolved = true;
          resolve(result);
        }
      };

      const timer = setTimeout(() => {
        finish({
          ocspStapling: false,
          status: 'no_stapling',
          checkedAt: new Date().toISOString()
        });
      }, 7000);

      try {
        const socket = tls.connect({
          host: cleanDomain,
          port,
          servername: cleanDomain,
          rejectUnauthorized: false,
          requestOCSP: true,
          timeout: 6000
        }, () => {
          setTimeout(() => {
            try { socket.end(); } catch {}

            if (ocspResponseBuffer && ocspResponseBuffer.length > 0) {
              const parsed = this.parseOcspResponse(ocspResponseBuffer);
              clearTimeout(timer);
              finish({
                ocspStapling: true,
                status: parsed.status,
                responseSize: ocspResponseBuffer.length,
                revocationReason: parsed.reason,
                checkedAt: new Date().toISOString()
              });
            } else {
              clearTimeout(timer);
              finish({
                ocspStapling: false,
                status: 'no_stapling',
                checkedAt: new Date().toISOString()
              });
            }
          }, 300);
        });

        socket.on('OCSPResponse', (response) => {
          if (response && Buffer.isBuffer(response)) {
            ocspResponseBuffer = response;
          }
        });

        socket.on('error', () => {
          clearTimeout(timer);
          finish({
            ocspStapling: false,
            status: 'no_stapling',
            checkedAt: new Date().toISOString()
          });
        });

        socket.on('timeout', () => {
          try { socket.destroy(); } catch {}
          clearTimeout(timer);
          finish({
            ocspStapling: false,
            status: 'no_stapling',
            checkedAt: new Date().toISOString()
          });
        });
      } catch {
        clearTimeout(timer);
        finish({
          ocspStapling: false,
          status: 'no_stapling',
          checkedAt: new Date().toISOString()
        });
      }
    });
  }
}
