
export interface LogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'error' | 'warn' | 'success';
  metadata?: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private listeners: ((logs: LogEntry[]) => void)[] = [];

  log(message: string, level: LogEntry['level'] = 'info', metadata?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      message,
      level,
      metadata
    };
    this.logs.unshift(entry); // Cele mai noi primele
    this.notify();
    
    // De asemenea, printăm în consola reală pentru dev tools
    const styles = {
      info: 'color: #3b82f6',
      error: 'color: #ef4444; font-weight: bold',
      warn: 'color: #f59e0b',
      success: 'color: #10b981'
    };
    console.log(`%c[${entry.level.toUpperCase()}] ${message}`, styles[level], metadata || '');
  }

  getLogs() {
    return this.logs;
  }

  clear() {
    this.logs = [];
    this.notify();
  }

  subscribe(callback: (logs: LogEntry[]) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.logs));
  }
}

export const logger = new Logger();
