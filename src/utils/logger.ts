import * as fs from 'fs';
import * as path from 'path';

export class Logger {
  private logDir: string;
  private logFile: string;

  constructor(logDir: string = './logs') {
    this.logDir = logDir;

    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(logDir, `video-gen-${timestamp}.log`);
  }

  log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;

    console.log(message);
    fs.appendFileSync(this.logFile, logMessage);
  }

  error(message: string, error?: any): void {
    const timestamp = new Date().toISOString();
    const errorMessage = error ? `${message}: ${error}` : message;
    const logMessage = `[${timestamp}] ERROR: ${errorMessage}\n`;

    console.error(errorMessage);
    fs.appendFileSync(this.logFile, logMessage);
  }

  warn(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] WARN: ${message}\n`;

    console.warn(message);
    fs.appendFileSync(this.logFile, logMessage);
  }

  info(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] INFO: ${message}\n`;

    console.log(message);
    fs.appendFileSync(this.logFile, logMessage);
  }
}
