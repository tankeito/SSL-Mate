import { Router, Response } from 'express';
import { db } from '../db/database.js';
import { requireAuth, AuthenticatedRequest } from '../services/auth.js';
import { decrypt } from '../services/crypto.js';
import { CertParserService } from '../services/cert-parser.js';

const router = Router();

router.use(requireAuth);

/**
 * List all certificates
 */
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const certs = db.getCertificates();
  const now = Date.now();

  const formatted = certs.map(c => {
    const expiresMs = new Date(c.expiresAt).getTime();
    const daysLeft = Math.floor((expiresMs - now) / (1000 * 60 * 60 * 24));

    return {
      id: c.id,
      taskId: c.taskId,
      primaryDomain: c.primaryDomain,
      sanDomains: c.sanDomains,
      issuer: c.issuer,
      serialNumber: c.serialNumber,
      keyType: c.keyType,
      issuedAt: c.issuedAt,
      expiresAt: c.expiresAt,
      daysLeft: Math.max(0, daysLeft),
      isExpired: daysLeft <= 0,
      fingerprintSha256: c.fingerprintSha256,
      createdAt: c.createdAt
    };
  });

  return res.json(formatted);
});

/**
 * Get Certificate Full Details (including PEM strings)
 */
router.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  const cert = db.findCertificateById(String(req.params.id));
  if (!cert) {
    return res.status(404).json({ error: '证书不存在' });
  }

  const privkey = decrypt(cert.privkeyPem);

  return res.json({
    ...cert,
    privkeyPem: privkey
  });
});

/**
 * Download Certificate in specified format
 * Formats: nginx, apache, pfx, pem, key, fullchain, json
 */
router.get('/:id/download/:format', (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const format = String(req.params.format);
  const cert = db.findCertificateById(id);
  if (!cert) {
    return res.status(404).json({ error: '证书不存在' });
  }

  const privkey = decrypt(cert.privkeyPem);
  const domainSlug = cert.primaryDomain.replace(/\*/g, 'wildcard').replace(/\./g, '_');

  switch (format) {
    case 'pem':
    case 'cert':
      res.setHeader('Content-Type', 'application/x-pem-file');
      res.setHeader('Content-Disposition', `attachment; filename="${domainSlug}_cert.pem"`);
      return res.send(cert.certPem);

    case 'key':
    case 'privkey':
      res.setHeader('Content-Type', 'application/x-pem-file');
      res.setHeader('Content-Disposition', `attachment; filename="${domainSlug}_privkey.pem"`);
      return res.send(privkey);

    case 'fullchain':
      res.setHeader('Content-Type', 'application/x-pem-file');
      res.setHeader('Content-Disposition', `attachment; filename="${domainSlug}_fullchain.pem"`);
      return res.send(cert.fullchainPem);

    case 'pfx':
    case 'p12': {
      const password = (req.query.password as string) || '';
      try {
        const pfxBuffer = CertParserService.exportPfx(cert.fullchainPem, privkey, password);
        res.setHeader('Content-Type', 'application/x-pkcs12');
        res.setHeader('Content-Disposition', `attachment; filename="${domainSlug}.pfx"`);
        return res.send(pfxBuffer);
      } catch (err: any) {
        return res.status(500).json({ error: `导出 PFX 格式失败: ${err.message}` });
      }
    }

    case 'json':
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${domainSlug}_ssl_bundle.json"`);
      return res.json({
        primary_domain: cert.primaryDomain,
        san_domains: cert.sanDomains,
        issuer: cert.issuer,
        serial_number: cert.serialNumber,
        issued_at: cert.issuedAt,
        expires_at: cert.expiresAt,
        certificate: cert.certPem,
        private_key: privkey,
        fullchain: cert.fullchainPem
      });

    default:
      return res.status(400).json({ error: `不支持的导出格式: ${format}` });
  }
});

/**
 * Online X.509 Certificate Inspector
 */
router.post('/inspect', (req: AuthenticatedRequest, res: Response) => {
  const { certPem } = req.body;
  if (!certPem) {
    return res.status(400).json({ error: '请提供待解析的证书 PEM 文本' });
  }

  try {
    const info = CertParserService.parsePem(certPem);
    return res.json(info);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * Delete Certificate
 */
router.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteCertificate(String(req.params.id));
  if (!success) {
    return res.status(404).json({ error: '证书不存在' });
  }
  return res.json({ success: true, message: '证书记录已删除' });
});

export default router;
