// src/modules/delta-pattern-analyzer.js
export class DeltaPatternAnalyzer {
  constructor() {
    this.barHistory = []; // Store last N completed bars
    this.maxHistory = 10; // Keep last 10 bars for pattern analysis
  }

  onBarClose(barData) {
    // Store essential bar data: OHLC, delta, volume, timestamp
    const barRecord = {
      open: parseFloat(barData.ohlc.open),
      high: parseFloat(barData.ohlc.high), 
      low: parseFloat(barData.ohlc.low),
      close: parseFloat(barData.ohlc.close),
      delta: barData.totalDelta,
      volume: barData.totalBuyVolume + barData.totalSellVolume,
      timestamp: barData.endTime,
      poc: barData.poc.price
    };

    this.barHistory.push(barRecord);

    // Keep only the last N bars
    if (this.barHistory.length > this.maxHistory) {
      this.barHistory.shift();
    }

    return this.analyzePatterns();
  }

  analyzePatterns() {
    if (this.barHistory.length < 2) {
      return { 
        patterns: [], 
        summary: { totalPatterns: 0, dominantSignal: 'NEUTRAL', strongSignals: 0 }
      };
    }

    const patterns = [];

    // Analyze different pattern types
    const divergencePattern = this.analyzeDeltaDivergence();
    const continuationPattern = this.analyzeDeltaContinuation();
    const exhaustionPattern = this.analyzeDeltaExhaustion();
    const accelerationPattern = this.analyzeDeltaAcceleration();

    // Add valid patterns
    if (divergencePattern) patterns.push(divergencePattern);
    if (continuationPattern) patterns.push(continuationPattern);
    if (exhaustionPattern) patterns.push(exhaustionPattern);
    if (accelerationPattern) patterns.push(accelerationPattern);

    return {
      patterns: patterns,
      summary: this.summarizePatterns(patterns)
    };
  }

  analyzeDeltaDivergence() {
    const latest = this.barHistory[this.barHistory.length - 1];
    
    // Determine candle color and delta direction
    const candleColor = latest.close > latest.open ? 'GREEN' : 'RED';
    const deltaDirection = latest.delta > 0 ? 'POSITIVE' : 'NEGATIVE';
    const deltaStrength = Math.abs(latest.delta);
    const volumeRatio = deltaStrength / latest.volume;

    // Classic divergence patterns
    if (candleColor === 'GREEN' && deltaDirection === 'NEGATIVE' && deltaStrength > 300) {
      return {
        type: 'BEARISH_DELTA_DIVERGENCE',
        signal: 'BEARISH',
        strength: Math.min(1.0, volumeRatio * 2), // Normalize strength
        description: `Green candle with ${deltaStrength.toFixed(0)} negative delta - Hidden selling`,
        confidence: deltaStrength > 800 ? 'HIGH' : deltaStrength > 500 ? 'MEDIUM' : 'LOW'
      };
    }

    if (candleColor === 'RED' && deltaDirection === 'POSITIVE' && deltaStrength > 300) {
      return {
        type: 'BULLISH_DELTA_DIVERGENCE',
        signal: 'BULLISH',
        strength: Math.min(1.0, volumeRatio * 2),
        description: `Red candle with +${deltaStrength.toFixed(0)} positive delta - Hidden buying`,
        confidence: deltaStrength > 800 ? 'HIGH' : deltaStrength > 500 ? 'MEDIUM' : 'LOW'
      };
    }

    return null;
  }

  analyzeDeltaContinuation() {
    if (this.barHistory.length < 3) return null;

    const last3 = this.barHistory.slice(-3);
    const deltas = last3.map(bar => bar.delta);
    const volumes = last3.map(bar => bar.volume);

    // Check for consistent delta direction with minimum threshold
    const allNegative = deltas.every(d => d < -200);
    const allPositive = deltas.every(d => d > 200);
    const avgVolume = volumes.reduce((a, b) => a + b) / 3;

    if (allNegative) {
      // Check for acceleration (getting more negative)
      const acceleration = Math.abs(deltas[2]) > Math.abs(deltas) * 1.2;
      const totalDelta = deltas.reduce((a, b) => a + b, 0);
      
      return {
        type: 'BEARISH_DELTA_CONTINUATION',
        signal: 'BEARISH',
        strength: acceleration ? 0.8 : 0.6,
        description: `3-bar negative delta sequence (${totalDelta.toFixed(0)} total)${acceleration ? ' - Accelerating' : ''}`,
        confidence: acceleration && avgVolume > 1000 ? 'HIGH' : 'MEDIUM'
      };
    }

    if (allPositive) {
      const acceleration = deltas[2] > deltas[0] * 1.2;
      const totalDelta = deltas.reduce((a, b) => a + b, 0);
      
      return {
        type: 'BULLISH_DELTA_CONTINUATION',
        signal: 'BULLISH',
        strength: acceleration ? 0.8 : 0.6,
        description: `3-bar positive delta sequence (+${totalDelta.toFixed(0)} total)${acceleration ? ' - Accelerating' : ''}`,
        confidence: acceleration && avgVolume > 1000 ? 'HIGH' : 'MEDIUM'
      };
    }

    return null;
  }

