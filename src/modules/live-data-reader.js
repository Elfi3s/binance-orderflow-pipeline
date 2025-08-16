// src/modules/live-data-reader.js - NEW FILE
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { config } from '../../config.js';

export class LiveDataReader {
  constructor() {
    this.interval = config.interval;
    this.dataPath = path.resolve(`./data/live/${this.interval}`);
    this.lastProcessedTimestamp = 0;
    this.isReading = false;
  }

  startReading(onTradeData, onKlineData, onDepthData) {
    if (this.isReading) return;
    
    this.isReading = true;
    console.log(chalk.blue('📖 Started reading live data files...'));
    
    // Process existing files first
    this.processExistingFiles(onTradeData, onKlineData, onDepthData);
    
    // Then monitor for new files
    setInterval(() => {
      this.processNewFiles(onTradeData, onKlineData, onDepthData);
    }, 1000); // Check every second
  }

  processExistingFiles(onTradeData, onKlineData, onDepthData) {
    try {
      if (!fs.existsSync(this.dataPath)) {
        console.log(chalk.yellow(`⚠️ No live data directory found: ${this.dataPath}`));
        console.log(chalk.yellow('📝 Start the data collector first with: npm run collect'));
        return;
      }

      const files = this.getUnprocessedFiles();
      
      if (files.length === 0) {
        console.log(chalk.yellow('⚠️ No live data files found'));
        console.log(chalk.yellow('📝 Make sure data collector is running: npm run collect'));
        return;
      }

      console.log(chalk.green(`📂 Processing ${files.length} existing data files...`));
      
      for (const fileInfo of files) {
        this.processDataFile(fileInfo, onTradeData, onKlineData, onDepthData);
      }
      
      console.log(chalk.green('✅ Existing data files processed'));
      
    } catch (error) {
      console.error(chalk.red('❌ Error processing existing files:'), error);
    }
  }

  processNewFiles(onTradeData, onKlineData, onDepthData) {
    const files = this.getUnprocessedFiles();
    
    for (const fileInfo of files) {
      this.processDataFile(fileInfo, onTradeData, onKlineData, onDepthData);
    }
  }

  getUnprocessedFiles() {
    try {
      return fs.readdirSync(this.dataPath)
        .filter(file => file.startsWith(`live_data_${this.interval}_`))
        .map(file => {
          const timestamp = parseInt(file.match(/live_data_.*_(\d+)\.json$/)?.[1] || '0');
          return {
            file,
            path: path.join(this.dataPath, file),
            timestamp
          };
        })
        .filter(fileInfo => fileInfo.timestamp > this.lastProcessedTimestamp)
        .sort((a, b) => a.timestamp - b.timestamp); // Process in chronological order
        
    } catch (error) {
      console.error(chalk.red('❌ Error reading data directory:'), error);
      return [];
    }
  }

processDataFile(fileInfo, onTradeData, onKlineData, onDepthData) {
  try {
    const data = JSON.parse(fs.readFileSync(fileInfo.path, 'utf8'));
    
    // Verify correct interval
    if (data.interval !== this.interval) {
      console.warn(`⚠️ Skipping file with wrong interval: ${data.interval} vs ${this.interval}`);
      return;
    }

    // Process trades
    if (data.trades && data.trades.length > 0) {
      for (const trade of data.trades) {
        onTradeData(trade.data);
      }
    }

    // Process klines
    if (data.klines && data.klines.length > 0) {
      for (const kline of data.klines) {
        onKlineData(kline.data);
      }
    }

    // FIX: Process depth updates to update order book manager
    if (data.depth && data.depth.length > 0) {
      for (const depth of data.depth) {
        // Call onDepthData with the raw depth data structure that order book manager expects
        const mockDepthMessage = {
          bids: depth.data.bids.map(bid => [bid.price.toString(), bid.quantity.toString()]),
          asks: depth.data.asks.map(ask => [ask.price.toString(), ask.quantity.toString()]),
          u: Date.now(), // Update ID
          s: data.symbol,
          E: depth.timestamp
        };
        onDepthData(mockDepthMessage);
      }
    }

    // Update last processed timestamp
    this.lastProcessedTimestamp = fileInfo.timestamp;
    
  } catch (error) {
    console.error(chalk.red(`❌ Error processing file ${fileInfo.file}:`), error);
  }
}

  stopReading() {
    this.isReading = false;
    console.log(chalk.blue('📖 Stopped reading live data files'));
  }
}
