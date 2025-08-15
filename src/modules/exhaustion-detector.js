// src/modules/exhaustion-detector.js - NEW FILE
export class ExhaustionDetector {
  constructor() {
    this.priceMovements = [];
    this.volumeProfile = [];
    this.maxHistory = 50;
  }

  onBarClose(barData) {
    const movement = {
      priceChange: barData.ohlc.close - barData.ohlc.open,
      volume: barData.totalBuyVolume + barData.totalSellVolume,
      delta: barData.totalDelta,
      time: barData.endTime,
      range: barData.ohlc.high - barData.ohlc.low
    };

    this.priceMovements.push(movement);
    if (this.priceMovements.length > this.maxHistory) {
      this.priceMovements.shift();
    }

    return this.detectExhaustion();
  }

  detectExhaustion() {
    if (this.priceMovements.length < 5) return null;

    const recent = this.priceMovements.slice(-5);
    const current = recent[recent.length - 1];
    const previous = recent[recent.length - 2];

    // Check for volume increasing while price movement decreases
    const volumeIncrease = current.volume > previous.volume * 1.5;
    const priceMovementDecrease = Math.abs(current.priceChange) < Math.abs(previous.priceChange) * 0.5;
    const highVolume = current.volume > this.getAverageVolume() * 2;

    if (volumeIncrease && priceMovementDecrease && highVolume) {
      const trend = this.determineTrend();
      
      return {
        type: 'EXHAUSTION_PATTERN',
        signal: trend === 'UP' ? 'BEARISH' : 'BULLISH',
        strength: Math.min(1.0, current.volume / (this.getAverageVolume() * 5)),
        currentVolume: current.volume,
        avgVolume: this.getAverageVolume(),
        priceChange: current.priceChange,
        trend: trend,
        confidence: volumeIncrease && highVolume ? 'HIGH' : 'MEDIUM'
      };
    }

    return null;
  }

  determineTrend() {
    const recent = this.priceMovements.slice(-3);
    const priceChanges = recent.map(m => m.priceChange);
    const avgChange = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;
    
    return avgChange > 0 ? 'UP' : 'DOWN';
  }

  getAverageVolume() {
    if (this.priceMovements.length === 0) return 1000;
    return this.priceMovements.reduce((sum, m) => sum + m.volume, 0) / this.priceMovements.length;
  }
}
