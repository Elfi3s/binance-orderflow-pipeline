// src/modules/price-rejection-detector.js - NEW FILE
import { config } from '../../config.js';
export class PriceRejectionDetector {
  constructor() {
    this.priceHistory = [];
    this.rejectionLevels = new Map(); // price -> rejectionCount
    this.rejectionThreshold = 3; // Number of rejections to confirm level
    this.priceToleranceTicks = 2; // Price clustering tolerance
  }

  onTrade(trade) {
    this.priceHistory.push({
      price: trade.price,
      volume: trade.quantity,
      side: trade.side,
      time: trade.time
    });

    // Keep only recent trades
    const cutoff = Date.now() - (5 * 60 * 1000); // 5 minutes
    this.priceHistory = this.priceHistory.filter(t => t.time > cutoff);

    return this.detectRejection();
  }

  detectRejection() {
    if (this.priceHistory.length < 10) return null;

    const recent = this.priceHistory.slice(-10);
    const priceRange = Math.max(...recent.map(t => t.price)) - Math.min(...recent.map(t => t.price));
    
    // Look for price bounces (quick reversals)
    const latest = recent[recent.length - 1];
    const previous = recent[recent.length - 2];
    
    // Check for sharp reversal pattern
    const highestInRange = Math.max(...recent.slice(-5).map(t => t.price));
    const lowestInRange = Math.min(...recent.slice(-5).map(t => t.price));
    
    // Upper rejection (hit high and came down fast)
    if (latest.price < highestInRange - (priceRange * 0.3) && 
        recent.some(t => t.price === highestInRange)) {
      
      this.updateRejectionLevel(highestInRange);
      
      return {
        type: 'UPPER_REJECTION',
        signal: 'BEARISH',
        rejectionPrice: highestInRange,
        currentPrice: latest.price,
        strength: Math.min(1.0, (highestInRange - latest.price) / priceRange),
        rejectionCount: this.rejectionLevels.get(this.roundToLevel(highestInRange)) || 1,
        confidence: this.rejectionLevels.get(this.roundToLevel(highestInRange)) >= this.rejectionThreshold ? 'HIGH' : 'MEDIUM'
      };
    }

    // Lower rejection (hit low and bounced up fast)
    if (latest.price > lowestInRange + (priceRange * 0.3) && 
        recent.some(t => t.price === lowestInRange)) {
      
      this.updateRejectionLevel(lowestInRange);
      
      return {
        type: 'LOWER_REJECTION',
        signal: 'BULLISH',
        rejectionPrice: lowestInRange,
        currentPrice: latest.price,
        strength: Math.min(1.0, (latest.price - lowestInRange) / priceRange),
        rejectionCount: this.rejectionLevels.get(this.roundToLevel(lowestInRange)) || 1,
        confidence: this.rejectionLevels.get(this.roundToLevel(lowestInRange)) >= this.rejectionThreshold ? 'HIGH' : 'MEDIUM'
      };
    }

    return null;
  }

  roundToLevel(price) {
    return Math.round(price / (config.tickSize * this.priceToleranceTicks)) * (config.tickSize * this.priceToleranceTicks);
  }

  updateRejectionLevel(price) {
    const level = this.roundToLevel(price);
    const count = this.rejectionLevels.get(level) || 0;
    this.rejectionLevels.set(level, count + 1);
  }

  getActiveRejectionLevels() {
    return Array.from(this.rejectionLevels.entries())
      .filter(([price, count]) => count >= this.rejectionThreshold)
      .map(([price, count]) => ({ price, rejectionCount: count }))
      .sort((a, b) => b.rejectionCount - a.rejectionCount);
  }
}
