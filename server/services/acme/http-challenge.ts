import http from 'http';

interface ChallengeEntry {
  keyAuthorization: string;
  createdAt: number;
}

export class HttpChallengeStore {
  private static challenges = new Map<string, ChallengeEntry>();

  public static registerChallenge(token: string, keyAuthorization: string): void {
    this.challenges.set(token.trim(), {
      keyAuthorization: keyAuthorization.trim(),
      createdAt: Date.now()
    });
    this.cleanExpired();
  }

  public static getChallenge(token: string): string | undefined {
    const entry = this.challenges.get(token.trim());
    return entry?.keyAuthorization;
  }

  public static removeChallenge(token: string): void {
    this.challenges.delete(token.trim());
  }

  public static listActiveTokens(): string[] {
    return Array.from(this.challenges.keys());
  }

  private static cleanExpired(): void {
    const now = Date.now();
    for (const [token, entry] of this.challenges.entries()) {
      if (now - entry.createdAt > 3600000) { // 1 hour TTL
        this.challenges.delete(token);
      }
    }
  }
}

export class Http01Server {
  private static server: http.Server | null = null;
  private static activePort: number | null = null;

  /**
   * Start standalone HTTP-01 challenge server on specified port (e.g. 80 or 8080)
   */
  public static start(port: number = 80): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.server) {
        return resolve(true);
      }

      const srv = http.createServer((req, res) => {
        const url = req.url || '';
        const match = url.match(/^\/\.well-known\/acme-challenge\/([a-zA-Z0-9_-]+)/);
        if (match) {
          const token = match[1];
          const keyAuth = HttpChallengeStore.getChallenge(token);
          if (keyAuth) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(keyAuth);
            return;
          }
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      });

      srv.on('error', (err: any) => {
        console.warn(`[HTTP-01 Server] 监听端口 ${port} 提示: ${err.message} (系统将依赖主反向代理或内部 Express 路由响应挑战)`);
        resolve(false);
      });

      srv.listen(port, () => {
        this.server = srv;
        this.activePort = port;
        console.log(`[HTTP-01 Server] ✅ 独立 HTTP-01 验证服务已就绪，正在监听端口 :${port}`);
        resolve(true);
      });
    });
  }

  public static stop(): void {
    if (this.server) {
      try {
        this.server.close();
      } catch {}
      this.server = null;
      this.activePort = null;
    }
  }

  public static getRunningPort(): number | null {
    return this.activePort;
  }
}
