import crypto from 'crypto';
import { db } from '../db/database.js';
import { NotifyChannel } from '../db/schema.js';
import { decryptObject } from './crypto.js';

export interface NotificationPayload {
  event: 'renew_success' | 'renew_failed' | 'expiring_soon';
  taskName: string;
  domains: string[];
  expiresAt?: string;
  daysLeft?: number;
  errorMessage?: string;
}

export class NotificationService {
  public static async dispatch(channelIds: string[], payload: NotificationPayload) {
    if (!channelIds || channelIds.length === 0) return;

    for (const id of channelIds) {
      const channel = db.findNotifyChannelById(id);
      if (!channel || !channel.isEnabled) continue;

      if (channel.events && !channel.events.includes(payload.event)) {
        continue;
      }

      try {
        await this.sendToChannel(channel, payload);
      } catch (err: any) {
        console.error(`Failed to send notification via [${channel.name}]:`, err.message);
      }
    }
  }

  public static async sendToChannel(channel: NotifyChannel, payload: NotificationPayload) {
    const config = decryptObject<any>(channel.config as any);

    const title = payload.event === 'renew_success' 
      ? `✅ SSL 证书自动续期成功通知`
      : payload.event === 'renew_failed'
        ? `❌ SSL 证书续期失败告警`
        : `⚠️ SSL 证书即将到期预警`;

    const content = `【SSL-Mate 证书伴侣】\n任务名称: ${payload.taskName}\n域名列表: ${payload.domains.join(', ')}\n` +
      (payload.expiresAt ? `到期时间: ${new Date(payload.expiresAt).toLocaleString()}\n` : '') +
      (payload.daysLeft !== undefined ? `剩余天数: ${payload.daysLeft} 天\n` : '') +
      (payload.errorMessage ? `错误原因: ${payload.errorMessage}\n` : '') +
      `通知时间: ${new Date().toLocaleString()}`;

    switch (channel.type) {
      case 'dingtalk': {
        const webhookUrl = config.webhookUrl;
        if (!webhookUrl) return;
        let finalUrl = webhookUrl;
        if (config.secret) {
          const timestamp = Date.now();
          const stringToSign = `${timestamp}\n${config.secret}`;
          const sign = crypto.createHmac('sha256', config.secret).update(stringToSign).digest('base64');
          finalUrl = `${webhookUrl}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
        }
        await fetch(finalUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            msgtype: 'markdown',
            markdown: { title, text: `### ${title}\n\n` + content.replace(/\n/g, '\n\n') }
          })
        });
        break;
      }

      case 'feishu': {
        const webhookUrl = config.webhookUrl;
        if (!webhookUrl) return;
        const body: any = {
          msg_type: 'interactive',
          card: {
            header: {
              title: { tag: 'plain_text', content: title },
              template: payload.event === 'renew_success' ? 'green' : 'red'
            },
            elements: [{ tag: 'div', text: { tag: 'lark_md', content: content } }]
          }
        };
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        break;
      }

      case 'wecom': {
        const webhookUrl = config.webhookUrl;
        if (!webhookUrl) return;
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            msgtype: 'text',
            text: { content: `${title}\n\n${content}` }
          })
        });
        break;
      }

      case 'telegram': {
        const { botToken, chatId } = config;
        if (!botToken || !chatId) return;
        const tgUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        await fetch(tgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `*${title}*\n\n\`\`\`\n${content}\n\`\`\``,
            parse_mode: 'Markdown'
          })
        });
        break;
      }

      case 'webhook': {
        const webhookUrl = config.webhookUrl;
        if (!webhookUrl) return;
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, ...payload, timestamp: new Date().toISOString() })
        });
        break;
      }
    }
  }
}
