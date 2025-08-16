// src/modules/bar-aggregator.js - COMPLETE REPLACEMENT
import chalk from 'chalk';
import { config } from '../../config.js';
import { TimezoneFormatter } from '../utils/timezone-formatter.js';
export class BarAggregator {
  constructor() {
    this.currentBar = null;
    this.completedBars = [];
    
    // FIX: Use config interval dynamically instead of hardcoded 4H
    this.interval = this.parseIntervalToMs(config.interval);
    this.intervalDisplay = config.interval.toUpperCase();
  }

  // NEW: Parse interval string to milliseconds
  parseIntervalToMs(interval) {
    const matches = interval.match(/^(\d+)([smhd])$/);
    if (!matches) throw new Error(`Invalid interval format: ${interval}`);
    
    const value = parseInt(matches[1]);
    const unit = matches[2];
    
    const multipliers = {
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000
    };
    
    return value * multipliers[unit];
  }

  // Check if we need a new bar based on kline data
  handleKlineUpdate(klineData) {
    const kline = klineData.k;
    const barStart = kline.t;
    const barEnd = kline.T;
    const isClosed = kline.x;

    // Initialize or update current bar
    if (!this.currentBar || this.currentBar.startTime !== barStart) {
      this.startNewBar(barStart, barEnd);
    }

    // Update bar with kline data
    this.currentBar.ohlc = {
      open: parseFloat(kline.o),
      high: parseFloat(kline.h),
      low: parseFloat(kline.l),
      close: parseFloat(kline.c)
    };
    this.currentBar.volume = parseFloat(kline.v);
    this.currentBar.trades = parseInt(kline.n);
    this.currentBar.lastUpdate = Date.now();

    if (isClosed) {
      console.log(chalk.magenta(`🔥 ${this.intervalDisplay} Bar Closed - Finalizing bar data...`));
      return this.finalizeCurrentBar();
    }

    return null; // Bar not closed yet
  }

  startNewBar(startTime, endTime) {
    // Archive previous bar if exists
    if (this.currentBar) {
      this.completedBars.push(this.currentBar);
      // Keep appropriate number of bars based on interval
      const maxBars = this.getMaxBarsToKeep();
      if (this.completedBars.length > maxBars) {
        this.completedBars.shift();
      }
    }

    this.currentBar = {
      startTime: startTime,
      endTime: endTime,
      ohlc: { open: 0, high: 0, low: 0, close: 0 },
      volume: 0,
      trades: 0,
      
      // Footprint data (will be populated by other modules)
      footprint: new Map(), // price -> {buyQty, sellQty, delta}
      totalBuyVolume: 0,
      totalSellVolume: 0,
      totalDelta: 0,
      
      // Analysis data
      poc: { price: 0, volume: 0 },
      imbalances: [],
      
      lastUpdate: Date.now()
    };

    console.log(chalk.blue(`📊 Started new ${this.intervalDisplay} bar:`), {
      start: new Date(startTime).toISOString(),
      end: new Date(endTime).toISOString()
    });

    return this.currentBar;
  }

  // NEW: Calculate max bars to keep based on interval
  getMaxBarsToKeep() {
    const intervalMs = this.interval;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const barsPerDay = oneDayMs / intervalMs;
    return Math.ceil(barsPerDay * 4); // Keep 4 days worth of bars
  }

  // Add trade data to current bar for footprint calculation
  addTradeToBar(classifiedTrade) {
    if (!this.currentBar) {
      console.log(chalk.yellow('⚠️ No current bar to add trade to'));
      return;
    }

    // Check if trade belongs to current bar
    if (classifiedTrade.time < this.currentBar.startTime || 
        classifiedTrade.time > this.currentBar.endTime) {
      console.log(chalk.yellow('⚠️ Trade outside current bar timeframe'));
      return;
    }

    // Round price to tick size
    const price = Math.round(classifiedTrade.price / config.tickSize) * config.tickSize;

    // Initialize price level if doesn't exist
    if (!this.currentBar.footprint.has(price)) {
      this.currentBar.footprint.set(price, {
        buyQty: 0,
        sellQty: 0,
        delta: 0
      });
    }

    const priceLevel = this.currentBar.footprint.get(price);

    // Add volume to appropriate side
    if (classifiedTrade.side === 'BUY') {
      priceLevel.buyQty += classifiedTrade.quantity;
      this.currentBar.totalBuyVolume += classifiedTrade.quantity;
    } else {
      priceLevel.sellQty += classifiedTrade.quantity;
      this.currentBar.totalSellVolume += classifiedTrade.quantity;
    }

    // Update delta
    priceLevel.delta = priceLevel.buyQty - priceLevel.sellQty;
    this.currentBar.totalDelta = this.currentBar.totalBuyVolume - this.currentBar.totalSellVolume;

    // Update point of control (POC) - highest volume price
    const totalVolume = priceLevel.buyQty + priceLevel.sellQty;
    if (totalVolume > this.currentBar.poc.volume) {
      this.currentBar.poc = { price: price, volume: totalVolume };
    }
  }

  finalizeCurrentBar() {
    if (!this.currentBar) return null;

    const finalizedBar = { ...this.currentBar };
    
    // Convert footprint Map to array for JSON serialization
    finalizedBar.footprintArray = Array.from(this.currentBar.footprint.entries())
      .map(([price, data]) => ({
        price: price,
        buyQty: data.buyQty,
        sellQty: data.sellQty,
        delta: data.delta
      }))
      .sort((a, b) => b.price - a.price); // Sort by price descending


        // ADD START AND END TIME TO BAR CLOSE MESSAGE
  console.log(chalk.magenta(`🔥 ${this.intervalDisplay} Bar Closed - ${TimezoneFormatter.getCurrentTime()}`));
  console.log(chalk.cyan(`📅 Bar Period: ${TimezoneFormatter.formatTime(finalizedBar.startTime)} to ${TimezoneFormatter.formatTime(finalizedBar.endTime)}`));
  
    console.log(chalk.green('✅ Bar finalized:'), {
      duration: this.intervalDisplay,
      footprintLevels: finalizedBar.footprintArray.length,
      totalBuyVolume: finalizedBar.totalBuyVolume.toFixed(2),
      totalSellVolume: finalizedBar.totalSellVolume.toFixed(2),
      totalDelta: finalizedBar.totalDelta.toFixed(2),
      poc: `${finalizedBar.poc.price} (${finalizedBar.poc.volume.toFixed(2)})`
    });

    return finalizedBar;
  }

  getCurrentBar() {
    return this.currentBar;
  }

  getCompletedBars() {
    return this.completedBars;
  }
}
