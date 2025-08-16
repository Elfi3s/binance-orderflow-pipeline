// src/modules/vwap-deviation-analyzer.js - CREATE THIS FILE
export class VWAPDeviationAnalyzer {
  constructor() {
    this.trades = [];
    this.maxTrades = 1000;
    this.standardDeviations = [0.5, 1.0, 1.5, 2.0];
  }

  onTrade(trade) {
    this.trades.push({
      price: trade.price,
      volume: trade.quantity,
      time: trade.time
    });

    if (this.trades.length > this.maxTrades) {
      this.trades.shift();
    }

    return this.calculateDeviationSignals();
  }

  calculateVWAP() {
    if (this.trades.length === 0) return null;

    const totalVolumePrice = this.trades.reduce((sum, trade) => sum + (trade.price * trade.volume), 0);
    const totalVolume = this.trades.reduce((sum, trade) => sum + trade.volume, 0);
    
    return totalVolumePrice / totalVolume;
  }

  calculateDeviationBands() {
    const vwap = this.calculateVWAP();
    if (!vwap) return null;

    // Calculate variance
    const totalVolume = this.trades.reduce((sum, trade) => sum + trade.volume, 0);
    const variance = this.trades.reduce((sum, trade) => {
      const diff = trade.price - vwap;
      return sum + (trade.volume * diff * diff);
    }, 0) / totalVolume;
    
    const stdDev = Math.sqrt(variance);

    const bands = {};
    this.standardDeviations.forEach(multiplier => {
      bands[`upper${multiplier}`] = vwap + (stdDev * multiplier);
      bands[`lower${multiplier}`] = vwap - (stdDev * multiplier);
    });

    return { vwap, stdDev, bands };
  }

  calculateDeviationSignals() {
    const metrics = this.calculateDeviationBands();
    if (!metrics || this.trades.length === 0) return null;

    const latestPrice = this.trades[this.trades.length - 1].price;
    const signals = [];

    // Check for deviation signals
    if (latestPrice > metrics.bands.upper2) {
      signals.push({
        type: 'EXTREME_OVEREXTENSION',
        signal: 'BEARISH_REVERSION',
        level: 2.0,
        price: latestPrice,
        vwap: metrics.vwap,
        deviation: (latestPrice - metrics.vwap) / metrics.stdDev
      });
    } else if (latestPrice < metrics.bands.lower2) {
      signals.push({
        type: 'EXTREME_UNDEREXTENSION', 
        signal: 'BULLISH_REVERSION',
        level: 2.0,
        price: latestPrice,
        vwap: metrics.vwap,
        deviation: (metrics.vwap - latestPrice) / metrics.stdDev
      });
    } else if (latestPrice > metrics.bands.upper1) {
      signals.push({
        type: 'OVEREXTENSION',
        signal: 'BEARISH_WARNING',
        level: 1.0,
        price: latestPrice,
        vwap: metrics.vwap
      });
    } else if (latestPrice < metrics.bands.lower1) {
      signals.push({
        type: 'UNDEREXTENSION',
        signal: 'BULLISH_WARNING', 
        level: 1.0,
        price: latestPrice,
        vwap: metrics.vwap
      });
    }

    return signals.length > 0 ? { signals, metrics } : null;
  }
}
