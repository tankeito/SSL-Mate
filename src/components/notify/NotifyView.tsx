import React, { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, Edit3, RefreshCw, Send, Check, X, AlertCircle } from 'lucide-react';
import { NotifyChannel, NotifyChannelType } from '../../types';
import { api } from '../../api/client';
import { useModal } from '../../contexts/ModalContext';

export const NotifyView: React.FC = () => {
  const { confirm, toast } = useModal();
  const [channels, setChannels] = useState<NotifyChannel[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotifyChannel | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<NotifyChannelType>('dingtalk');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [events, setEvents] = useState<('renew_success' | 'renew_failed' | 'expiring_soon')[]>([
    'renew_success', 'renew_failed', 'expiring_soon'
  ]);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchChannels = async (showToast = false) => {
    if (showToast) setRefreshing(true);
    try {
      const data = await api.getChannels();
      setChannels(data);
      if (showToast) {
        toast.success('告警通知通道列表已刷新');
      }
    } catch (err) {
      console.error('Failed to load channels:', err);
    } finally {
      setLoading(false);
      if (showToast) {
        setTimeout(() => setRefreshing(false), 500);
      }
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const openAddModal = () => {
    setEditingChannel(null);
    setName('');
    setType('dingtalk');
    setWebhookUrl('');
    setSecret('');
    setBotToken('');
    setChatId('');
    setEvents(['renew_success', 'renew_failed', 'expiring_soon']);
    setTestResult(null);
    setModalOpen(true);
  };

  const openEditModal = (ch: NotifyChannel) => {
    setEditingChannel(ch);
    setName(ch.name);
    setType(ch.type);
    const cfg = ch.config || {};
    setWebhookUrl(cfg.webhookUrl || '');
    setSecret(cfg.secret || '');
    setBotToken(cfg.botToken || '');
    setChatId(cfg.chatId || '');
    setEvents(ch.events || ['renew_success', 'renew_failed', 'expiring_soon']);
    setTestResult(null);
    setModalOpen(true);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    let config: Record<string, any> = {};
    if (type === 'telegram') {
      config = { botToken, chatId };
    } else {
      config = { webhookUrl, secret };
    }

    try {
      const res = await api.testChannel({ type, config });
      setTestResult(res);
      if (res.success) {
        toast.success('测试消息推送成功！机器人通道正常');
      } else {
        toast.error(`测试推送失败: ${res.message}`);
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || '测试消息发送失败' });
      toast.error(`测试推送失败: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.warning('请填写通知通道名称');
      return;
    }

    let config: Record<string, any> = {};
    if (type === 'telegram') {
      config = { botToken, chatId };
    } else {
      config = { webhookUrl, secret };
    }

    try {
      if (editingChannel) {
        await api.updateChannel(editingChannel.id, { name, type, config, events, isEnabled: true });
        toast.success(`已更新通知通道 [${name}]`);
      } else {
        await api.createChannel({ name, type, config, events, isEnabled: true });
        toast.success(`已创建通知通道 [${name}]`);
      }
      setModalOpen(false);
      fetchChannels();
    } catch (err: any) {
      toast.error(`保存失败: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, chName: string) => {
    const ok = await confirm({
      title: '删除告警通知通道',
      message: `确定要删除通知通道 [${chName}] 吗？删除后证书异常与续期成功将不再向此通道推送。`,
      confirmText: '确认删除',
      type: 'danger'
    });
    if (!ok) return;

    try {
      await api.deleteChannel(id);
      setChannels(channels.filter(c => c.id !== id));
      toast.success(`已删除通知通道 [${chName}]`);
    } catch (err: any) {
      toast.error(`删除失败: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">告警与通知通道</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">配置证书自动续期成功、续期失败及到期预警时的多渠道即时消息推送</p>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          <button
            onClick={() => fetchChannels(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 shrink-0"
            title="刷新列表"
          >
            <RefreshCw className={`w-4 h-4 transition-transform duration-500 ${refreshing ? 'animate-spin text-emerald-500' : ''}`} />
          </button>

          <button
            onClick={openAddModal}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>添加告警通道</span>
          </button>
        </div>
      </div>

      {/* Channels List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      ) : channels.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-slate-200">暂无告警通知通道</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            配置钉钉机器人、飞书自定义机器人、企业微信或 Telegram，证书续期异常时第一时间收到推送。
          </p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>立即配置</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map(ch => (
            <div
              key={ch.id}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 shrink-0">
                      <Bell className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">{ch.name}</h3>
                  </div>

                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                    {ch.type}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1 text-[10px]">
                  {ch.events?.map((ev, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {ev === 'renew_success' ? '续期成功' : ev === 'renew_failed' ? '续期失败' : '到期预警'}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => openEditModal(ch)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(ch.id, ch.name)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {editingChannel ? '编辑告警通道' : '添加告警通道'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs flex-1 overflow-y-auto pr-1">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">通道名称</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="例如: 钉钉运维值班群"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">通知方式</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
                >
                  <option value="dingtalk">钉钉自定义机器人 (DingTalk)</option>
                  <option value="feishu">飞书自定义机器人 (Feishu/Lark)</option>
                  <option value="wecom">企业微信机器人 (WeCom)</option>
                  <option value="telegram">Telegram Bot</option>
                  <option value="webhook">自定义 HTTP Webhook</option>
                </select>
              </div>

              {type !== 'telegram' ? (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Webhook URL</label>
                    <input
                      type="text"
                      value={webhookUrl}
                      onChange={e => setWebhookUrl(e.target.value)}
                      placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                  {(type === 'dingtalk' || type === 'feishu') && (
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">加签密钥 Secret (可选)</label>
                      <input
                        type="password"
                        value={secret}
                        onChange={e => setSecret(e.target.value)}
                        placeholder="SEC..."
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono"
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Bot Token</label>
                    <input
                      type="password"
                      value={botToken}
                      onChange={e => setBotToken(e.target.value)}
                      placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Chat ID</label>
                    <input
                      type="text"
                      value={chatId}
                      onChange={e => setChatId(e.target.value)}
                      placeholder="-1001234567890"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                </>
              )}

              {/* Test message */}
              {testResult && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  testResult.success 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                }`}>
                  {testResult.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{testing ? '发送中...' : '发送测试消息'}</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
                >
                  保存通道
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
