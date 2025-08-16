// src/modules/enhanced-dom-analyzer.js - COMPLETELY REPLACE with cooldown system:

export class EnhancedDOMAnalyzer {
  constructor() {
    this.domHistory = [];
    this.maxHistory = 100;
    this.spoofingThreshold = 1000;
    
    // ADD AGGRESSIVE COOLDOWN SYSTEM
    this.lastAnalysisTime = 0;
    this.analysisCooldown = 10000; // 10 seconds between analysis
    this.lastSignalType = null;
    this.lastSignalTime = 0;
    this.signalCooldown = 15000; // 15 seconds between same signal types
  }

  onDepthUpdate(depthData, orderBookManager) {
    const now = Date.now();
    
    // AGGRESSIVE COOLDOWN - Only analyze every 10 seconds
    if (now - this.lastAnalysisTime < this.analysisCooldown) {
      return null;
    }
    this.lastAnalysisTime = now;

    const topLevels = orderBookManager.getTopLevels(20);
    if (!topLevels) return null;

    const domSnapshot = {
      timestamp: now,
      bids: topLevels.bids.slice(0, 10),
      asks: topLevels.asks.slice(0, 10),
      totalBidVolume: topLevels.bids.reduce((sum, level) => sum + level.quantity, 0),
      totalAskVolume: topLevels.asks.reduce((sum, level) => sum + level.quantity, 0),
      spread: topLevels.asks[0].price - topLevels.bids[0].price
    };

    this.domHistory.push(domSnapshot);
    if (this.domHistory.length > this.maxHistory) {
      this.domHistory.shift();
    }

    return this.analyzeDOMPatterns(domSnapshot, now);
  }

  analyzeDOMPatterns(currentDOM, now) {
    const patterns = [];

    // Only analyze liquidity imbalance - remove other spammy analyses
    const imbalance = this.detectLiquidityImbalance(currentDOM, now);
    if (imbalance) patterns.push(imbalance);

    return patterns.length > 0 ? patterns : null;
  }

  detectLiquidityImbalance(currentDOM, now) {
    const ratio = currentDOM.totalBidVolume / currentDOM.totalAskVolume;
    
    // MUCH STRICTER THRESHOLDS AND COOLDOWNS
    let signalType = null;
    
    if (ratio > 10.0 && currentDOM.totalBidVolume > 2000) { // MUCH HIGHER thresholds
      signalType = 'EXTREME_BID_LIQUIDITY';
    } else if (ratio < 0.1 && currentDOM.totalAskVolume > 2000) {
      signalType = 'EXTREME_ASK_LIQUIDITY';  
    }
    
    // Only signal if significant AND not recently signaled
    if (signalType && 
        (this.lastSignalType !== signalType || now - this.lastSignalTime > this.signalCooldown)) {
      
      this.lastSignalType = signalType;
      this.lastSignalTime = now;
      
      return {
        type: signalType,
        signal: signalType === 'EXTREME_BID_LIQUIDITY' ? 'BULLISH' : 'BEARISH',
        ratio: ratio,
        bidVolume: currentDOM.totalBidVolume,
        askVolume: currentDOM.totalAskVolume,
        strength: Math.min(1.0, ratio > 10 ? (ratio - 10) / 20 : (0.1 - ratio) / 0.09)
      };
    }

    return null;
  }

  getDOMStats() {
    if (this.domHistory.length === 0) return null;

    const current = this.domHistory[this.domHistory.length - 1];
    const avgSpread = this.domHistory.reduce((sum, dom) => sum + dom.spread, 0) / this.domHistory.length;

    return {
      currentSpread: current.spread,
      avgSpread: avgSpread,
      spreadRatio: current.spread / avgSpread,
      liquidityRatio: current.totalBidVolume / current.totalAskVolume,
      totalLiquidity: current.totalBidVolume + current.totalAskVolume
    };
  }
}
