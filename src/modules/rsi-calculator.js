// src\modules\rsi-calculator.js - SMA Version to match TradingView
import chalk from 'chalk';
import { config } from '../../config.js';

export class RSICalculator {
  constructor(period = 14) {
    this.period = period;
    this.closePrices = [];
    this.currentRSI = 50; // Default value
  }

  addClosePrice(closePrice, timestamp) {
    const price = parseFloat(closePrice);
    
    this.closePrices.push({
      price: price,
      timestamp: timestamp
    });

    // Keep only the data we need (period + some buffer)
    if (this.closePrices.length > this.period + 10) {
      this.closePrices.shift();
    }

    // Calculate RSI if we have enough data
    if (this.closePrices.length >= this.period + 1) {
      this.calculateRSI();
    }
  }

  calculateRSI() {
    if (this.closePrices.length < this.period + 1) {
      return this.currentRSI;
    }

    // Calculate price changes for the last (period + 1) prices
    const recentPrices = this.closePrices.slice(-(this.period + 1));
    const changes = [];
    
    for (let i = 1; i < recentPrices.length; i++) {
      const change = recentPrices[i].price - recentPrices[i - 1].price;
      changes.push(change);
    }

    // Separate gains and losses
    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? Math.abs(change) : 0);

    // Use SIMPLE MOVING AVERAGE (not Wilder's smoothing)
    const avgGain = gains.reduce((sum, gain) => sum + gain, 0) / this.period;
    const avgLoss = losses.reduce((sum, loss) => sum + loss, 0) / this.period;

    // Calculate RSI using SMA method
    if (avgLoss === 0) {
      this.currentRSI = 100;
    } else {
      const rs = avgGain / avgLoss;
      this.currentRSI = 100 - (100 / (1 + rs));
    }

    return this.currentRSI;
  }

  getRSI() {
    return Math.round(this.currentRSI * 100) / 100; // Round to 2 decimals
  }

  getStats() {
    return {
      rsi: this.getRSI(),
      dataPoints: this.closePrices.length,
      period: this.period,
      lastPrice: this.closePrices.length > 0 ? this.closePrices[this.closePrices.length - 1].price : null,
      trend: this.getRSI() > 50 ? 'BULLISH' : 'BEARISH',
      signal: this.getRSI() > 70 ? 'OVERBOUGHT' : this.getRSI() < 30 ? 'OVERSOLD' : 'NEUTRAL',
      method: 'SMA' // To match TradingView
    };
  }
}
