// src/analysis-engine.js - NEW FILE
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { config } from '../config.js';
import { BarAggregator } from './modules/bar-aggregator.js';
import { RSICalculator } from './modules/rsi-calculator.js';
// ... other analysis modules

class OrderFlowAnalysisEngine {
  constructor() {
    this.interval = config.interval;
    this.dataPath = path.resolve(`./data/realtime/${this.interval}`);
    this.lastProcessedTimestamp = this.loadLastProcessedTimestamp();
    
    // Analysis modules
    this.barAggregator = new BarAggregator();
    this.rsiCalculator = new RSICalculator(config.rsiPeriod);
    // ... initialize other modules
    
    // Enhanced real-time analyzers (improved versions)
    this.orderFlowMomentum = new OrderFlowMomentumAnalyzer();
    this.domPressureAnalyzer = new DOMPressureAnalyzer();
    this.volumeFlowAnalyzer = new VolumeFlowAnalyzer();
    
    console.log(chalk.blue(`🧠 Analysis Engine Started - ${config.symbol} ${this.interval.toUpperCase()}`));
  }

  start() {
    // Process historical data first
    this.processHistoricalData();
    
    // Start real-time processing
    setInterval(() => {
      this.processNewData();
    }, 2000); // Process every 2 seconds
    
    // Generate analysis summaries
    setInterval(() => {
      this.generateAnalysisSummary();
    }, 30000); // Summary every 30 seconds
  }

  processNewData() {
    const newTradeFiles = this.getNewFiles('trades');
    const newDepthFiles = this.getNewFiles('depth');
    
    for (const file of newTradeFiles) {
      this.processTradeFile(file);
    }
    
    for (const file of newDepthFiles) {
      this.processDepthFile(file);
    }
    
    this.updateLastProcessedTimestamp();
  }

  processTradeFile(filepath) {
    try {
      const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      
      for (const trade of data.trades) {
        // Feed to analyzers
        this.orderFlowMomentum.onTrade(trade.data);
        this.volumeFlowAnalyzer.onTrade(trade.data);
        this.barAggregator.addTradeToBar(trade.data);
      }
    } catch (error) {
      console.error(`Error processing trade file ${filepath}:`, error);
    }
  }

  processDepthFile(filepath) {
    try {
      const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      
      for (const depth of data.depths) {
        this.domPressureAnalyzer.onDepthUpdate(depth.data);
      }
    } catch (error) {
      console.error(`Error processing depth file ${filepath}:`, error);
    }
  }
}
