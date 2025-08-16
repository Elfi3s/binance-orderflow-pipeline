// src/modules/spread-analyzer.js - NEW FILE
export class SpreadAnalyzer {
  constructor() {
    this.spreadHistory = [];
    this.maxHistory = 200;
    this.normalSpreadWindow = 50; // Calculate normal spread over 50 updates
  }

  onDepthUpdate(orderBookManager) {
    const topLevels = orderBookManager.getTopLevels(5);
    if (!topLevels) return null;

    const spread = topLevels.asks[0].price - topLevels.bids.price;
    const midPrice = (topLevels.asks.price + topLevels.bids.price) / 2;
    
    this.spreadHistory.push({
      spread: spread,
      relativeSpread: spread / midPrice,
      timestamp: Date.now(),
      bidVolume: topLevels.bids.quantity,
      askVolume: topLevels.asks.quantity
    });

    if (this.spreadHistory.length > this.maxHistory) {
      this.spreadHistory.shift();
    }

    return this.analyzeSpread();
  }

  analyzeSpread() {
    if (this.spreadHistory.length < this.normalSpreadWindow) return null;

    const recent = this.spreadHistory.slice(-this.normalSpreadWindow);
    const current = recent[recent.length - 1];
    const normalSpread = this.calculateNormalSpread(recent.slice(0, -10)); // Exclude very recent

    const spreadRatio = current.spread / normalSpread;
    const relativeChange = (current.spread - normalSpread) / normalSpread;

    // Detect spread anomalies
    if (spreadRatio > 2.0) {
      return {
        type: 'WIDE_SPREAD_ANOMALY',
        signal: 'CAUTION', // Wide spread suggests low liquidity or volatility
        currentSpread: current.spread,
        normalSpread: normalSpread,
        spreadRatio: spreadRatio,
        strength: Math.min(1.0, spreadRatio / 5.0),
        implication: 'Low liquidity or impending volatility'
      };
    }

    if (spreadRatio < 0.3) {
      return {
        type: 'TIGHT_SPREAD_COMPRESSION',
        signal: 'NEUTRAL',
        currentSpread: current.spread,
        normalSpread: normalSpread,
        spreadRatio: spreadRatio,
        strength: Math.min(1.0, (1 - spreadRatio) * 2),
        implication: 'High liquidity, possible breakout pending'
      };
    }

    return null;
  }

  calculateNormalSpread(history) {
    if (history.length === 0) return 0.01; // Default spread
    return history.reduce((sum, h) => sum + h.spread, 0) / history.length;
  }

  getSpreadStats() {
    if (this.spreadHistory.length < 10) return null;

    const recent = this.spreadHistory.slice(-10);
    const current = recent[recent.length - 1];
    
    return {
      currentSpread: current.spread,
      avgSpread: recent.reduce((sum, h) => sum + h.spread, 0) / recent.length,
      minSpread: Math.min(...recent.map(h => h.spread)),
      maxSpread: Math.max(...recent.map(h => h.spread)),
      spreadVolatility: this.calculateSpreadVolatility(recent)
    };
  }

  calculateSpreadVolatility(history) {
    const avgSpread = history.reduce((sum, h) => sum + h.spread, 0) / history.length;
    const variance = history.reduce((sum, h) => sum + Math.pow(h.spread - avgSpread, 2), 0) / history.length;
    return Math.sqrt(variance);
  }
}
