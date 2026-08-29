import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  ShieldCheck, 
  ShieldAlert,
  Key, 
  Lock, 
  Search, 
  UserCheck,
  UserX,
  X,
  AlertCircle,
  Smartphone,
  Copy,
  Check,
  Zap
} from 'lucide-react';
import { User, Role } from '../../types';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';

export const UsersView: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { confirm, toast } = useModal();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Edit / Add Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('operator');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 2FA Setup Modal
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false);
  const [twoFactorTargetUser, setTwoFactorTargetUser] = useState<User | null>(null);
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorOtpUrl, setTwoFactorOtpUrl] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = async (showToast = false) => {
    if (showToast) setRefreshing(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
      if (showToast) {
        toast.success('系统用户列表已刷新');
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
      if (showToast) {
        setTimeout(() => setRefreshing(false), 500);
      }
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openAddModal = () => {
    setEditingUser(null);
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('operator');
    setIsActive(true);
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setUsername(u.username);
    setEmail(u.email);
    setPassword('');
    setRole(u.role);
    setIsActive(u.isActive !== false);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim()) {
      setError('请填写用户名和邮箱');
      return;
    }

    if (!editingUser && !password) {
      setError('新建本地用户必须指定初始密码');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, {
          username: username.trim(),
          email: email.trim(),
          password: password || undefined,
          role,
          isActive
        });
        toast.success(`已更新用户 [${username.trim()}]`);
      } else {
        await api.createUser({
          username: username.trim(),
          email: email.trim(),
          password,
          role,
          isActive
        });
        toast.success(`已成功创建用户 [${username.trim()}]`);
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || '操作失败');
      toast.error(`保存失败: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, userEmail: string) => {
    if (currentUser?.id === id) {
      toast.warning('无法删除当前正在登录的管理员账号');
      return;
    }

    const ok = await confirm({
      title: '删除系统用户',
      message: `确定要删除用户 [${userEmail}] 吗？删除后该用户将无法登录系统。`,
      confirmText: '确认删除',
      type: 'danger'
    });
    if (!ok) return;

    try {
      await api.deleteUser(id);
      setUsers(users.filter(u => u.id !== id));
      toast.success(`已删除用户 [${userEmail}]`);
    } catch (err: any) {
      toast.error(`删除失败: ${err.message}`);
    }
  };

  // 2FA Setup Handlers
  const open2FAModal = async (u: User) => {
    setTwoFactorTargetUser(u);
    setTwoFactorCode('');
    setTwoFactorError(null);
    setTwoFactorLoading(true);
    setCopiedSecret(false);
    setTwoFactorModalOpen(true);

    try {
      const res = await api.setup2FA(u.id);
      setTwoFactorSecret(res.secret);
      setTwoFactorOtpUrl(res.otpauthUrl);
    } catch (err: any) {
      setTwoFactorError(err.message || '生成 2FA 密钥失败');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleVerifyAndEnable2FA = async () => {
    if (!twoFactorTargetUser || !twoFactorSecret || twoFactorCode.length !== 6) {
      setTwoFactorError('请输入 6 位动态验证码');
      return;
    }

    setTwoFactorLoading(true);
    setTwoFactorError(null);

    try {
      const res = await api.verify2FA(twoFactorTargetUser.id, {
        secret: twoFactorSecret,
        code: twoFactorCode
      });
      toast.success(res.message || '双因素身份验证 (2FA) 已成功激活');
      setTwoFactorModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setTwoFactorError(err.message || '验证失败，请检查验证码');
      toast.error(`2FA 验证失败: ${err.message}`);
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleDisable2FA = async (u: User) => {
    const ok = await confirm({
      title: '关闭双因素认证 (2FA)',
      message: `确定要关闭用户 [${u.username}] 的 2FA 双因素保护吗？关闭后该用户仅凭密码即可登录。`,
      confirmText: '确认关闭',
      type: 'warning'
    });
    if (!ok) return;

    try {
      const res = await api.disable2FA(u.id);
      toast.success(res.message || '2FA 已成功关闭');
      fetchUsers();
    } catch (err: any) {
      toast.error(`关闭失败: ${err.message}`);
    }
  };

  const handleCopySecret = () => {
    if (!twoFactorSecret) return;
    navigator.clipboard.writeText(twoFactorSecret);
    setCopiedSecret(true);
    toast.success('2FA 密钥已复制到剪贴板');
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">用户权限与 2FA 安全管理</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">管理本地管理员与 AuthMate SSO 授权用户，支持 RFC 6238 TOTP 双因素认证保护</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索用户或邮箱..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchUsers(true)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 shrink-0"
              title="刷新列表"
            >
              <RefreshCw className={`w-4 h-4 transition-transform duration-500 ${refreshing ? 'animate-spin text-emerald-500' : ''}`} />
            </button>

            <button
              onClick={openAddModal}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>添加本地用户</span>
            </button>
          </div>
        </div>
      </div>

      {/* Users Table / Cards */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-12 text-center space-y-3">
          <Users className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="font-bold text-slate-800 dark:text-slate-200">未找到相关用户</h3>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-300 font-bold">
                <tr>
                  <th className="py-3 px-4">用户名称 / 邮箱</th>
                  <th className="py-3 px-4">认证来源</th>
                  <th className="py-3 px-4">系统角色</th>
                  <th className="py-3 px-4">2FA 双因素认证</th>
                  <th className="py-3 px-4">状态</th>
                  <th className="py-3 px-4">上次登录</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map(u => {
                  const isSelf = u.id === currentUser?.id;
                  const isSSO = u.authSource === 'authmate';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0">
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{u.username}</span>
                              {isSelf && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                  当前
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">{u.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {isSSO ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40">
                            <Key className="w-3 h-3" /> AuthMate SSO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            <Lock className="w-3 h-3" /> 本地账号
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`font-semibold px-2 py-0.5 rounded ${
                          u.role === 'admin' 
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300' 
                            : u.role === 'operator'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}>
                          {u.role === 'admin' ? '超级管理员' : u.role === 'operator' ? '运维操作员' : '只读审计员'}
                        </span>
                      </td>

                      {/* 2FA Status */}
                      <td className="py-3 px-4">
                        {isSSO ? (
                          <span className="text-slate-400 text-[11px]">由 SSO IdP 托管</span>
                        ) : u.twoFactorEnabled ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200/80 dark:border-emerald-800/60">
                              <ShieldCheck className="w-3.5 h-3.5" /> 已启用 2FA
                            </span>
                            <button
                              onClick={() => handleDisable2FA(u)}
                              className="text-[10px] text-slate-400 hover:text-rose-500 underline decoration-dotted"
                              title="关闭此用户的 2FA 认证"
                            >
                              关闭
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => open2FAModal(u)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 px-2 py-0.5 rounded-lg transition-colors"
                          >
                            <Smartphone className="w-3.5 h-3.5" /> 点击开启 2FA
                          </button>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {u.isActive !== false ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                            <UserCheck className="w-3.5 h-3.5" /> 正常
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-500 font-semibold">
                            <UserX className="w-3.5 h-3.5" /> 已停用
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-[11px]">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '从未登录'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isSSO && (
                            <button
                              onClick={() => open2FAModal(u)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                              title="配置/重置 2FA 双因素认证"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="编辑权限 / 重置密码"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {!isSelf && (
                            <button
                              onClick={() => handleDelete(u.id, u.email)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                              title="删除用户"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filteredUsers.map(u => {
              const isSelf = u.id === currentUser?.id;
              const isSSO = u.authSource === 'authmate';

              return (
                <div key={u.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold text-sm flex items-center justify-center shrink-0">
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-sm">
                          <span>{u.username}</span>
                          {isSelf && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              当前
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 font-mono">{u.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(u)}
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="编辑"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {!isSelf && (
                        <button
                          onClick={() => handleDelete(u.id, u.email)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    {isSSO ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40">
                        <Key className="w-3 h-3" /> AuthMate SSO
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        <Lock className="w-3 h-3" /> 本地账号
                      </span>
                    )}

                    <span className={`px-2 py-0.5 rounded font-medium ${
                      u.role === 'admin' 
                        ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300' 
                        : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                    }`}>
                      {u.role === 'admin' ? '管理员' : '操作员'}
                    </span>

                    {!isSSO && (
                      u.twoFactorEnabled ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60 font-semibold">
                          <ShieldCheck className="w-3 h-3" /> 2FA 保护中
                        </span>
                      ) : (
                        <button
                          onClick={() => open2FAModal(u)}
                          className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded hover:text-emerald-600"
                        >
                          <Smartphone className="w-3 h-3" /> 开启 2FA
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit / Add User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {editingUser ? `编辑用户 [${editingUser.username}]` : '添加本地系统用户'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">用户显示名称</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="例如: 运维专员-张三"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">登录电子邮箱</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  disabled={Boolean(editingUser)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {editingUser ? '重置登录密码 (留空则不修改)' : '初始登录密码'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={editingUser ? '•••••••• (留空保持原密码)' : '至少 6 位安全字符'}
                  required={!editingUser}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">系统角色分配</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as Role)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-medium"
                >
                  <option value="admin">超级管理员 (拥有全部设置、密钥与用户管理权限)</option>
                  <option value="operator">运维操作员 (可执行证书申请、部署与监控任务)</option>
                  <option value="viewer">只读审计员 (仅支持查看证书与探针监控数据)</option>
                </select>
              </div>

              {editingUser && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="userIsActive"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <label htmlFor="userIsActive" className="text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                    启用该用户账户（取消勾选将禁止该用户登录）
                  </label>
                </div>
              )}

              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {submitting ? '保存中...' : '确认保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2FA TOTP Setup Modal */}
      {twoFactorModalOpen && twoFactorTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">配置 2FA 双因素身份验证</h3>
                  <p className="text-[11px] text-slate-400">{twoFactorTargetUser.username} ({twoFactorTargetUser.email})</p>
                </div>
              </div>
              <button onClick={() => setTwoFactorModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {twoFactorError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{twoFactorError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              {/* Step 1: Add key to Authenticator */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center">1</span>
                  <span>在手机身份验证器中添加此密钥 (Secret Key)</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  支持 Google Authenticator、Microsoft Authenticator、1Password 等 RFC 6238 验证器。
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={twoFactorSecret}
                    className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 tracking-wider text-center select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 font-semibold flex items-center gap-1 shrink-0"
                  >
                    {copiedSecret ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedSecret ? '已复制' : '复制密钥'}</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Verify code */}
              <div className="space-y-2">
                <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center">2</span>
                  <span>输入验证器当前生成的 6 位动态验证码</span>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="例如: 123456"
                  className="w-full text-center tracking-[0.4em] text-base font-mono px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setTwoFactorModalOpen(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleVerifyAndEnable2FA}
                  disabled={twoFactorLoading || twoFactorCode.length !== 6}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{twoFactorLoading ? '验证中...' : '验证并立即启用 2FA'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
