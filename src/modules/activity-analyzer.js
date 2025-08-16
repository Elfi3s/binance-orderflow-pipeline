// src/modules/activity-analyzer.js - NEW FILE
export class ActivityAnalyzer {
  constructor() {
    this.activityWindows = new Map(); // timeWindow -> activity metrics
    this.windows = [10, 30, 60, 300]; // seconds
    this.baselineActivity = { trades: 0, volume: 0, lastUpdate: Date.now() };
  }

  onTrade(trade) {
    const now = Date.now();
    
    // Update activity for each time window
    for (const window of this.windows) {
      const windowMs = window * 1000;
      const key = `${window}s`;
      
      if (!this.activityWindows.has(key)) {
        this.activityWindows.set(key, { trades: [], volume: 0 });
      }

      const windowData = this.activityWindows.get(key);
      
      // Add current trade
      windowData.trades.push({
        time: now,
        volume: trade.quantity,
        side: trade.side
      });

      // Clean old trades
      windowData.trades = windowData.trades.filter(t => now - t.time <= windowMs);
      windowData.volume = windowData.trades.reduce((sum, t) => sum + t.volume, 0);
      
      this.activityWindows.set(key, windowData);
    }

    return this.detectActivityAnomalies();
  }

  detectActivityAnomalies() {
    const anomalies = [];
    
    for (const window of this.windows) {
      const key = `${window}s`;
      const windowData = this.activityWindows.get(key);
      
      if (!windowData) continue;

      const currentActivity = {
        tradeCount: windowData.trades.length,
        totalVolume: windowData.volume,
        avgTradeSize: windowData.volume / Math.max(1, windowData.trades.length)
      };

      // Compare with baseline (you'd need to establish this over time)
      const baselineTradeCount = this.getBaselineTradeCount(window);
      const baselineVolume = this.getBaselineVolume(window);

      const tradeCountRatio = currentActivity.tradeCount / Math.max(1, baselineTradeCount);
      const volumeRatio = currentActivity.totalVolume / Math.max(1, baselineVolume);

      // Detect unusual activity spikes
      if (tradeCountRatio > 3.0 || volumeRatio > 3.0) {
        anomalies.push({
          type: 'ACTIVITY_SPIKE',
          window: window,
          signal: 'ATTENTION',
          tradeCountRatio: tradeCountRatio,
          volumeRatio: volumeRatio,
          strength: Math.min(1.0, Math.max(tradeCountRatio, volumeRatio) / 5.0),
          details: currentActivity
        });
      }

      // Detect unusual quiet periods
      if (tradeCountRatio < 0.2 && volumeRatio < 0.2 && window >= 30) {
        anomalies.push({
          type: 'ACTIVITY_DROUGHT',
          window: window,
          signal: 'CAUTION',
          tradeCountRatio: tradeCountRatio,
          volumeRatio: volumeRatio,
          strength: Math.min(1.0, (1 - Math.max(tradeCountRatio, volumeRatio)) * 2),
          details: currentActivity
        });
      }
    }

    return anomalies.length > 0 ? anomalies : null;
  }

  // These would be calibrated over time - using simple estimates for now
  getBaselineTradeCount(windowSeconds) {
    const baselinePerSecond = 0.5; // Calibrate this based on historical data
    return baselinePerSecond * windowSeconds;
  }

  getBaselineVolume(windowSeconds) {
    const baselineVolumePerSecond = 20; // Calibrate this based on historical data
    return baselineVolumePerSecond * windowSeconds;
  }

  getActivityStats() {
    const stats = {};
    
    for (const window of this.windows) {
      const key = `${window}s`;
      const windowData = this.activityWindows.get(key);
      
      if (windowData) {
        stats[key] = {
          tradeCount: windowData.trades.length,
          totalVolume: windowData.volume,
          avgTradeSize: windowData.volume / Math.max(1, windowData.trades.length),
          buyTrades: windowData.trades.filter(t => t.side === 'BUY').length,
          sellTrades: windowData.trades.filter(t => t.side === 'SELL').length
        };
      }
    }
    
    return stats;
  }
}
