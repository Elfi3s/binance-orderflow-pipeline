// src/modules/absorption-detector.js - NEW FILE
export class AbsorptionDetector {
  constructor() {
    this.priceHistory = [];
    this.volumeHistory = [];
    this.maxHistory = 50;
    this.absorptionThreshold = 1000; // ETH volume threshold
  }

  onTrade(trade) {
    this.priceHistory.push({
      price: trade.price,
      time: trade.time,
      volume: trade.quantity,
      side: trade.side
    });

    if (this.priceHistory.length > this.maxHistory) {
      this.priceHistory.shift();
    }
  }

  detectAbsorption() {
    if (this.priceHistory.length < 10) return null;

    const recent = this.priceHistory.slice(-10);
    const priceRange = Math.max(...recent.map(t => t.price)) - Math.min(...recent.map(t => t.price));
    const totalVolume = recent.reduce((sum, t) => sum + t.volume, 0);
    const priceChange = Math.abs(recent[recent.length-1].price - recent.price);

    // Absorption: High volume, minimal price movement
    if (totalVolume > this.absorptionThreshold && priceChange < priceRange * 0.3) {
      const buyVolume = recent.filter(t => t.side === 'BUY').reduce((sum, t) => sum + t.volume, 0);
      const sellVolume = recent.filter(t => t.side === 'SELL').reduce((sum, t) => sum + t.volume, 0);
      
      return {
        type: 'ABSORPTION',
        signal: buyVolume > sellVolume ? 'BULLISH' : 'BEARISH',
        strength: Math.min(1.0, totalVolume / (this.absorptionThreshold * 3)),
        volume: totalVolume,
        priceChange: priceChange,
        buyVolume: buyVolume,
        sellVolume: sellVolume
      };
    }

    return null;
  }
}
