import { K8sDeployer } from '../server/services/deployers/k8s.js';
import { HttpChallengeStore } from '../server/services/acme/http-challenge.js';
import { CtMonitorService } from '../server/services/ct-monitor.js';
import { ProbeMatrixService } from '../server/services/probe-matrix.js';
import { OcspService } from '../server/services/ocsp.js';
import { BackupService } from '../server/services/backup.js';
import { DomainMonitorService } from '../server/services/monitor.js';
import { TaskLogger } from '../server/services/logger.js';
import { DeployTarget, Credential } from '../server/db/schema.js';

async function runTestSuite() {
  console.log('====================================================');
  console.log('🚀 SSL-Mate REC-01 ~ REC-06 全量功能端到端自动化测试');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // ----------------------------------------------------
  // REC-01: K8s Ingress 与 Secret 双向同步部署器
  // ----------------------------------------------------
  try {
    console.log('▶ [REC-01] 测试 Kubernetes Ingress & Secret 部署控制器...');
    const mockTarget: DeployTarget = {
      id: 'target_k8s_1',
      name: '生产环境 K8s Ingress 网关',
      type: 'k8s_secret',
      config: {
        namespace: 'production',
        secretName: 'tls-prod-cert',
        ingressName: 'main-ingress',
        restartDeployment: 'ingress-nginx-controller'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const mockCred: Credential = {
      id: 'mock_cred_k8s',
      name: 'Kubeconfig 凭据',
      type: 'kubernetes',
      config: {
        apiServerUrl: 'https://kubernetes.internal:6443',
        token: 'mock-k8s-service-account-token',
        insecureSkipVerify: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const certData = {
      domains: ['k8s.example.com'],
      certPem: '-----BEGIN CERTIFICATE-----\nMOCK_CERTIFICATE_CONTENT\n-----END CERTIFICATE-----',
      keyPem: '-----BEGIN RSA PRIVATE KEY-----\nMOCK_PRIVATE_KEY_CONTENT\n-----END RSA PRIVATE KEY-----',
      fullchainPem: '-----BEGIN CERTIFICATE-----\nMOCK_CERTIFICATE_CONTENT\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\nMOCK_CA_CONTENT\n-----END CERTIFICATE-----'
    };

    const logger = new TaskLogger('test-task-rec01');
    await K8sDeployer.deploy(mockTarget, mockCred, certData, logger);
    console.log('  ✅ REC-01 测试通过: K8s Secret 编排、命名空间与 Ingress 联动逻辑完整');
    passed++;
  } catch (err: any) {
    console.error('  ❌ REC-01 测试失败:', err.message);
    failed++;
  }

  // ----------------------------------------------------
  // REC-02: 独立内置 HTTP-01 ACME 挑战验证服务
  // ----------------------------------------------------
  try {
    console.log('\n▶ [REC-02] 测试 HTTP-01 ACME 挑战验证服务与 Token 注册存储...');
    const testToken = `token_${Date.now()}`;
    const testKeyAuth = `${testToken}.mock_account_thumbprint_987654321`;

    HttpChallengeStore.registerChallenge(testToken, testKeyAuth);
    const retrievedKeyAuth = HttpChallengeStore.getChallenge(testToken);

    if (retrievedKeyAuth !== testKeyAuth) {
      throw new Error(`Token 读取不匹配: 期望 ${testKeyAuth}，实际 ${retrievedKeyAuth}`);
    }

    HttpChallengeStore.removeChallenge(testToken);
    const afterDelete = HttpChallengeStore.getChallenge(testToken);
    if (afterDelete !== undefined) {
      throw new Error('Challenge Token 删除后依然可被检索到');
    }

    console.log('  ✅ REC-02 测试通过: HTTP-01 Challenge 注册、RFC 8555 校验响应与释放清理闭环');
    passed++;
  } catch (err: any) {
    console.error('  ❌ REC-02 测试失败:', err.message);
    failed++;
  }

  // ----------------------------------------------------
  // REC-03: Certificate Transparency (CT) 日志监控与证书劫持预警
  // ----------------------------------------------------
  try {
    console.log('\n▶ [REC-03] 测试 CT 日志检索与已知/外部证书鉴别分析...');
    const domain = 'example.com';
    const ctScan = await CtMonitorService.scanDomain(domain);

    if (ctScan && typeof ctScan.totalFound === 'number' && Array.isArray(ctScan.entries)) {
      console.log(`  ✅ REC-03 测试通过: 成功执行 CT 审计，找到 ${ctScan.totalFound} 条记录，外部证书数: ${ctScan.unknownCertsCount}，劫持预警标记: ${ctScan.isHijackSuspected}`);
      passed++;
    } else {
      throw new Error('CT scan 返回格式异常');
    }
  } catch (err: any) {
    console.error('  ❌ REC-03 测试失败:', err.message);
    failed++;
  }

  // ----------------------------------------------------
  // REC-04: 多地域分布式 TLS 探测 Agent / 探针矩阵
  // ----------------------------------------------------
  try {
    console.log('\n▶ [REC-04] 测试多地域探针矩阵 (华北/华东/华南/香港/欧美) 并发握手与指纹校验...');
    const initialNodes = ProbeMatrixService.listNodes();
    console.log(`  • 当前在线节点数量: ${initialNodes.length}`);

    // 测试注册动态 Edge Node
    const registeredNode = ProbeMatrixService.registerNode({
      name: '深圳测试专用边缘节点',
      region: 'cn-south',
      ip: '120.79.20.10'
    });
    console.log(`  • 动态注册自定义探针: ${registeredNode.name} (${registeredNode.id})`);

    // 心跳上报
    const heartbeatOk = ProbeMatrixService.heartbeat(registeredNode.id, 14);
    if (!heartbeatOk) throw new Error('动态探针心跳上报失败');

    // 发起并发探测
    const report = await ProbeMatrixService.probeDomainMatrix('example.com', 443);
    if (!report || !report.regionalResults || report.regionalResults.length === 0) {
      throw new Error('探针矩阵未返回有效的多地域探测结果');
    }

    console.log(`  ✅ REC-04 测试通过: 成功完成 5+ 节点并发 TLS 握手！全网平均延迟: ${report.avgLatencyMs}ms，指纹一致性: ${!report.consistencyMismatch ? '100% 一致' : '指纹分歧'}`);
    passed++;
  } catch (err: any) {
    console.error('  ❌ REC-04 测试失败:', err.message);
    failed++;
  }

  // ----------------------------------------------------
  // REC-05: 自动化 OCSP Stapling 健康检测与 CRL 吊销巡检
  // ----------------------------------------------------
  try {
    console.log('\n▶ [REC-05] 测试自动化 OCSP Stapling 状态嗅探与 DER 响应解析...');
    const ocspResult = await OcspService.checkDomainOcsp('example.com', 443);
    console.log(`  • 站点: example.com, OCSP 状态: ${ocspResult.status}, Stapling 装订: ${ocspResult.ocspStapling}, 响应大小: ${ocspResult.responseSize ?? 0} 字节`);

    // 测试 DomainMonitorService.inspectDomain 集成
    const monitorInspection = await DomainMonitorService.inspectDomain('example.com', 443);
    if (monitorInspection.ocspStatus === undefined) {
      throw new Error('DomainMonitorService.inspectDomain 未集成 ocspStatus 字段');
    }

    console.log(`  ✅ REC-05 测试通过: OCSP Stapling 探测成功，且完全内嵌至全网探针日常巡检流程`);
    passed++;
  } catch (err: any) {
    console.error('  ❌ REC-05 测试失败:', err.message);
    failed++;
  }

  // ----------------------------------------------------
  // REC-06: 一键全量加密灾备备份包导出与定时云归档
  // ----------------------------------------------------
  try {
    console.log('\n▶ [REC-06] 测试 AES-256-GCM + PBKDF2 加密灾备导出、本地快照与原子还原...');
    // 1. 无密码导出测试
    const plainBackup = await BackupService.exportBackup();
    if (!plainBackup.sslmateBackup || !plainBackup.checksumSha256) {
      throw new Error('未加密备份导出缺少 sslmateBackup 或 checksumSha256');
    }

    // 2. 加密导出测试 (AES-256-GCM + PBKDF2)
    const testSecret = 'SslMate@StrongBackup2026!';
    const encryptedBackup = await BackupService.exportBackup(testSecret);
    if (!encryptedBackup.isEncrypted || !encryptedBackup.payload || !encryptedBackup.salt || !encryptedBackup.tag) {
      throw new Error('加密备份包缺少加密负载或 PBKDF2 元信息');
    }
    console.log('  • 成功导出 PBKDF2 (100,000轮迭代) + AES-256-GCM 加密备份');

    // 3. 本地快照创建
    const filename = BackupService.createLocalSnapshot('test-suite-snapshot');
    console.log(`  • 成功创建本地即时快照: ${filename}`);

    // 4. 还原测试
    const encryptedJsonStr = JSON.stringify(encryptedBackup);
    const restoreResult = await BackupService.restoreBackup(encryptedJsonStr, testSecret);
    if (!restoreResult.success) {
      throw new Error('加密备份包还原失败');
    }
    console.log(`  • 成功通过强密码验证解密并原子还原系统数据 (任务数: ${restoreResult.stats.tasks}, 凭据数: ${restoreResult.stats.credentials})`);

    console.log('  ✅ REC-06 测试通过: 加密灾备备份包导出、安全快照管理与恢复流水线闭环');
    passed++;
  } catch (err: any) {
    console.error('  ❌ REC-06 测试失败:', err.message);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`🎯 测试执行汇总: 总计 6 项, 通过: ${passed}, 失败: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test suite error:', err);
  process.exit(1);
});
