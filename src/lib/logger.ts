export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

class Logger {
  private minLevel = LogLevel.DEBUG;

  setMinLevel(level: LogLevel) {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  debug(message: string) {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    console.debug(message);
  }

  info(message: string) {
    if (!this.shouldLog(LogLevel.INFO)) return;
    console.log(message);
  }

  warn(message: string) {
    if (!this.shouldLog(LogLevel.WARN)) return;
    console.warn(message);
  }

  error(message: string) {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    console.error(message);
  }
}

export const logger = new Logger();
