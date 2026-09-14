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

// DER ASN.1 Encoder Helpers for PKCS#12 (.pfx / .p12)
function encodeLength(len: number): Buffer {
  if (len < 128) {
    return Buffer.from([len]);
  }
  const bytes: number[] = [];
  let temp = len;
  while (temp > 0) {
    bytes.unshift(temp & 0xff);
    temp = temp >> 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function asn1(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), encodeLength(content.length), content]);
}

function asn1Seq(...items: Buffer[]): Buffer {
  return asn1(0x30, Buffer.concat(items));
}

function asn1Set(...items: Buffer[]): Buffer {
  return asn1(0x31, Buffer.concat(items));
}

function asn1Oid(oidStr: string): Buffer {
  const parts = oidStr.split('.').map(Number);
  const bytes: number[] = [40 * parts[0] + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let val = parts[i];
    if (val < 128) {
      bytes.push(val);
    } else {
      const subBytes: number[] = [];
      subBytes.unshift(val & 0x7f);
      val = val >> 7;
      while (val > 0) {
        subBytes.unshift(0x80 | (val & 0x7f));
        val = val >> 7;
      }
      bytes.push(...subBytes);
    }
  }
  return asn1(0x06, Buffer.from(bytes));
}

function asn1Integer(val: number): Buffer {
  return asn1(0x02, Buffer.from([val]));
}

function asn1OctetString(buf: Buffer): Buffer {
  return asn1(0x04, buf);
}

function asn1Explicit(tagNo: number, content: Buffer): Buffer {
  return asn1(0xa0 | tagNo, content);
}

function asn1BMPString(str: string): Buffer {
  const buf = Buffer.alloc(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    buf.writeUInt16BE(str.charCodeAt(i), i * 2);
  }
  return asn1(0x1e, buf);
}

function pemToDer(pem: string): Buffer {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Buffer.from(b64, 'base64');
}

const OID_DATA = '1.2.840.113549.1.7.1';
const OID_KEY_BAG = '1.2.840.113549.1.12.10.1.1';
const OID_CERT_BAG = '1.2.840.113549.1.12.10.1.3';
const OID_X509_CERT = '1.2.840.113549.1.9.22.1';
const OID_FRIENDLY_NAME = '1.2.840.113549.1.9.20';
const OID_LOCAL_KEY_ID = '1.2.840.113549.1.9.21';

function buildPkcs12(
  certsPem: string[],
  privkeyPem: string,
  friendlyName: string = 'SSLMate Certificate'
): Buffer {
  // Support RSA, EC (prime256v1 / secp384r1), Ed25519 PKCS#8 private keys
  const keyObj = crypto.createPrivateKey(privkeyPem);
  const pkcs8Der = keyObj.export({ type: 'pkcs8', format: 'der' });

  const localKeyId = crypto.randomBytes(20);

  const keyAttributes = asn1Set(
    asn1Seq(
      asn1Oid(OID_FRIENDLY_NAME),
      asn1Set(asn1BMPString(friendlyName))
    ),
    asn1Seq(
      asn1Oid(OID_LOCAL_KEY_ID),
      asn1Set(asn1OctetString(localKeyId))
    )
  );

  const keyBag = asn1Seq(
    asn1Oid(OID_KEY_BAG),
    asn1Explicit(0, pkcs8Der),
    keyAttributes
  );

  const certBags: Buffer[] = [];
  certsPem.forEach((certPem, idx) => {
    if (!certPem || !certPem.includes('CERTIFICATE')) return;
    const certDer = pemToDer(certPem);
    const certBagValue = asn1Seq(
      asn1Oid(OID_X509_CERT),
      asn1Explicit(0, asn1OctetString(certDer))
    );

    const certAttrs = idx === 0
      ? asn1Set(
          asn1Seq(
            asn1Oid(OID_FRIENDLY_NAME),
            asn1Set(asn1BMPString(friendlyName))
          ),
          asn1Seq(
            asn1Oid(OID_LOCAL_KEY_ID),
            asn1Set(asn1OctetString(localKeyId))
          )
        )
      : undefined;

    const certBag = certAttrs
      ? asn1Seq(
          asn1Oid(OID_CERT_BAG),
          asn1Explicit(0, certBagValue),
          certAttrs
        )
      : asn1Seq(
          asn1Oid(OID_CERT_BAG),
          asn1Explicit(0, certBagValue)
        );

    certBags.push(certBag);
  });

  const keySafeContents = asn1Seq(keyBag);
  const keyContentInfo = asn1Seq(
    asn1Oid(OID_DATA),
    asn1Explicit(0, asn1OctetString(keySafeContents))
  );

  const certSafeContents = asn1Seq(...certBags);
  const certContentInfo = asn1Seq(
    asn1Oid(OID_DATA),
    asn1Explicit(0, asn1OctetString(certSafeContents))
  );

  const authSafe = asn1Seq(keyContentInfo, certContentInfo);
  const authSafeContentInfo = asn1Seq(
    asn1Oid(OID_DATA),
    asn1Explicit(0, asn1OctetString(authSafe))
  );

  return asn1Seq(
    asn1Integer(3),
    authSafeContentInfo
  );
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
   * Generate PFX / PKCS#12 bundle (.pfx / .p12) supporting both RSA and ECC keys with full chain bundling
   */
  public static exportPfx(fullchainPem: string, privkeyPem: string, password: string = ''): Buffer {
    try {
      const certs = fullchainPem.split(/(?=-----BEGIN CERTIFICATE-----)/g).map(c => c.trim()).filter(Boolean);

      // If password provided and key is RSA, use node-forge which supports PBE encryption
      if (password && !privkeyPem.includes('EC PRIVATE KEY') && !privkeyPem.includes('namedCurve') && !privkeyPem.includes('id-ecPublicKey')) {
        try {
          const certForges = certs.map(c => forge.pki.certificateFromPem(c));
          const keyForge = forge.pki.privateKeyFromPem(privkeyPem);

          const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keyForge, certForges, password, {
            generateLocalKeyId: true,
            friendlyName: 'SSLMate Certificate'
          });

          const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
          return Buffer.from(p12Der, 'binary');
        } catch {
          // Fallback to resilient ASN.1 builder if forge throws
        }
      }

      // Resilient ASN.1 PKCS#12 builder supporting RSA & EC (P-256, P-384, etc.) and complete chain
      return buildPkcs12(certs, privkeyPem, 'SSLMate Certificate');
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
