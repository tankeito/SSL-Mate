import React, { useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  Lock,
  Globe,
  Cloud,
  Activity,
  Bell,
  CheckCircle2,
  ArrowRight,
  KeyRound,
  Box,
  FileSearch,
  AlertTriangle,
  ChevronDown,
  ShieldAlert,
  X,
  Key
} from 'lucide-react';
import { api } from '../../api/client';

export const LandingView: React.FC = () => {
  const [activePreviewTab, setActivePreviewTab] = useState<'pipeline' | 'probe' | 'ct'>('pipeline');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [entryTokenInput, setEntryTokenInput] = useState('');
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const handleOpenConsole = () => {
    const savedEntryToken = sessionStorage.getItem('yqd_login_entry_token');
    if (savedEntryToken) {
      window.location.href = `/login?token=${encodeURIComponent(savedEntryToken)}`;
      return;
    }
    setTokenError(null);
    setEntryTokenInput('');
    setTokenModalOpen(true);
  };

  const handleVerifyTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = entryTokenInput.trim();
    if (!trimmed) {
      setTokenError('请输入配置文件中设置的登录安全令牌 (LOGIN_TOKEN)');
      return;
    }
    setVerifyingToken(true);
    setTokenError(null);
    try {
      const res = await api.verifyLoginEntry(trimmed);
      if (res && res.valid) {
        sessionStorage.setItem('yqd_login_entry_token', trimmed);
        window.location.href = `/login?token=${encodeURIComponent(trimmed)}`;
      } else {
        setTokenError('安全入口令牌无效，访问已被安全策略拦截');
      }
    } catch (err: any) {
      setTokenError(err.message || '安全入口令牌校验失败，请确认配置文件中的 LOGIN_TOKEN');
    } finally {
      setVerifyingToken(false);
    }
  };

  const painPoints = [
    {
      painTitle: '90 天免费证书频繁过期焦虑',
      painDesc: '主流免费 SSL 证书有效期仅 90 天（行业正推动缩短至 47 天），依靠日历提醒与人工续签极易因遗忘导致 HTTPS 证书过期、浏览器红字拦截与业务中断。',
      solutionTitle: '到期前 30 天全自动无感续签',
      solutionDesc: '云签盾内置 7×24 小时高精度 Cron 守护进程，在证书剩余 30 天时自动触发 ACME 重签与全链路下发，真正实现“一次配置，终身免维护”。'
    },
    {
      painTitle: '多云、多面板与容器碎片化部署地狱',
      painDesc: '企业架构往往同时包含宝塔面板、宝塔 Docker 容器反代、1Panel、阿里云 CDN/DCDN、Kubernetes 集群与多台 SSH 裸机，每次续签后手动替换 PEM 与私钥耗时费力且易出错。',
      solutionTitle: '一次签发，跨平台多目标并发推送与热重载',
      solutionDesc: '单张泛域名或多域名证书签发后，秒级并发同步至所有绑定的云平台、运维面板、Docker 容器与服务器，并自动执行 Nginx / OpenResty 零停机平滑热重载。'
    },
    {
      painTitle: '传统自动化工具连线流程图繁琐易败',
      painDesc: '部分工具需要绘制复杂的节点连线工作流，且在 DNS TXT 记录尚未全球同步时盲目请求 CA 验证，导致频繁触发 Let\'s Encrypt 速率限制而签发失败。',
      solutionTitle: '声明式 3 步向导 + 全球多源 DoH 权威预检',
      solutionDesc: '首创极简 3 步式任务向导，30 秒完成流水线建模；内置 Google、Cloudflare、阿里、腾讯多源 DNS-over-HTTPS (DoH) 权威广播预检，确认全球生效后再通知 CA 核验。'
    },
    {
      painTitle: '散落证书缺乏主动监控与幽灵签发审计',
      painDesc: '线上数十个子域名证书分散在不同供应商，无法直观掌握各站点 TLS 握手健康度、OCSP 装订状态，也难以察觉外部未授权签发的仿冒证书。',
      solutionTitle: '全网 TLS 探针矩阵 + CT 证书透明度审计',
      solutionDesc: '提供全球多节点分布式 TLS 探针矩阵，实时检测线上端口证书链与过期时间；结合公共 CT 日志扫描，自动甄别非本平台签发的异常证书并即时告警。'
    }
  ];

  const features = [
    {
      icon: ShieldCheck,
      badge: 'RFC 8555 标准',
      title: '多 CA 机构自动化签发引擎',
      desc: '原生支持 Let\'s Encrypt、ZeroSSL、Google Trust Services 及自定义 EAB 企业级 CA。全面支持单域名、多域名 (SAN) 与泛域名 (*.example.com) 证书，提供 EC256 (P-256) 与 RSA 2048 高强度密钥算法。'
    },
    {
      icon: Globe,
      badge: '100% 验证成功率',
      title: '智能 DNS-01 验证与全球 DoH 预检',
      desc: '深度集成阿里云 DNS、腾讯云 DNSPod、Cloudflare 及自定义 DNS Webhook。自动写入并清理 _acme-challenge TXT 记录，通过全球权威 DNS 节点轮询预检，彻底杜绝传播延迟导致的校验失败。'
    },
    {
      icon: Box,
      badge: '全生态覆盖',
      title: '宝塔面板 / 宝塔 Docker / 1Panel 原生直连',
      desc: '不仅支持宝塔传统 PHP/静态站点与 1Panel 网站一键部署，更针对宝塔 Docker 容器应用反代站点提供专属 API 适配，自动同步宝塔证书夹并触发容器反代 Nginx 热重载。'
    },
    {
      icon: Cloud,
      badge: '多云与云原生',
      title: 'CDN / K8s Secret / SSH 远程主机同步',
      desc: '无缝对接阿里云 CDN 与全站加速 DCDN、腾讯云 CDN、Cloudflare Custom SSL、Kubernetes TLS Secret 跨命名空间注入，以及通过 SFTP 推送至任意 SSH Linux 主机并执行自定义重载指令。'
    },
    {
      icon: Activity,
      badge: '7×24h 主动监测',
      title: '全网域名 TLS 探针与多区握手矩阵',
      desc: '无需将证书托管在本平台即可对任意公网 HTTPS 域名与自定义端口发起 7×24h 巡检。全面剖析证书链完整性、SHA-256 指纹、TLS 1.2/1.3 协议、OCSP 装订状态与跨区域握手耗时。'
    },
    {
      icon: FileSearch,
      badge: '防伪与合规',
      title: 'CT 证书透明度日志防伪监控',
      desc: '自动检索全球公共 Certificate Transparency (CT) 日志库，智能交叉比对云签盾本地资产库序列号，一旦发现您的域名存在未知渠道签发的证书，立即高亮标记并触发安全预警。'
    },
    {
      icon: Bell,
      badge: '毫秒级触达',
      title: '全渠道智能告警与事件通知',
      desc: '内置企业级告警引擎，支持 SMTP 邮件、钉钉群机器人、飞书群机器人、企业微信、Telegram Bot 及通用 Webhook。证书签发成功、部署异常或探针即将到期均能第一时间推送到人。'
    },
    {
      icon: Lock,
      badge: '零信任架构',
      title: 'AES-256-GCM 密文存储与安全入口防护',
      desc: '所有云厂商 AccessKey、面板密钥、SSH 私钥与证书私钥均采用 AES-256-GCM 硬件级加密存储；支持登录安全入口 Token 拦截、OIDC + PKCE 单点登录、TOTP 2FA 双因素认证与一键加密灾备快照。'
    }
  ];

  const deployTargetsList = [
    { name: '宝塔 Linux 面板站点', tag: '面板直连', desc: '自动上传至宝塔证书夹并绑定站点 HTTPS，支持泛域名多站批量部署' },
    { name: '宝塔 Docker 网站/容器', tag: '容器反代', desc: '专为宝塔 Docker 应用商店与容器反代项目打造，自动更新容器站点 SSL 并热重载' },
    { name: '1Panel 现代化面板', tag: '面板直连', desc: '通过 1Panel API 自动创建/更新证书并关联至目标网站组' },
    { name: '阿里云 CDN / DCDN', tag: '云厂商', desc: '自动上传证书至阿里云 CAS 证书中心并为指定加速域名开启 HTTPS' },
    { name: '腾讯云 CDN / 边缘安全', tag: '云厂商', desc: '基于腾讯云 API v3 签名协议，全自动更新 CDN 加速域名 SSL 证书' },
    { name: 'Cloudflare Custom SSL', tag: '全球边缘', desc: '通过 Cloudflare Zone API 自动更新边缘节点自定义 SSL/TLS 证书' },
    { name: 'Kubernetes TLS Secret', tag: '云原生', desc: '自动更新指定 Namespace 下的 kubernetes.io/tls Secret 并触发 Ingress 滚动更新' },
    { name: 'SSH 远程 Linux 主机', tag: '通用服务器', desc: '通过 SSH/SFTP 安全上传 fullchain.pem 与 privkey.pem 并执行 nginx -s reload' },
    { name: '本地服务器文件目录', tag: '本机直写', desc: '直接写入宿主机或挂载卷指定目录并触发本地 Web 服务重载命令' },
    { name: '通用 Webhook 回调', tag: '开放集成', desc: '将签发好的全链 PEM 与私钥以标准 JSON + HMAC 签名推送至内部自研系统' }
  ];

  const faqs = [
    {
      q: '云签盾是什么？它主要解决企业和开发者的什么问题？',
      a: '云签盾（YunQianDun）是一套企业级全自动 SSL/TLS 证书生命周期管理与多云部署平台。随着免费 SSL 证书有效期只有 90 天（未来行业标准更将缩短至 47 天），依靠人工申请、下载、上传到多台服务器极易遗漏并引发线上 HTTPS 故障。云签盾通过自动化 ACME 签发、全球 DoH 权威预检、跨平台一键热重载部署以及 7×24 小时域名探针监控，彻底实现 SSL 证书的零人工干预管理。'
    },
    {
      q: '如果我的网站部署在宝塔面板的 Docker 容器里，云签盾可以自动更新证书吗？',
      a: '完全可以！针对宝塔面板中「传统 PHP/静态站点」与「Docker 容器反代网站」底层接口不同的痛点，云签盾专门提供了独立的【宝塔面板】与【宝塔 Docker】两类部署目标。无论您的业务运行在普通 Nginx 站点还是宝塔 Docker 容器应用中，都能一键自动同步证书并平滑热重载 Nginx。'
    },
    {
      q: '云签盾支持申请通配符（泛域名 *.example.com）证书并同时部署到多台不同服务器吗？',
      a: '支持！您只需在新建任务的第 1 步填写 `*.example.com` 和 `example.com`，在第 2 步选择对应的 DNS 解析凭据（如阿里云 DNS、腾讯云 DNSPod 或 Cloudflare），在第 3 步可同时添加多个不同的部署目标（例如：同时推送给 2 台宝塔服务器、1 台 1Panel 主机、1 个阿里云 DCDN 域名和 1 个 K8s 集群）。证书签发后会并发推送至所有节点。'
    },
    {
      q: '为什么直接访问 /login 登录页面会被拦截？如何进入云签盾管理后台？',
      a: '为了防止互联网自动化爬虫与暴力破解工具针对管理后台发起撞库攻击，云签盾内置了「安全登录入口令牌（Login Security Token）」防护机制。直接访问裸 `/login` 路径会被系统安全网关以 403 状态直接拦截；管理员需携带配置文件（`.env` 中的 `LOGIN_TOKEN`）设定的安全令牌访问，或点击本页右上角「控制台安全入口」验证安全令牌后进入登录页。'
    },
    {
      q: '存储在云签盾中的阿里云/腾讯云 AccessKey 和证书私钥安全吗？',
      a: '极度安全。云签盾采用私有化自托管与零信任加密架构，所有敏感凭据（DNS API 密钥、SSH 私钥、面板 Token）以及每一张证书的私钥在写入数据库前，均通过 AES-256-GCM 认证加密算法进行高熵密文封装；同时支持 OIDC + PKCE 统一身份认证、TOTP 双因素认证（2FA）与全量加密灾备归档。'
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-emerald-500/20 selection:text-emerald-700">
      {/* Fixed Top Official Header (Always pinned to top on both Mobile & PC) */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200/90 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo & Name */}
          <a href="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 flex items-center justify-center shadow-md shadow-emerald-500/25 text-white group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-xl font-black tracking-tight text-slate-900">
                  云签盾
                </span>
                <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  v1.2.0 Enterprise
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                全自动 SSL/TLS 证书生命周期管理与多云部署平台
              </p>
            </div>
          </a>

          {/* Navigation Anchor Links (PC) */}
          <nav aria-label="主导航" className="hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-600">
            <a href="#pain-points" className="hover:text-emerald-600 transition-colors">核心解决痛点</a>
            <a href="#features" className="hover:text-emerald-600 transition-colors">功能矩阵</a>
            <a href="#workflow" className="hover:text-emerald-600 transition-colors">3步自动化架构</a>
            <a href="#ecosystem" className="hover:text-emerald-600 transition-colors">多云部署生态</a>
            <a href="#faq" className="hover:text-emerald-600 transition-colors">常见问题</a>
          </nav>

          {/* Right Action: Security Console Entrance */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleOpenConsole}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95"
            >
              <KeyRound className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>控制台安全入口</span>
            </button>
          </div>
        </div>

        {/* Mobile Quick Anchor Sub-nav (Visible on Mobile/Tablet so fixed header works seamlessly) */}
        <nav aria-label="移动端快捷导航" className="lg:hidden border-t border-slate-100 bg-slate-50/90 px-4 py-2 flex items-center justify-around text-xs font-semibold text-slate-600 overflow-x-auto whitespace-nowrap">
          <a href="#pain-points" className="px-2 py-0.5 hover:text-emerald-600">解决痛点</a>
          <a href="#features" className="px-2 py-0.5 hover:text-emerald-600">功能矩阵</a>
          <a href="#workflow" className="px-2 py-0.5 hover:text-emerald-600">3步架构</a>
          <a href="#ecosystem" className="px-2 py-0.5 hover:text-emerald-600">部署生态</a>
          <a href="#faq" className="px-2 py-0.5 hover:text-emerald-600">常见问题</a>
        </nav>
      </header>

      {/* Main Content with Top Padding for Fixed Header */}
      <main className="flex-1 pt-24 lg:pt-16">
        {/* Hero Section (Pure Light Theme) */}
        <section className="relative overflow-hidden pt-10 pb-16 sm:pt-16 sm:pb-24 bg-gradient-to-b from-emerald-50/60 via-white to-slate-50 border-b border-slate-200/80">
          {/* Light Ambient Soft Gradients */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[900px] h-[420px] bg-gradient-to-tr from-emerald-200/40 via-teal-100/40 to-cyan-100/40 rounded-full blur-3xl pointer-events-none"></div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Left Column: Value Proposition & SEO Copy */}
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-2xs">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>RFC 8555 (ACME) 标准引擎 · 告别 90 天证书过期焦虑</span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-[50px] font-black tracking-tight text-slate-900 leading-[1.18]">
                  云签盾 — 企业级全自动
                  <span className="block mt-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
                    SSL 证书生命周期管理平台
                  </span>
                </h1>

                <p className="text-sm sm:text-base lg:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                  集中管控跨云、跨面板与容器集群的 HTTPS 数字证书。全自动完成 <strong className="text-slate-900">DNS-01 权威验证</strong>、<strong className="text-slate-900">多 CA 机构免费申请签发</strong>、<strong className="text-slate-900">到期前 30 天无感续期</strong>，一键推送并热重载部署至<strong className="text-slate-900">宝塔面板、宝塔 Docker、1Panel、阿里云 CDN/DCDN、Kubernetes 及远程 SSH 服务器</strong>。
                </p>

                {/* Key Highlights Pills */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 pt-1 text-xs font-semibold text-slate-700">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 支持泛域名 *.domain.com
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 全球 DoH 权威传播预检
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 7×24h 全网 TLS 域名探针
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> CT 证书透明度防伪审计
                  </span>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-3">
                  <button
                    onClick={handleOpenConsole}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
                  >
                    <ShieldCheck className="w-5 h-5" />
                    <span>进入云签盾控制台</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <a
                    href="#features"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-sm border border-slate-200 shadow-xs transition-all"
                  >
                    <span>探索核心功能与架构</span>
                  </a>
                </div>
              </div>

              {/* Right Column: Interactive Live Pipeline & Probe Simulator Card (Light Theme) */}
              <div className="lg:col-span-5">
                <div className="rounded-3xl bg-white border border-slate-200/90 shadow-xl shadow-slate-200/70 overflow-hidden">
                  {/* Window Top Bar */}
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-rose-400"></span>
                      <span className="w-3 h-3 rounded-full bg-amber-400"></span>
                      <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                      <span className="ml-2 text-xs font-bold text-slate-700">
                        云签盾自动化引擎实时演示
                      </span>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setActivePreviewTab('pipeline')}
                        className={`px-2.5 py-1 rounded-lg transition-colors ${
                          activePreviewTab === 'pipeline'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        自动签发流
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivePreviewTab('probe')}
                        className={`px-2.5 py-1 rounded-lg transition-colors ${
                          activePreviewTab === 'probe'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        TLS 探针
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivePreviewTab('ct')}
                        className={`px-2.5 py-1 rounded-lg transition-colors ${
                          activePreviewTab === 'ct'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        CT 审计
                      </button>
                    </div>
                  </div>

                  {/* Interactive Tab Body (Clean Light Surface) */}
                  <div className="p-5 bg-white">
                    {activePreviewTab === 'pipeline' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                              <span>全自动签发与多端热重载任务</span>
                            </div>
                            <div className="text-sm font-black text-slate-900 mt-0.5 font-mono">
                              *.btc354.com (EC256 · DNS-01)
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            耗时 26.0s · 成功
                          </span>
                        </div>

                        <div className="rounded-2xl bg-slate-50 text-slate-700 p-4 font-mono text-[11px] space-y-2 leading-relaxed border border-slate-200/90">
                          <div className="text-emerald-700 font-semibold">[ACME] 账户就绪 (Let&apos;s Encrypt Production)</div>
                          <div className="text-slate-600">[CSR] 生成 EC256 私钥与证书签名请求成功</div>
                          <div className="text-teal-700 font-semibold">[DNS-01] 自动写入阿里云 DNS TXT 记录: _acme-challenge</div>
                          <div className="text-emerald-700 font-semibold">[PREFLIGHT] ✅ 全球权威 DoH 多源预检通过！</div>
                          <div className="text-emerald-800 font-bold bg-emerald-100/70 px-2 py-0.5 rounded-md">[ISSUING] 🎉 CA 校验通过，SSL 证书已签发并加密归档！</div>
                          <div className="text-teal-700">[DEPLOY] ➔ [宝塔面板站点] 证书同步与 Nginx 热重载成功</div>
                          <div className="text-teal-700">[DEPLOY] ➔ [宝塔 Docker 网站] 容器反代证书绑定与热重载成功</div>
                          <div className="text-teal-700">[DEPLOY] ➔ [阿里云 DCDN] 边缘节点 HTTPS 证书更新完毕</div>
                        </div>

                        <div className="grid grid-cols-3 gap-2.5 text-center">
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                            <div className="text-[10px] text-slate-500">签发机构</div>
                            <div className="text-xs font-bold text-slate-800 mt-0.5">Let&apos;s Encrypt</div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
                            <div className="text-[10px] text-emerald-700">自动续期策略</div>
                            <div className="text-xs font-bold text-emerald-700 mt-0.5">到期前 30 天</div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                            <div className="text-[10px] text-slate-500">私钥存储加密</div>
                            <div className="text-xs font-bold text-slate-800 mt-0.5">AES-256-GCM</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activePreviewTab === 'probe' && (
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">
                            全网公网域名 TLS 探针实时监控
                          </span>
                          <span className="text-[11px] text-emerald-600 font-bold">
                            7×24h 自动巡检中
                          </span>
                        </div>
                        {[
                          { domain: 'ssl.ap1x.xyz:443', issuer: 'Google Trust Services (WE1)', days: 78, tls: 'TLSv1.3', latency: '32ms' },
                          { domain: 'tool.btc354.com:443', issuer: "Let's Encrypt (YR1)", days: 89, tls: 'TLSv1.3', latency: '28ms' },
                          { domain: 'sso.btc354.com:443', issuer: "Let's Encrypt (E5)", days: 71, tls: 'TLSv1.3', latency: '35ms' }
                        ].map((item) => (
                          <div key={item.domain} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                            <div>
                              <div className="text-xs font-bold font-mono text-slate-900 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                {item.domain}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {item.issuer} · {item.tls} · 握手 {item.latency}
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              剩余 {item.days} 天
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {activePreviewTab === 'ct' && (
                      <div className="space-y-3.5">
                        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                          <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>CT (Certificate Transparency) 证书透明度防伪核验</span>
                          </div>
                          <p className="text-[11px] text-emerald-700 mt-1 leading-relaxed">
                            实时同步全球公共 CT 日志，自动比对每一次证书签发记录与云签盾本地资产库序列号，精准识别非授权签发。
                          </p>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                            <div>
                              <div className="font-mono font-bold text-slate-800">tool.btc354.com</div>
                              <div className="text-[10px] text-slate-500 font-mono">SN: 05e212246f5e6e36...</div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ✓ 云签盾受管签发
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                            <div>
                              <div className="font-mono font-bold text-slate-800">*.btc354.com</div>
                              <div className="text-[10px] text-slate-500 font-mono">SN: 04d190a8c2119b4a...</div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ✓ 云签盾受管签发
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Key Metrics Strip */}
            <div className="mt-14 pt-10 border-t border-slate-200/80 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div className="p-4 rounded-2xl bg-white border border-slate-200/70 shadow-2xs">
                <div className="text-2xl sm:text-3xl font-black text-emerald-600">100%</div>
                <div className="text-xs sm:text-sm font-bold text-slate-800 mt-1">全自动无感续签</div>
                <div className="text-[11px] text-slate-500 mt-0.5">到期前 30 天自动触发</div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200/70 shadow-2xs">
                <div className="text-2xl sm:text-3xl font-black text-emerald-600">&lt; 30秒</div>
                <div className="text-xs sm:text-sm font-bold text-slate-800 mt-1">极速签发与多端下发</div>
                <div className="text-[11px] text-slate-500 mt-0.5">声明式 3 步向导配置</div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200/70 shadow-2xs">
                <div className="text-2xl sm:text-3xl font-black text-emerald-600">10+ 生态</div>
                <div className="text-xs sm:text-sm font-bold text-slate-800 mt-1">跨云跨面板部署目标</div>
                <div className="text-[11px] text-slate-500 mt-0.5">宝塔 / Docker / 1Panel / CDN / K8s</div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200/70 shadow-2xs">
                <div className="text-2xl sm:text-3xl font-black text-emerald-600">AES-256</div>
                <div className="text-xs sm:text-sm font-bold text-slate-800 mt-1">硬件级 GCM 密文存储</div>
                <div className="text-[11px] text-slate-500 mt-0.5">安全入口 Token 防爆破保护</div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Pain Points vs Solutions */}
        <section id="pain-points" className="scroll-mt-24 py-16 sm:py-24 bg-white border-b border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <span className="text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                为什么选择云签盾
              </span>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900">
                直击 HTTPS 证书运维四大核心痛点
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                告别传统人工记忆、繁琐脚本与跨平台手工复制粘贴，构建高可用、零失误的企业级证书自动化基础设施。
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
              {painPoints.map((item, idx) => (
                <article
                  key={idx}
                  className="rounded-3xl bg-slate-50/70 border border-slate-200/90 p-6 sm:p-7 flex flex-col justify-between space-y-5 shadow-xs hover:shadow-md transition-shadow"
                >
                  {/* Pain Point */}
                  <div className="p-4 rounded-2xl bg-rose-50/90 border border-rose-200/80 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-rose-700">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>传统运维痛点 #{idx + 1}：{item.painTitle}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {item.painDesc}
                    </p>
                  </div>

                  {/* Solution */}
                  <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200/90 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>云签盾解决方案：{item.solutionTitle}</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {item.solutionDesc}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: Core Feature Matrix */}
        <section id="features" className="scroll-mt-24 py-16 sm:py-24 bg-slate-50 border-b border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <span className="text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                全栈能力矩阵
              </span>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900">
                集签发、部署、监控、审计于一体的安全中枢
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                从 ACME 底层协议交互到多云生产环境平滑热重载，每一处细节均按企业级高可靠标准打造。
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feat, idx) => {
                const Icon = feat.icon;
                return (
                  <article
                    key={idx}
                    className="rounded-3xl bg-white border border-slate-200/90 p-6 flex flex-col justify-between hover:border-emerald-500/60 transition-all group shadow-2xs hover:shadow-lg"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {feat.badge}
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900 mb-2">
                        {feat.title}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {feat.desc}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Section 4: 3-Step Declarative Workflow Architecture */}
        <section id="workflow" className="scroll-mt-24 py-16 sm:py-24 bg-white border-b border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <span className="text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                极简工程哲学
              </span>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900">
                声明式 3 步向导，30 秒打通全自动证书流水线
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                摒弃反人类的复杂节点连线图，将证书全生命周期浓缩为直观的 3 步声明式配置。
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-3xl bg-slate-50 border border-slate-200/90 p-7 relative shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-emerald-600/20 mb-4">
                  01
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 mb-2">
                  定义域名与 CA 签发策略
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  输入主域名与备用 SAN 域名（支持 `*.domain.com` 通配符泛域名），选择 Let&apos;s Encrypt 或 ZeroSSL 等 CA 账户，按需指定 EC256 或 RSA2048 密钥算法。
                </p>
              </div>

              <div className="rounded-3xl bg-slate-50 border border-slate-200/90 p-7 relative shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-teal-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-teal-600/20 mb-4">
                  02
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 mb-2">
                  绑定 DNS-01 自动化验证凭据
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  关联阿里云 DNS、腾讯云 DNSPod 或 Cloudflare API 凭据。系统自动写入 `_acme-challenge` TXT 记录，并通过全球多源权威 DoH 预检确认生效后完成签发与清理。
                </p>
              </div>

              <div className="rounded-3xl bg-slate-50 border border-slate-200/90 p-7 relative shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-cyan-600/20 mb-4">
                  03
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 mb-2">
                  编排多端部署目标与智能巡检
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  自由组合一个或多个部署目标（宝塔面板、宝塔 Docker、1Panel、CDN、K8s、SSH 主机），开启到期前 30 天自动续期与多通道告警推送。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Multi-Cloud & Panel Deployment Ecosystem */}
        <section id="ecosystem" className="scroll-mt-24 py-16 sm:py-24 bg-slate-50 border-b border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <span className="text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                无缝对接主流生态
              </span>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900">
                支持 10+ 种主流运维面板、容器与云厂商一键部署
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                无论是国内主流的宝塔面板、宝塔 Docker 容器网站、1Panel、阿里云 DCDN，还是 Kubernetes 云原生集群，均可实现零停机证书热更新。
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {deployTargetsList.map((target, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl bg-white border border-slate-200/90 p-5 flex flex-col justify-between hover:border-emerald-500/50 shadow-2xs hover:shadow-md transition-all"
                >
                  <div>
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/70 mb-2.5">
                      {target.tag}
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-900 mb-1.5">
                      {target.name}
                    </h3>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {target.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 6: SEO FAQ Section */}
        <section id="faq" className="scroll-mt-24 py-16 sm:py-24 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-3 mb-12">
              <span className="text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                常见问题解答 (FAQ)
              </span>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900">
                关于云签盾 SSL 证书自动化平台
              </h2>
            </div>

            <div className="space-y-3.5">
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-2xl bg-slate-50 border border-slate-200/90 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-slate-900 hover:text-emerald-600 transition-colors"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-600' : 'text-slate-400'}`} />
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-200/70 pt-3 bg-white">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Official SEO Footer (Light Theme) */}
      <footer className="border-t border-slate-200/90 bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="font-black text-slate-900 text-sm">
                云签盾 · 企业级全自动 SSL/TLS 证书生命周期管理平台
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                RFC 8555 (ACME) 标准签发 · 全球 DoH 权威预检 · 跨云跨面板自动化热重载 · 7×24h 全网 HTTPS 探针
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              守护引擎在线运行
            </span>
            <span>·</span>
            <span>AES-256-GCM 硬件级密文存储</span>
            <span>·</span>
            <span>© {new Date().getFullYear()} 云签盾 (ssl.ap1x.xyz)</span>
          </div>
        </div>
      </footer>

      {/* Security Entrance Token Prompt Modal (Light Theme) */}
      {tokenModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 relative">
            <button
              type="button"
              onClick={() => setTokenModalOpen(false)}
              className="absolute right-5 top-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  安全登录入口校验
                </h3>
                <p className="text-xs text-slate-500">
                  云签盾已启用防攻击安全入口保护，请输入访问令牌
                </p>
              </div>
            </div>

            {tokenError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{tokenError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyTokenSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  安全入口令牌 (LOGIN_TOKEN)
                </label>
                <input
                  type="password"
                  value={entryTokenInput}
                  onChange={(e) => setEntryTokenInput(e.target.value)}
                  placeholder="请输入配置文件中的 LOGIN_TOKEN"
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  提示：您也可以直接通过书签访问 <code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-emerald-700">/login?token=您的令牌</code> 进入登录页。
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setTokenModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={verifyingToken}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {verifyingToken ? '校验中...' : '验证并进入登录页'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
