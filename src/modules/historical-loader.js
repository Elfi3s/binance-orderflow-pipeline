// src/modules/historical-loader.js - NEW FILE FOR PERSISTENCE
import fs from 'fs';
import path from 'path';
import { config } from '../../config.js';

export class HistoricalLoader {
  constructor() {
    this.maxBarsToLoad = 10; // Load last 10 completed bars
  }

  async loadRecentBars() {
    try {
      const files = fs.readdirSync(config.outputPath)
        .filter(file => file.startsWith('footprint_complete_'))
        .map(file => {
          const filePath = path.join(config.outputPath, file);
          const stats = fs.statSync(filePath);
          return { file, timestamp: stats.mtime };
        })
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.maxBarsToLoad);

      const recentBars = [];
      for (const { file } of files) {
        const filePath = path.join(config.outputPath, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        recentBars.push(data);
      }

      return recentBars.sort((a, b) => a.barEnd - b.barEnd); // Chronological order
    } catch (error) {
      console.warn('Could not load historical bars:', error.message);
      return [];
    }
  }
}
