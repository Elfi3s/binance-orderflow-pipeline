// src/modules/volume-anomaly-detector.js - NEW FILE
export class VolumeAnomalyDetector {
  constructor() {
    this.volumeHistory = [];
    this.blockThreshold = 100; // ETH block trade threshold
    this.maxHistory = 100;
    this.decayFactor = 0.95; // Decay factor for historical impact
  }

  onTrade(trade) {
    this.volumeHistory.push({
      volume: trade.quantity,
      price: trade.price,
      side: trade.side,
      time: trade.time,
      isBlock: trade.quantity >= this.blockThreshold
    });

    if (this.volumeHistory.length > this.maxHistory) {
      this.volumeHistory.shift();
    }

    return this.analyzeVolumeAnomaly();
  }

  analyzeVolumeAnomaly() {
    if (this.volumeHistory.length < 20) return null;

    const recent = this.volumeHistory.slice(-20);
    const avgVolume = recent.reduce((sum, t) => sum + t.volume, 0) / recent.length;
    const latestTrade = recent[recent.length - 1];

    // Detect block trades
    if (latestTrade.volume >= this.blockThreshold) {
      const blockTrades = recent.filter(t => t.isBlock);
      const blockVolume = blockTrades.reduce((sum, t) => sum + t.volume, 0);
      
      return {
        type: 'BLOCK_TRADE_CLUSTER',
        signal: latestTrade.side === 'BUY' ? 'BULLISH' : 'BEARISH',
        strength: Math.min(1.0, latestTrade.volume / (this.blockThreshold * 5)),
        tradeVolume: latestTrade.volume,
        clusterVolume: blockVolume,
        clusterCount: blockTrades.length,
        avgVolume: avgVolume
      };
    }

    // Detect volume spikes
    if (latestTrade.volume > avgVolume * 3) {
      return {
        type: 'VOLUME_SPIKE',
        signal: latestTrade.side === 'BUY' ? 'BULLISH' : 'BEARISH',
        strength: Math.min(1.0, latestTrade.volume / (avgVolume * 10)),
        tradeVolume: latestTrade.volume,
        avgVolume: avgVolume,
        multiplier: latestTrade.volume / avgVolume
      };
    }

    return null;
  }

  getCumulativeBlockImpact() {
    const now = Date.now();
    let cumulativeImpact = 0;
    
    for (let i = this.volumeHistory.length - 1; i >= 0; i--) {
      const trade = this.volumeHistory[i];
      if (trade.isBlock) {
        const timeDecay = Math.pow(this.decayFactor, (now - trade.time) / 60000); // Decay per minute
        const impact = (trade.volume / this.blockThreshold) * timeDecay;
        cumulativeImpact += trade.side === 'BUY' ? impact : -impact;
      }
    }
    
    return cumulativeImpact;
  }
}
