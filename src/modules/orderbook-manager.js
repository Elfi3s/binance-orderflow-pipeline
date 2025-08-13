// src\modules\orderbook-manager.js
import fetch from 'node-fetch';
import chalk from 'chalk';
import { config } from '../../config.js';

export class OrderBookManager {
  constructor() {
    this.orderBook = {
      bids: new Map(), // price -> quantity
      asks: new Map(), // price -> quantity
      lastUpdateId: 0,
      isInitialized: false
    };
    this.pendingUpdates = [];
    this.symbol = config.symbol;
  }

  async initialize() {
    console.log(chalk.yellow('📋 Initializing order book snapshot...'));
    
    try {
      // Get initial snapshot from REST API
      const response = await fetch(`${config.restUrls.futures}/fapi/v1/depth?symbol=${this.symbol}&limit=1000`);
      const snapshot = await response.json();
      
      if (snapshot.code) {
        throw new Error(`API Error: ${snapshot.msg}`);
      }

      // Initialize order book with snapshot
      this.orderBook.bids.clear();
      this.orderBook.asks.clear();
      
      // Process bids (highest price first)
      snapshot.bids.forEach(([price, quantity]) => {
        if (parseFloat(quantity) > 0) {
          this.orderBook.bids.set(parseFloat(price), parseFloat(quantity));
        }
      });
      
      // Process asks (lowest price first)
      snapshot.asks.forEach(([price, quantity]) => {
        if (parseFloat(quantity) > 0) {
          this.orderBook.asks.set(parseFloat(price), parseFloat(quantity));
        }
      });
      
      this.orderBook.lastUpdateId = snapshot.lastUpdateId;
      this.orderBook.isInitialized = true;
      
      console.log(chalk.green(`✅ Order book initialized with ${this.orderBook.bids.size} bids, ${this.orderBook.asks.size} asks`));
      console.log(chalk.gray(`Last Update ID: ${this.orderBook.lastUpdateId}`));
      
      // Process any pending updates
      this.processPendingUpdates();
      
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize order book:'), error);
      return false;
    }
  }

  handleDepthUpdate(depthData) {
    if (!this.orderBook.isInitialized) {
      // Store updates until we're initialized
      this.pendingUpdates.push(depthData);
      if (this.pendingUpdates.length > 100) {
        // Prevent memory leak - restart initialization
        this.initialize();
      }
      return false;
    }

    // Check if this update is in sequence
    if (depthData.U <= this.orderBook.lastUpdateId) {
      // Old update, ignore
      return false;
    }

    if (depthData.u < this.orderBook.lastUpdateId + 1) {
      // Gap detected - need to resync
      console.log(chalk.red(`⚠️ Order book sync gap detected. Expected: ${this.orderBook.lastUpdateId + 1}, Got: ${depthData.u}`));
      this.orderBook.isInitialized = false;
      this.initialize();
      return false;
    }

    // Apply the update
    this.applyDepthUpdate(depthData);
    this.orderBook.lastUpdateId = depthData.u;
    return true;
  }

  applyDepthUpdate(depthData) {
    // Update bids
    depthData.b.forEach(([price, quantity]) => {
      const priceNum = parseFloat(price);
      const quantityNum = parseFloat(quantity);
      
      if (quantityNum === 0) {
        this.orderBook.bids.delete(priceNum);
      } else {
        this.orderBook.bids.set(priceNum, quantityNum);
      }
    });

    // Update asks
    depthData.a.forEach(([price, quantity]) => {
      const priceNum = parseFloat(price);
      const quantityNum = parseFloat(quantity);
      
      if (quantityNum === 0) {
        this.orderBook.asks.delete(priceNum);
      } else {
        this.orderBook.asks.set(priceNum, quantityNum);
      }
    });
  }

  processPendingUpdates() {
    console.log(chalk.yellow(`📋 Processing ${this.pendingUpdates.length} pending updates...`));
    
    this.pendingUpdates
      .sort((a, b) => a.U - b.U) // Sort by first update ID
      .forEach(update => this.handleDepthUpdate(update));
    
    this.pendingUpdates = [];
  }

  getBestBidAsk() {
    const bestBid = Math.max(...this.orderBook.bids.keys());
    const bestAsk = Math.min(...this.orderBook.asks.keys());
    
    return {
      bid: isFinite(bestBid) ? bestBid : null,
      ask: isFinite(bestAsk) ? bestAsk : null,
      spread: isFinite(bestBid) && isFinite(bestAsk) ? bestAsk - bestBid : null
    };
  }

  getTopLevels(depth = 20) {
    // Get top N bids (highest prices first)
    const topBids = Array.from(this.orderBook.bids.entries())
      .sort(([a], [b]) => b - a) // Sort by price descending
      .slice(0, depth)
      .map(([price, quantity]) => ({ price, quantity }));

    // Get top N asks (lowest prices first) 
    const topAsks = Array.from(this.orderBook.asks.entries())
      .sort(([a], [b]) => a - b) // Sort by price ascending
      .slice(0, depth)
      .map(([price, quantity]) => ({ price, quantity }));

    return { bids: topBids, asks: topAsks };
  }

  getStats() {
    return {
      bidLevels: this.orderBook.bids.size,
      askLevels: this.orderBook.asks.size,
      lastUpdateId: this.orderBook.lastUpdateId,
      isInitialized: this.orderBook.isInitialized,
      ...this.getBestBidAsk()
    };
  }
}
