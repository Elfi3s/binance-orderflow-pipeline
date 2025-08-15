// src/modules/iceberg-detector.js - NEW FILE
export class IcebergDetector {
  constructor() {
    this.priceVolumeTracker = new Map(); // price -> {volume, orderCount, timeWindow}
    this.icebergThreshold = 500; // ETH threshold for iceberg detection
    this.timeWindow = 60000; // 1 minute window
  }

  onTrade(trade) {
    const price = Math.round(trade.price / config.tickSize) * config.tickSize;
    const now = Date.now();

    if (!this.priceVolumeTracker.has(price)) {
      this.priceVolumeTracker.set(price, {
        volume: 0,
        orderCount: 0,
        firstSeen: now,
        trades: []
      });
    }

    const tracker = this.priceVolumeTracker.get(price);
    tracker.volume += trade.quantity;
    tracker.orderCount++;
    tracker.trades.push({
      time: now,
      quantity: trade.quantity,
      side: trade.side
    });

    // Clean old data
    tracker.trades = tracker.trades.filter(t => now - t.time <= this.timeWindow);
    
    return this.detectIceberg(price, tracker);
  }

  detectIceberg(price, tracker) {
    if (tracker.volume < this.icebergThreshold || tracker.orderCount < 5) {
      return null;
    }

    const avgOrderSize = tracker.volume / tracker.orderCount;
    const recentTrades = tracker.trades.slice(-10);
    const consistentSize = recentTrades.every(t => 
      Math.abs(t.quantity - avgOrderSize) / avgOrderSize < 0.3
    );

    if (consistentSize && tracker.volume > this.icebergThreshold) {
      const side = recentTrades[0].side;
      return {
        type: 'ICEBERG_ORDER',
        signal: side === 'BUY' ? 'BULLISH' : 'BEARISH',
        price: price,
        totalVolume: tracker.volume,
        orderCount: tracker.orderCount,
        avgOrderSize: avgOrderSize,
        strength: Math.min(1.0, tracker.volume / (this.icebergThreshold * 5)),
        side: side
      };
    }

    return null;
  }

  getActiveIcebergs() {
    const active = [];
    const now = Date.now();
    
    for (const [price, tracker] of this.priceVolumeTracker.entries()) {
      if (now - tracker.firstSeen <= this.timeWindow && tracker.volume > this.icebergThreshold) {
        active.push({
          price: price,
          volume: tracker.volume,
          orderCount: tracker.orderCount,
          side: tracker.trades[0]?.side
        });
      }
    }
    
    return active;
  }
}
