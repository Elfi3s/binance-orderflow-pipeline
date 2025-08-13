// src/modules/cvd-analyzer.js
import { config } from '../../config.js';

export class CVDAnalyzer {
  constructor() {
    this.cvd = 0;                    // cumulative delta for current bar
    this.history = [];               // [{ t, cvd, close }]
    this.maxHistory = 500;           // keep last N points
    this.windowForTrend = 60 * 60 * 1000; // 1h trend window
  }

  resetCurrentBar() {
    this.cvd = 0;
  }

  // trade: { side: 'BUY'|'SELL', quantity: number, time: ms, price: number }
  onTrade(trade) {
    if (trade.side === 'BUY') this.cvd += trade.quantity;
    else this.cvd -= trade.quantity;
  }

  // Call on kline close
  onBarClose({ close, endTime }) {
    this.history.push({ t: endTime, cvd: this.cvd, close: parseFloat(close) });
    if (this.history.length > this.maxHistory) this.history.shift();
    const closedBarCvd = this.cvd;
    this.resetCurrentBar();
    return closedBarCvd;
  }

  // Simple linear regression slope
  slope(values) {
    const n = values.length;
    if (n < 3) return 0;
    const xs = [...Array(n).keys()];
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((s, y, i) => s + i * y, 0);
    const sumXX = xs.reduce((s, x) => s + x * x, 0);
    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) return 0;
    return (n * sumXY - sumX * sumY) / denom;
  }

  detectDivergence(now = Date.now()) {
    // Use last 1h of data points from history (bar closes plus we can append interim)
    const recent = this.history.filter(p => now - p.t <= this.windowForTrend);
    if (recent.length < 5) return null;

    const cvdSlope = this.slope(recent.map(r => r.cvd));
    const priceSlope = this.slope(recent.map(r => r.close));

    // Normalize slope by last values to get rough “directional strength”
    const norm = (v) => v; // Already relative per index; keep simple

    const c = { cvdSlope: norm(cvdSlope), priceSlope: norm(priceSlope) };

    if (c.cvdSlope > 0 && c.priceSlope < 0) {
      return { type: 'BULLISH_DIVERGENCE', strength: +(Math.abs(c.cvdSlope - c.priceSlope)).toFixed(4) };
    }
    if (c.cvdSlope < 0 && c.priceSlope > 0) {
      return { type: 'BEARISH_DIVERGENCE', strength: +(Math.abs(c.cvdSlope - c.priceSlope)).toFixed(4) };
    }
    return null;
  }

  getSnapshotStats() {
    return {
      cvd: +this.cvd.toFixed(4),
      lastHistory: this.history.length ? this.history[this.history.length - 1] : null
    };
  }
}
