// src/modules/market-sweep-detector.js - CREATE THIS FILE
export class MarketSweepDetector {
  constructor() {
    this.sweepHistory = [];
    this.maxHistory = 100;
    this.minSweepSize = 50; // ETH threshold
  }

  onTrade(trade) {
    const sweeps = this.detectSweep(trade);
    if (sweeps.length > 0) {
      this.sweepHistory.push(...sweeps);
      if (this.sweepHistory.length > this.maxHistory) {
        this.sweepHistory = this.sweepHistory.slice(-this.maxHistory);
      }
      return sweeps;
    }
    return null;
  }

  detectSweep(trade) {
    const sweeps = [];
    
    // Look for large volume trades that clear multiple price levels
    if (trade.quantity > this.minSweepSize) {
      const sweepType = trade.classification === 'AGGRESSIVE_BUY' ? 'UPWARD_SWEEP' : 
                       trade.classification === 'AGGRESSIVE_SELL' ? 'DOWNWARD_SWEEP' : null;
      
      if (sweepType) {
        sweeps.push({
          type: sweepType,
          signal: trade.side === 'BUY' ? 'BULLISH' : 'BEARISH',
          price: trade.price,
          volume: trade.quantity,
          time: trade.time,
          strength: Math.min(1.0, trade.quantity / (this.minSweepSize * 3))
        });
      }
    }
    
    return sweeps;
  }

  getSweepStats() {
    if (this.sweepHistory.length === 0) return null;
    
    const recent = this.sweepHistory.filter(s => Date.now() - s.time < 300000); // Last 5 minutes
    const bullishSweeps = recent.filter(s => s.signal === 'BULLISH');
    const bearishSweeps = recent.filter(s => s.signal === 'BEARISH');
    
    return {
      total: recent.length,
      bullish: bullishSweeps.length,
      bearish: bearishSweeps.length,
      netSentiment: bullishSweeps.length - bearishSweeps.length,
      avgVolume: recent.reduce((sum, s) => sum + s.volume, 0) / recent.length || 0
    };
  }
}