  analyzeDeltaExhaustion() {
    if (this.barHistory.length < 2) return null;

    const current = this.barHistory[this.barHistory.length - 1];
    const previous = this.barHistory[this.barHistory.length - 2];

    // Price direction
    const priceDirection = current.close > previous.close ? 'UP' : 'DOWN';
    const priceChange = Math.abs(current.close - previous.close);
    
    // Delta comparison
    const deltaWeakening = Math.abs(current.delta) < Math.abs(previous.delta) * 0.5;
    const volumeIncrease = current.volume > previous.volume * 1.3;
    const significantVolume = current.volume > 800;

    // Exhaustion occurs when price moves but delta weakens with high volume
    if (deltaWeakening && volumeIncrease && significantVolume && priceChange > 5) {
      const exhaustionSignal = priceDirection === 'UP' ? 'BEARISH' : 'BULLISH';
      
      return {
        type: 'DELTA_EXHAUSTION',
        signal: exhaustionSignal,
        strength: 0.7,
        description: `Delta exhaustion: ${priceDirection.toLowerCase()} price, weak delta (${current.delta.toFixed(0)}), high volume`,
        confidence: volumeIncrease > 1.5 ? 'HIGH' : 'MEDIUM'
      };
    }

    return null;
  }

  analyzeDeltaAcceleration() {
    if (this.barHistory.length < 2) return null;

    const current = this.barHistory[this.barHistory.length - 1];
    const previous = this.barHistory[this.barHistory.length - 2];

    // Look for delta acceleration (same direction, increasing magnitude)
    const sameDirection = (current.delta > 0) === (previous.delta > 0);
    const acceleration = Math.abs(current.delta) > Math.abs(previous.delta) * 1.5;
    const significantDelta = Math.abs(current.delta) > 500;

    if (sameDirection && acceleration && significantDelta) {
      const signal = current.delta > 0 ? 'BULLISH' : 'BEARISH';
      const deltaIncrease = ((Math.abs(current.delta) - Math.abs(previous.delta)) / Math.abs(previous.delta) * 100).toFixed(0);
      
      return {
        type: 'DELTA_ACCELERATION',
        signal: signal,
        strength: Math.min(1.0, Math.abs(current.delta) / 2000), // Normalize by max expected delta
        description: `Delta acceleration: ${deltaIncrease}% increase to ${current.delta.toFixed(0)}`,
        confidence: Math.abs(current.delta) > 1000 ? 'HIGH' : 'MEDIUM'
      };
    }

    return null;
  }

  summarizePatterns(patterns) {
    if (patterns.length === 0) {
      return {
        totalPatterns: 0,
        bullishPatterns: 0,
        bearishPatterns: 0,
        strongSignals: 0,
        dominantSignal: 'NEUTRAL',
        confidence: 0
      };
    }

    const bullishCount = patterns.filter(p => p.signal === 'BULLISH').length;
    const bearishCount = patterns.filter(p => p.signal === 'BEARISH').length;
    const strongPatterns = patterns.filter(p => p.strength > 0.6 || p.confidence === 'HIGH').length;

    // Determine dominant signal
    let dominantSignal = 'NEUTRAL';
    let confidence = 30;

    if (bullishCount > bearishCount) {
      dominantSignal = 'BULLISH';
      confidence = Math.min(90, 40 + (bullishCount * 15) + (strongPatterns * 10));
    } else if (bearishCount > bullishCount) {
      dominantSignal = 'BEARISH'; 
      confidence = Math.min(90, 40 + (bearishCount * 15) + (strongPatterns * 10));
    }

    return {
      totalPatterns: patterns.length,
      bullishPatterns: bullishCount,
      bearishPatterns: bearishCount,
      strongSignals: strongPatterns,
      dominantSignal: dominantSignal,
      confidence: Math.round(confidence)
    };
  }

  // Get recent delta history for debugging
  getRecentHistory(bars = 3) {
    return this.barHistory.slice(-bars).map(bar => ({
      close: bar.close,
      delta: bar.delta,
      volume: bar.volume,
      candle: bar.close > bar.open ? 'GREEN' : 'RED'
    }));
  }
}
