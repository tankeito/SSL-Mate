import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  ShieldCheck, 
  Key, 
  Lock, 
  Search, 
  UserCheck,
  UserX,
  X,
  AlertCircle
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

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('operator');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
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

  const handleDelete = async (id: string, email: string) => {
    if (currentUser?.id === id) {
      toast.warning('无法删除当前正在登录的管理员账号');
      return;
    }

    const ok = await confirm({
      title: '删除系统用户',
      message: `确定要删除用户 [${email}] 吗？删除后该用户将无法登录系统。`,
      confirmText: '确认删除',
      type: 'danger'
    });
    if (!ok) return;

    try {
      await api.deleteUser(id);
      setUsers(users.filter(u => u.id !== id));
      toast.success(`已删除用户 [${email}]`);
    } catch (err: any) {
      toast.error(`删除失败: ${err.message}`);
    }
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
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">用户权限管理</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">管理本地管理员与 AuthMate SSO 授权登录的用户与权限</p>
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
              onClick={fetchUsers}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
              title="刷新列表"
            >
              <RefreshCw className="w-4 h-4" />
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
                  <th className="py-3 px-4">状态</th>
                  <th className="py-3 px-4">上次登录</th>
                  <th className="py-3 px-4">创建时间</th>
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

                      <td className="py-3 px-4 text-[11px] text-slate-400 font-mono">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center">
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{u.username}</span>
                          {isSelf && <span className="text-[10px] px-1 bg-emerald-100 text-emerald-700 rounded">我</span>}
                        </div>
                        <span className="text-xs text-slate-400 font-mono">{u.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditModal(u)} className="p-1.5 text-slate-500"><Edit3 className="w-4 h-4" /></button>
                      {!isSelf && (
                        <button onClick={() => handleDelete(u.id, u.email)} className="p-1.5 text-rose-500"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                      {isSSO ? 'AuthMate SSO' : '本地账号'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                      {u.role === 'admin' ? '超级管理员' : u.role === 'operator' ? '运维操作员' : '只读审计员'}
                    </span>
                    <span className={u.isActive !== false ? 'text-emerald-600' : 'text-rose-500'}>
                      {u.isActive !== false ? '● 正常' : '○ 已停用'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {editingUser ? '编辑用户 / 重置密码' : '添加本地管理员用户'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">用户显示名</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="例如: 张三 / 运维主管"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">邮箱地址 (登录账号)</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={!!editingUser}
                  placeholder="admin@example.com"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {editingUser ? '重置密码 (留空则保持不变)' : '初始登录密码'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={editingUser ? '留空不修改' : '••••••••'}
                  required={!editingUser}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">角色权限</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
                >
                  <option value="admin">超级管理员 (全功能操作与用户管理)</option>
                  <option value="operator">运维操作员 (证书任务创建、申请与部署)</option>
                  <option value="viewer">只读审计员 (仅查看证书台账与状态)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="isActiveToggle" className="text-slate-700 dark:text-slate-300 cursor-pointer">
                  启用账号登录
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
                >
                  {submitting ? '保存中...' : '保存用户'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
