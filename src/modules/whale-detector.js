// src/modules/whale-detector.js
export class WhaleDetector {
  constructor() {
    this.recentTrades = []; // ring buffer of recent trades
    this.maxTrades = 5_000;
    this.stdWindow = 1_000; // compute stats over last 1,000 trades
    this.lastDetection = null;
    this.minClusterWindowMs = 30_000; // cluster over last 30s
    this.minZScore = 3; // 3-sigma for whale threshold
  }

  onTrade(trade) {
    // trade: { quantity, side, price, time }
    this.recentTrades.push(trade);
    if (this.recentTrades.length > this.maxTrades) this.recentTrades.shift();
  }

  stats() {
    const tail = this.recentTrades.slice(-this.stdWindow);
    if (tail.length === 0) return { mean: 0, std: 0 };
    const vols = tail.map(t => t.quantity);
    const mean = vols.reduce((a, b) => a + b, 0) / vols.length;
    const variance = vols.reduce((s, v) => s + (v - mean) * (v - mean), 0) / vols.length;
    const std = Math.sqrt(variance);
    return { mean, std };
  }

  detectCluster(now = Date.now()) {
    const since = now - this.minClusterWindowMs;
    const window = this.recentTrades.filter(t => t.time >= since);
    if (window.length === 0) return { detected: false };

    const { mean, std } = this.stats();
    const threshold = mean + this.minZScore * (std || 1e-9);

    const large = window.filter(t => t.quantity >= threshold);
    if (large.length === 0) return { detected: false };

    const buyVol = large.filter(t => t.side === 'BUY').reduce((s, t) => s + t.quantity, 0);
    const sellVol = large.filter(t => t.side === 'SELL').reduce((s, t) => s + t.quantity, 0);
    const net = buyVol - sellVol;

    const res = {
      detected: true,
      count: large.length,
      buyVolume: +buyVol.toFixed(4),
      sellVolume: +sellVol.toFixed(4),
      netFlow: +net.toFixed(4),
      threshold: +threshold.toFixed(6),
      mean: +mean.toFixed(6),
      std: +std.toFixed(6),
      windowTrades: window.length
    };

    this.lastDetection = res;
    return res;
  }

  getLast() {
    return this.lastDetection || { detected: false };
  }
}
