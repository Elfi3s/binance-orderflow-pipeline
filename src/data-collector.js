// src/data-collector.js - NEW FILE (COMPLETE)
import WebSocket from 'ws';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { OrderBookManager } from './modules/orderbook-manager.js';
import { TradeClassifier } from './modules/trade-classifier.js';

class BinanceDataCollector {
  constructor() {
    this.symbol = config.symbol.toLowerCase();
    this.interval = config.interval;
    this.connections = new Map();
    
    // Only modules needed for data collection
    this.orderBookManager = new OrderBookManager();
    this.tradeClassifier = new TradeClassifier(this.orderBookManager);
    
    // Data storage paths
    this.dataPath = path.resolve(`./data/live/${this.interval}`);
    this.currentDataFile = null;
    this.dataBuffer = {
      trades: [],
      klines: [],
      depth: []
    };
    
    this.flushInterval = 3000; // Flush every 3 seconds
    this.maxBufferSize = 1000; // Max items before force flush
    
    this.ensureDataDirectories();
    console.log(chalk.blue(`🔄 Data Collector Started - ${config.symbol} ${this.interval.toUpperCase()}`));
  }

  ensureDataDirectories() {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
      console.log(chalk.green(`✅ Created data directory: ${this.dataPath}`));
    }
  }

  async start() {
    try {
      await this.orderBookManager.initialize();
      await this.connectWebSockets();
      
      // Start periodic data flushing
      this.startDataFlushing();
      
      console.log(chalk.green('✅ Data collection active - streams connected'));
      console.log(chalk.gray(`📁 Saving to: ${this.dataPath}`));
      console.log(chalk.yellow('⚠️  Keep this running continuously!'));
      
    } catch (error) {
      console.error(chalk.red('❌ Data collector startup failed:'), error);
    }
  }

  startDataFlushing() {
    setInterval(() => {
      this.flushDataToDisk();
    }, this.flushInterval);
  }

  flushDataToDisk() {
    const now = Date.now();
    
    // Only flush if we have data
    if (this.dataBuffer.trades.length === 0 && 
        this.dataBuffer.klines.length === 0 && 
        this.dataBuffer.depth.length === 0) {
      return;
    }

    const filename = `live_data_${this.interval}_${now}.json`;
    const filepath = path.join(this.dataPath, filename);
    
    const dataPacket = {
      timestamp: now,
      interval: this.interval,
      symbol: config.symbol,
      trades: this.dataBuffer.trades,
      klines: this.dataBuffer.klines,
      depth: this.dataBuffer.depth
    };

    try {
      fs.writeFileSync(filepath, JSON.stringify(dataPacket));
      
      // Clear buffers
      this.dataBuffer.trades = [];
      this.dataBuffer.klines = [];
      this.dataBuffer.depth = [];
      
      // Clean up old files (keep only last 100 files)
      this.cleanupOldFiles();
      
      console.log(chalk.gray(`💾 Flushed data: ${this.dataBuffer.trades.length + this.dataBuffer.klines.length + this.dataBuffer.depth.length} items`));
    } catch (error) {
      console.error(chalk.red('❌ Failed to save data:'), error);
    }
  }

  cleanupOldFiles() {
    try {
      const files = fs.readdirSync(this.dataPath)
        .filter(file => file.startsWith(`live_data_${this.interval}_`))
        .map(file => ({
          file,
          path: path.join(this.dataPath, file),
          timestamp: parseInt(file.match(/live_data_.*_(\d+)\.json$/)?.[1] || '0')
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      if (files.length > 100) {
        const filesToDelete = files.slice(100);
        for (const fileInfo of filesToDelete) {
          fs.unlinkSync(fileInfo.path);
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  async connectWebSockets() {
    this.connectKlineStream();
    this.connectAggTradeStream();
    this.connectDepthStream();
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  connectKlineStream() {
    const klineUrl = `${config.wsUrls.futures}/ws/${this.symbol}@kline_${config.interval}`;
    const ws = new WebSocket(klineUrl);

    ws.on('open', () => {
      console.log(chalk.green('✅ Kline collection stream connected'));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.dataBuffer.klines.push({
          timestamp: Date.now(),
          data: message
        });
        
        // Force flush if buffer too large
        if (this.dataBuffer.klines.length > this.maxBufferSize) {
          this.flushDataToDisk();
        }
      } catch (error) {
        console.error(chalk.red('❌ Kline collection error:'), error);
      }
    });

    ws.on('error', (error) => {
      console.error(chalk.red('❌ Kline WebSocket error:'), error);
    });

    this.connections.set('kline', ws);
  }

  connectAggTradeStream() {
    const tradeUrl = `${config.wsUrls.futures}/ws/${this.symbol}@aggTrade`;
    const ws = new WebSocket(tradeUrl);

    ws.on('open', () => {
      console.log(chalk.green('✅ Trade collection stream connected'));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        const classifiedTrade = this.tradeClassifier.classifyTrade(message);
        
        this.dataBuffer.trades.push({
          timestamp: Date.now(),
          data: classifiedTrade
        });
        
        // Force flush if buffer too large
        if (this.dataBuffer.trades.length > this.maxBufferSize) {
          this.flushDataToDisk();
        }
      } catch (error) {
        console.error(chalk.red('❌ Trade collection error:'), error);
      }
    });

    this.connections.set('trade', ws);
  }

  connectDepthStream() {
    const depthUrl = `${config.wsUrls.futures}/ws/${this.symbol}@depth@100ms`;
    const ws = new WebSocket(depthUrl);

    ws.on('open', () => {
      console.log(chalk.green('✅ Depth collection stream connected'));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.orderBookManager.handleDepthUpdate(message);
        
        // Store top 5 levels only to save space
        const topLevels = this.orderBookManager.getTopLevels(5);
        if (topLevels) {
          this.dataBuffer.depth.push({
            timestamp: Date.now(),
            data: {
              bids: topLevels.bids,
              asks: topLevels.asks,
              spread: topLevels.asks[0].price - topLevels.bids.price
            }
          });
        }
        
        // Force flush if buffer too large
        if (this.dataBuffer.depth.length > this.maxBufferSize) {
          this.flushDataToDisk();
        }
      } catch (error) {
        console.error(chalk.red('❌ Depth collection error:'), error);
      }
    });

    this.connections.set('depth', ws);
  }

  close() {
    console.log(chalk.yellow('🔌 Shutting down data collector...'));
    
    // Final data flush
    this.flushDataToDisk();
    
    // Close connections
    for (const [name, ws] of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    
    console.log(chalk.blue('👋 Data collector stopped'));
  }
}

// Start the collector
const collector = new BinanceDataCollector();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n🛑 Stopping data collector...'));
  collector.close();
  setTimeout(() => process.exit(0), 2000);
});

process.on('SIGTERM', () => {
  collector.close();
  setTimeout(() => process.exit(0), 2000);
});

collector.start();
