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
initializeEmpty() {
  this.orderBook.bids.clear();
  this.orderBook.asks.clear();
  this.orderBook.lastUpdateId = 0;
  this.orderBook.isInitialized = true;
  console.log(chalk.green('✅ Empty order book initialized for file-based data'));
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
    this.pendingUpdates.push(depthData);
    if (this.pendingUpdates.length > 100) {
      this.initialize();
    }
    return false;
  }

  // For file-based data, be much more permissive with update sequence
  if (depthData.U && depthData.u) {
    // If we have sequence numbers, check basic validity
    if (depthData.U > depthData.u) {
      console.log(chalk.yellow('⚠️ Invalid depth data: U > u, skipping'));
      return false;
    }
    
    // Skip very old updates only if we have a much newer update ID
    if (this.orderBook.lastUpdateId > 0 && depthData.u < this.orderBook.lastUpdateId - 1000) {
      return false; // Skip very old data
    }
  }

  try {
    // Apply the update
    this.applyDepthUpdate(depthData);
    
    // Update sequence ID
    this.orderBook.lastUpdateId = Math.max(
      this.orderBook.lastUpdateId, 
      depthData.u || this.orderBook.lastUpdateId + 1
    );

    // Validate order book after update
    if (!this.validateOrderBook()) {
      console.log(chalk.red('❌ Order book validation failed after update - reinitializing'));
      this.initializeEmpty();
      return false;
    }

    return true;
  } catch (error) {
    console.error(chalk.red('❌ Error applying depth update:'), error);
    return false;
  }
}

validateOrderBook() {
  if (this.orderBook.bids.size === 0 || this.orderBook.asks.size === 0) {
    return true; // Empty is valid (just starting)
  }

  const bestBid = Math.max(...this.orderBook.bids.keys());
  const bestAsk = Math.min(...this.orderBook.asks.keys());
  
  if (bestBid >= bestAsk) {
    console.log(chalk.red(`❌ Invalid order book: bestBid (${bestBid}) >= bestAsk (${bestAsk})`));
    return false;
  }
  
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
