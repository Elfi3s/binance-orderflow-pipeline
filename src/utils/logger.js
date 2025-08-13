// src\utils\logger.js
import fs from 'fs';
import path from 'path';
import { config } from '../../config.js';

export class Logger {
  constructor() {
    this.logFile = path.join(config.logPath, `pipeline_${new Date().toISOString().split('T')[0]}.log`);
    this.ensureLogFile();
  }

  ensureLogFile() {
    try {
      if (!fs.existsSync(this.logFile)) {
        fs.writeFileSync(this.logFile, `Pipeline Log Started: ${new Date().toISOString()}\n`);
      }
    } catch (error) {
      console.error('Failed to create log file:', error);
    }
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level}: ${message}${data ? ` ${JSON.stringify(data)}` : ''}\n`;
    
    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  info(message, data = null) {
    this.log('INFO', message, data);
  }

  error(message, data = null) {
    this.log('ERROR', message, data);
  }

  warn(message, data = null) {
    this.log('WARN', message, data);
  }
}
