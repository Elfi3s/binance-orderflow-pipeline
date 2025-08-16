// src/modules/momentum-shift-detector.js - NEW FILE
export class MomentumShiftDetector {
  constructor() {
    this.tradeFlow = [];
    this.maxHistory = 100;
    this.momentumWindow = 30; // 30 trades window
  }

  onTrade(trade) {
    this.tradeFlow.push({
      price: trade.price,
      quantity: trade.quantity,
      side: trade.side,
      time: trade.time,
      aggressiveness: trade.classification === 'MARKET' ? 1 : 0.5
    });

    if (this.tradeFlow.length > this.maxHistory) {
      this.tradeFlow.shift();
    }

    return this.detectMomentumShift();
  }

  detectMomentumShift() {
    if (this.tradeFlow.length < this.momentumWindow) return null;

    const recent = this.tradeFlow.slice(-this.momentumWindow);
    const firstHalf = recent.slice(0, Math.floor(this.momentumWindow / 2));
    const secondHalf = recent.slice(Math.floor(this.momentumWindow / 2));

    // Calculate weighted momentum for each half
    const firstMomentum = this.calculateWeightedMomentum(firstHalf);
    const secondMomentum = this.calculateWeightedMomentum(secondHalf);

    const momentumChange = secondMomentum - firstMomentum;
    const significance = Math.abs(momentumChange);

    if (significance > 0.3) { // Significant shift threshold
      return {
        type: 'MOMENTUM_SHIFT',
        signal: momentumChange > 0 ? 'BULLISH' : 'BEARISH',
        strength: Math.min(1.0, significance),
        magnitude: momentumChange,
        firstHalfMomentum: firstMomentum,
        secondHalfMomentum: secondMomentum,
        confidence: significance > 0.6 ? 'HIGH' : 'MEDIUM'
      };
    }

    return null;
  }

  calculateWeightedMomentum(trades) {
    let momentum = 0;
    let totalWeight = 0;

    for (const trade of trades) {
      const weight = trade.quantity * trade.aggressiveness;
      const contribution = trade.side === 'BUY' ? weight : -weight;
      momentum += contribution;
      totalWeight += weight;
    }

    return totalWeight > 0 ? momentum / totalWeight : 0;
  }
}
