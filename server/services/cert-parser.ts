import crypto from 'crypto';
import forge from 'node-forge';

export interface ParsedCertInfo {
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  isExpired: boolean;
  sanDomains: string[];
  signatureAlgorithm: string;
  keyType: string;
  fingerprintSha256: string;
}

export class CertParserService {
  /**
   * Parse X.509 PEM certificate string
   */
  public static parsePem(certPem: string): ParsedCertInfo {
    try {
      const x509 = new crypto.X509Certificate(certPem);
      const now = new Date().getTime();
      const validTo = new Date(x509.validTo).getTime();
      const diffMs = validTo - now;
      const daysRemaining = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      // Extract SANs
      let sanDomains: string[] = [];
      if (x509.subjectAltName) {
        sanDomains = x509.subjectAltName
          .split(',')
          .map(s => s.trim())
          .filter(s => s.startsWith('DNS:'))
          .map(s => s.replace(/^DNS:/, ''));
      }

      return {
        subject: x509.subject,
        issuer: x509.issuer,
        serialNumber: x509.serialNumber,
        validFrom: new Date(x509.validFrom).toISOString(),
        validTo: new Date(x509.validTo).toISOString(),
        daysRemaining,
        isExpired: diffMs <= 0,
        sanDomains,
        signatureAlgorithm: (x509 as any).signatureAlgorithm || 'sha256WithRSAEncryption',
        keyType: x509.publicKey.asymmetricKeyType || 'rsa',
        fingerprintSha256: x509.fingerprint256.replace(/:/g, '').toLowerCase()
      };
    } catch (err: any) {
      throw new Error(`证书解析失败: ${err.message}`);
    }
  }

  /**
   * Generate PFX / PKCS#12 bundle (.pfx / .p12)
   */
  public static exportPfx(fullchainPem: string, privkeyPem: string, password: string = ''): Buffer {
    try {
      const certForge = forge.pki.certificateFromPem(fullchainPem);
      const keyForge = forge.pki.privateKeyFromPem(privkeyPem);

      const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keyForge, [certForge], password, {
        generateLocalKeyId: true,
        friendlyName: 'SSLMate Certificate'
      });

      const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
      return Buffer.from(p12Der, 'binary');
    } catch (err: any) {
      throw new Error(`PFX 生成失败: ${err.message}`);
    }
  }

  /**
   * Format Apache bundle (cert.pem, chain.pem, privkey.pem)
   */
  public static exportApache(fullchainPem: string, privkeyPem: string) {
    const certs = fullchainPem.split(/(?=-----BEGIN CERTIFICATE-----)/g).map(c => c.trim()).filter(Boolean);
    const certPem = certs[0] || '';
    const chainPem = certs.slice(1).join('\n') || '';

    return {
      certPem,
      chainPem,
      privkeyPem
    };
  }
}
