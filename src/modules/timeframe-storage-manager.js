// src/modules/timeframe-storage-manager.js - NEW FILE
import fs from 'fs';
import path from 'path';
import { config } from '../../config.js';
import chalk from 'chalk';

export class TimeframeStorageManager {
  constructor() {
    this.interval = config.interval;
    this.basePath = path.resolve('./data/snapshots');
    this.intervalPath = path.resolve(`./data/snapshots/${this.interval}`);
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
    if (!fs.existsSync(this.intervalPath)) {
      fs.mkdirSync(this.intervalPath, { recursive: true });
    }
  }

  saveSnapshot(snapshot) {
    // Add interval metadata to snapshot
    const enhancedSnapshot = {
      ...snapshot,
      interval: this.interval,
      intervalMs: this.parseIntervalToMs(this.interval)
    };

    const fileName = `footprint_${this.interval}_${Date.now()}.json`;
    const filePath = path.join(this.intervalPath, fileName);

    try {
      fs.writeFileSync(filePath, JSON.stringify(enhancedSnapshot, null, 2));
      console.log(chalk.green(`✅ ${this.interval.toUpperCase()} snapshot saved: ${fileName}`));
      
      // Cleanup old files (keep only last 50 for this interval)
      this.cleanupOldSnapshots();
      
      return filePath;
    } catch (err) {
      console.error(chalk.red('❌ Failed to save snapshot:'), err);
      return null;
    }
  }

  loadConsecutiveHistoricalBars(count = 5) {
    try {
      // Get all files for current interval
      const files = fs.readdirSync(this.intervalPath)
        .filter(file => file.startsWith(`footprint_${this.interval}_`))
        .map(file => {
          const timestamp = parseInt(file.match(/footprint_.*_(\d+)\.json/)?.[1] || '0');
          return { file, timestamp, path: path.join(this.intervalPath, file) };
        })
        .sort((a, b) => b.timestamp - a.timestamp); // Most recent first

      if (files.length === 0) {
        console.log(chalk.yellow(`⚠️ No historical bars found for ${this.interval}`));
        return [];
      }

      // Load the most recent 'count' bars
      const barsToLoad = files.slice(0, count);
      const historicalBars = [];

      for (const fileInfo of barsToLoad) {
        try {
          const data = JSON.parse(fs.readFileSync(fileInfo.path, 'utf8'));
          
          // Verify this is the correct interval
          if (data.interval === this.interval) {
            historicalBars.push(data);
          }
        } catch (error) {
          console.warn(`Could not load historical bar ${fileInfo.file}:`, error.message);
        }
      }

      // Sort chronologically (oldest first)
      historicalBars.sort((a, b) => a.barEnd - b.barEnd);

      console.log(chalk.green(`✅ Loaded ${historicalBars.length} consecutive ${this.interval} bars`));
      return historicalBars;

    } catch (error) {
      console.error(chalk.red('❌ Failed to load historical bars:'), error);
      return [];
    }
  }

  cleanupOldSnapshots() {
    try {
      const files = fs.readdirSync(this.intervalPath)
        .filter(file => file.startsWith(`footprint_${this.interval}_`))
        .map(file => ({
          file,
          path: path.join(this.intervalPath, file),
          timestamp: parseInt(file.match(/footprint_.*_(\d+)\.json/)?.[1] || '0')
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      // Keep only the 50 most recent files
      if (files.length > 50) {
        const filesToDelete = files.slice(50);
        
        for (const fileInfo of filesToDelete) {
          fs.unlinkSync(fileInfo.path);
        }
        
        console.log(chalk.gray(`🗑️ Cleaned up ${filesToDelete.length} old ${this.interval} snapshots`));
      }
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  }

  parseIntervalToMs(interval) {
    const matches = interval.match(/^(\d+)([smhd])$/);
    if (!matches) return 0;
    
    const value = parseInt(matches[1]);
    const unit = matches[2];
    
    const multipliers = { s: 1000, m: 60*1000, h: 60*60*1000, d: 24*60*60*1000 };
    return value * multipliers[unit];
  }
}
