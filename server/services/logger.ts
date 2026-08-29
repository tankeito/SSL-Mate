import { Response } from 'express';

export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  stage?: string;
}

class LogBroadcaster {
  private subscribers: Map<string, Set<Response>> = new Map();

  public subscribe(taskId: string, res: Response) {
    if (!this.subscribers.has(taskId)) {
      this.subscribers.set(taskId, new Set());
    }
    this.subscribers.get(taskId)!.add(res);

    res.on('close', () => {
      const set = this.subscribers.get(taskId);
      if (set) {
        set.delete(res);
        if (set.size === 0) {
          this.subscribers.delete(taskId);
        }
      }
    });
  }

  public broadcast(taskId: string, entry: LogEntry) {
    const clients = this.subscribers.get(taskId);
    if (!clients || clients.size === 0) return;

    const data = JSON.stringify(entry);
    clients.forEach(res => {
      try {
        res.write(`data: ${data}\n\n`);
      } catch (err) {
        // Client might have disconnected
      }
    });
  }
}

export const logBroadcaster = new LogBroadcaster();

export class TaskLogger {
  private taskId: string;
  public entries: LogEntry[] = [];

  constructor(taskId: string) {
    this.taskId = taskId;
  }

  public log(level: LogLevel, message: string, stage?: string) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      stage
    };
    this.entries.push(entry);
    console.log(`[${entry.timestamp}] [${level.toUpperCase()}] [Task:${this.taskId}]${stage ? ` [${stage}]` : ''} ${message}`);
    logBroadcaster.broadcast(this.taskId, entry);
  }

  public info(message: string, stage?: string) {
    this.log('info', message, stage);
  }

  public warn(message: string, stage?: string) {
    this.log('warn', message, stage);
  }

  public error(message: string, stage?: string) {
    this.log('error', message, stage);
  }

  public success(message: string, stage?: string) {
    this.log('success', message, stage);
  }
}
