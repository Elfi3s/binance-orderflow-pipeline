// src/modules/dom-pressure-analyzer.js - REPLACE ENTIRE FILE
export class DOMPressureAnalyzer {
  constructor() {
    this.domHistory = [];
    this.pressureLevels = new Map(); // price -> pressure data
    this.maxHistory = 200;
    this.pressureThreshold = 500; // HIGHER THRESHOLD - ETH volume for significant pressure
    
    // ADD COOLDOWN SYSTEM
    this.lastSignalTime = 0;
    this.signalCooldown = 15000; // 15 seconds cooldown
    this.lastSignalType = null;
  }

  onDepthUpdate(domData) {
    const now = Date.now();
    
    // COOLDOWN CHECK - Don't analyze if in cooldown
    if (now - this.lastSignalTime < this.signalCooldown) {
      return null;
    }
    
    this.domHistory.push({
      timestamp: now,
      bids: domData.bids || [],
      asks: domData.asks || [],
      spread: domData.spread || 0
    });

    if (this.domHistory.length > this.maxHistory) {
      this.domHistory.shift();
    }

    return this.analyzePressure(domData, now);
  }

  analyzePressure(current, now) {
    if (this.domHistory.length < 20) return null;

    const signals = [];
    
    // Only analyze one type at a time to reduce spam
    const pressureBuildup = this.detectPressureBuildup(current);
    if (pressureBuildup) {
      // Only signal if different from last signal or significant strength increase
      if (this.lastSignalType !== pressureBuildup.type || pressureBuildup.strength > 0.8) {
        signals.push(pressureBuildup);
        this.lastSignalType = pressureBuildup.type;
        this.lastSignalTime = now;
      }
    }
    
    return signals.length > 0 ? signals : null;
  }

  detectPressureBuildup(current) {
    if (this.domHistory.length < 10) return null;
    
    const recentHistory = this.domHistory.slice(-10);
    const avgBidVolume = recentHistory.reduce((sum, h) => 
      sum + (h.bids?.reduce((s, b) => s + (b.quantity || 0), 0) || 0), 0) / recentHistory.length;
    const avgAskVolume = recentHistory.reduce((sum, h) => 
      sum + (h.asks?.reduce((s, a) => s + (a.quantity || 0), 0) || 0), 0) / recentHistory.length;
    
    const currentBidVolume = (current.bids || []).reduce((sum, b) => sum + (b.quantity || 0), 0);
    const currentAskVolume = (current.asks || []).reduce((sum, a) => sum + (a.quantity || 0), 0);
    
    // MUCH HIGHER THRESHOLDS - 3x average AND above absolute threshold
    if (currentBidVolume > avgBidVolume * 3 && currentBidVolume > this.pressureThreshold) {
      return {
        type: 'BID_PRESSURE_BUILDUP',
        signal: 'BULLISH',
        strength: Math.min(1.0, currentBidVolume / (this.pressureThreshold * 5)),
        currentVolume: currentBidVolume,
        avgVolume: avgBidVolume,
        multiplier: currentBidVolume / avgBidVolume,
        topLevels: (current.bids || []).slice(0, 3)
      };
    }
    
    if (currentAskVolume > avgAskVolume * 3 && currentAskVolume > this.pressureThreshold) {
      return {
        type: 'ASK_PRESSURE_BUILDUP',
        signal: 'BEARISH',
        strength: Math.min(1.0, currentAskVolume / (this.pressureThreshold * 5)),
        currentVolume: currentAskVolume,
        avgVolume: avgAskVolume,
        multiplier: currentAskVolume / avgAskVolume,
        topLevels: (current.asks || []).slice(0, 3)
      };
    }
    
    return null;
  }
}
