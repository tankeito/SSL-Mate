# SSL-Mate (证书伴侣) 功能升级与问题修复报告

## 一、 修复与优化清单

### 1. AuthMate SSO 单点登录配置与客户端注册
- **问题分析**：
  - 用户在 `E:\ai\AuthMate\app` 中仅执行了 `npm run dev`（启动了 5173 端口的前端 Vite），而 AuthMate 的 OIDC IdP 服务端（`/oauth2/authorize`、`/oauth2/token` 等）位于后端 **8787** 端口（需通过 `npm run dev:api` 启动）。
  - 同时在 AuthMate 的客户端注册列表 `oidc_clients.json` 中补齐了 `sslmate-app` 客户端及其回调白名单。
- **改进措施**：
  - 在 `E:\ai\AuthMate\app\server\oidc_clients.json` 中已注册 `sslmate-app` 及其回调地址 `http://localhost:5174/oauth/callback`。
  - 在登录页提供友好的连接诊断与引导提示。

---

### 2. 界面文案与敏感路径脱敏 (图 3)
- **已全面清除**：删除了页面上所有 `E:\ai\AuthMate` 等类似本地路径的文案与子标题。
- **标准化为企业级文案**：`基于 OIDC / OAuth2 + PKCE S256 标准单点登录协议深度联动`。

---

### 3. 主题模式切换失效问题修复 (图 4)
- **原因**：Tailwind CSS v4 在未配置 `@custom-variant dark` 时，HTML 上的 `.dark` 类名不会触发 `dark:` 规则。
- **修复**：
  - 在 `src/index.css` 中注入 `@custom-variant dark (&:where(.dark, .dark *));`；
  - 增强了右上角主题切换按钮的交互反馈、图标状态（深色模式为黄色太阳，浅色模式为紫罗兰月亮）与平滑过渡效果。

---

### 4. 管理员账号与密码安全性升级
- **管理员账号**：`tqd354@gmail.com`（或用户名 `tqd354`）
- **管理员密码**：`aaAA1122`（已更新至底层 `data/sslmate.json` 与 PBKDF2 哈希驱动）
- **安全脱敏**：彻底移除了登录页上所有明文预填账号密码与提示文字。

---

### 5. 新增后台【👥 用户权限管理】模块
- **前端页面**：`src/components/users/UsersView.tsx`（已加入左侧菜单导航）
- **功能特性**：
  - 用户台账列表：头像首字母、用户名、邮箱、认证来源（**AuthMate SSO** 蓝标 / **本地灾备** 灰标）、系统角色（超级管理员/运维操作员/只读审计员）、账号启用/停用状态、上次登录时间；
  - 添加本地管理员/操作员用户；
  - 编辑用户角色、启停状态、重置登录密码；
  - 安全防护机制：禁止删除当前登录的管理员自身账号，禁止停用自身。
- **后端 REST API**：
  - `GET /api/users`
  - `POST /api/users`
  - `PUT /api/users/:id`
  - `DELETE /api/users/:id`

---

### 6. 全面适配移动端手机端样式 (Mobile-Responsive)
- **移动端顶栏**：新增汉堡菜单（Hamburger）按钮，移动端标题精简；
- **抽屉式侧边栏**：移动端点击汉堡菜单唤出滑动抽屉式导航栏，带毛玻璃遮罩层，点击任意菜单或遮罩自动收起；
- **响应式表格自适应卡片**：在屏幕宽度小于 `768px` 时，用户管理、证书任务、监控探针等表格自动切换为移动端触摸卡片模式；
- **模态框响应式布局**：3 步向导和添加用户模态框在移动端满宽居中展示。

---

## 二、 启动与使用验证

### 1. 启动 AuthMate (如需测试单点登录)
在 `E:\ai\AuthMate\app` 目录下：
```bash
# 启动 AuthMate IdP 后端服务 (监听 8787 端口)
npm run dev:api
```

### 2. 启动 SSL-Mate (证书伴侣)
在 `E:\ai\ssl-mate` 目录下：
```bash
# 启动前端 (5174 端口)
npm run dev

# 启动后端 (8989 端口)
npm run dev:api
```

打开浏览器访问：[**http://127.0.0.1:5174**](http://127.0.0.1:5174)
- **本地管理员登录**：邮箱 `tqd354@gmail.com`，密码 `aaAA1122`。
- **AuthMate SSO 登录**：点击【使用 AuthMate 账号一键登录】。
