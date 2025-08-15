// src/modules/enhanced-delta-analyzer.js
export class EnhancedDeltaAnalyzer {
  constructor() {
    this.barHistory = [];
    this.maxHistory = 15;
  }

  onBarClose(barData) {
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
    if (this.barHistory.length > this.maxHistory) {
      this.barHistory.shift();
    }

    return this.analyzeAdvancedPatterns();
  }

  analyzeAdvancedPatterns() {
    if (this.barHistory.length < 2) {
      return { 
        patterns: [], 
        summary: { totalPatterns: 0, dominantSignal: 'NEUTRAL', strongSignals: 0 }
      };
    }

    const patterns = [];

    // 1. DIVERGENCE PATTERNS
    const divergence = this.analyzeDeltaDivergence();
    if (divergence) patterns.push(divergence);

    // 2. CONTINUATION PATTERNS  
    const continuation = this.analyzeContinuation();
    if (continuation) patterns.push(continuation);

    // 3. EXHAUSTION PATTERNS
    const exhaustion = this.analyzeExhaustion();
    if (exhaustion) patterns.push(exhaustion);

    // 4. ABSORPTION PATTERNS (NEW)
    const absorption = this.analyzeAbsorption();
    if (absorption) patterns.push(absorption);

    // 5. ACCELERATION PATTERNS
    const acceleration = this.analyzeAcceleration();
    if (acceleration) patterns.push(acceleration);

    return {
      patterns,
      summary: this.summarizePatterns(patterns)
    };
  }

  analyzeDeltaDivergence() {
    const latest = this.barHistory[this.barHistory.length - 1];
    const candleColor = latest.close > latest.open ? 'GREEN' : 'RED';
    const deltaDirection = latest.delta > 0 ? 'POSITIVE' : 'NEGATIVE';
    const deltaStrength = Math.abs(latest.delta);

    // Classic divergence patterns
    if (candleColor === 'GREEN' && deltaDirection === 'NEGATIVE' && deltaStrength > 200) {
      return {
        type: 'BEARISH_DELTA_DIVERGENCE',
        signal: 'BEARISH',
        strength: Math.min(1.0, deltaStrength / 1500),
        description: `Green candle with ${deltaStrength.toFixed(0)} negative delta - Hidden selling pressure`,
        confidence: deltaStrength > 800 ? 'HIGH' : deltaStrength > 400 ? 'MEDIUM' : 'LOW',
        priority: 'HIGH'
      };
    }

    if (candleColor === 'RED' && deltaDirection === 'POSITIVE' && deltaStrength > 200) {
      return {
        type: 'BULLISH_DELTA_DIVERGENCE',
        signal: 'BULLISH',
        strength: Math.min(1.0, deltaStrength / 1500),
        description: `Red candle with +${deltaStrength.toFixed(0)} positive delta - Hidden buying pressure`,
        confidence: deltaStrength > 800 ? 'HIGH' : deltaStrength > 400 ? 'MEDIUM' : 'LOW',
        priority: 'HIGH'
      };
    }

    return null;
  }

  analyzeContinuation() {
    if (this.barHistory.length < 3) return null;

    const last3 = this.barHistory.slice(-3);
    const deltas = last3.map(bar => bar.delta);
    
    const allNegative = deltas.every(d => d < -150);
    const allPositive = deltas.every(d => d > 150);

    if (allNegative) {
      const acceleration = Math.abs(deltas[2]) > Math.abs(deltas) * 1.2;
      const totalDelta = deltas.reduce((a, b) => a + b, 0);
      
      return {
        type: 'BEARISH_CONTINUATION',
        signal: 'BEARISH',
        strength: acceleration ? 0.8 : 0.6,
        description: `3-bar selling continuation (${totalDelta.toFixed(0)} total delta)${acceleration ? ' - Accelerating' : ''}`,
        confidence: acceleration ? 'HIGH' : 'MEDIUM',
        priority: 'MEDIUM'
      };
    }

    if (allPositive) {
      const acceleration = deltas[2] > deltas * 1.2;
      const totalDelta = deltas.reduce((a, b) => a + b, 0);
      
      return {
        type: 'BULLISH_CONTINUATION',
        signal: 'BULLISH',
        strength: acceleration ? 0.8 : 0.6,
        description: `3-bar buying continuation (+${totalDelta.toFixed(0)} total delta)${acceleration ? ' - Accelerating' : ''}`,
        confidence: acceleration ? 'HIGH' : 'MEDIUM',
        priority: 'MEDIUM'
      };
    }

    return null;
  }

  analyzeExhaustion() {
    if (this.barHistory.length < 2) return null;

    const current = this.barHistory[this.barHistory.length - 1];
    const previous = this.barHistory[this.barHistory.length - 2];

    const priceUp = current.close > previous.close;
    const priceChange = Math.abs(current.close - previous.close);
    const deltaWeakening = Math.abs(current.delta) < Math.abs(previous.delta) * 0.4;
    const volumeSpike = current.volume > previous.volume * 1.5;

    if (deltaWeakening && volumeSpike && priceChange > 3) {
      return {
        type: 'DELTA_EXHAUSTION',
        signal: priceUp ? 'BEARISH' : 'BULLISH',
        strength: 0.75,
        description: `Exhaustion: ${priceUp ? 'Up' : 'Down'} move with weak delta (${current.delta.toFixed(0)}) and high volume`,
        confidence: volumeSpike > 2.0 ? 'HIGH' : 'MEDIUM',
        priority: 'HIGH'
      };
    }

    return null;
  }

  analyzeAbsorption() {
    if (this.barHistory.length < 2) return null;

    const current = this.barHistory[this.barHistory.length - 1];
    const previous = this.barHistory[this.barHistory.length - 2];

    // Absorption: Large volume, small price movement, delta in opposite direction
    const smallPriceMove = Math.abs(current.close - previous.close) < 8;
    const largeVolume = current.volume > 1500;
    const significantDelta = Math.abs(current.delta) > 300;
    const priceDirection = current.close > previous.close ? 'UP' : 'DOWN';
    const deltaDirection = current.delta > 0 ? 'BUYING' : 'SELLING';

    if (smallPriceMove && largeVolume && significantDelta) {
      // Buying absorption during down move or selling absorption during up move
      const isAbsorption = (priceDirection === 'DOWN' && deltaDirection === 'BUYING') ||
                          (priceDirection === 'UP' && deltaDirection === 'SELLING');
      
      if (isAbsorption) {
        return {
          type: 'ABSORPTION_PATTERN',
          signal: deltaDirection === 'BUYING' ? 'BULLISH' : 'BEARISH',
          strength: 0.7,
          description: `${deltaDirection.toLowerCase()} absorption: High volume (${current.volume.toFixed(0)}), small price move, ${Math.abs(current.delta).toFixed(0)} delta`,
          confidence: largeVolume > 2500 ? 'HIGH' : 'MEDIUM',
          priority: 'HIGH'
        };
      }
    }

    return null;
  }

  analyzeAcceleration() {
    if (this.barHistory.length < 2) return null;

    const current = this.barHistory[this.barHistory.length - 1];
    const previous = this.barHistory[this.barHistory.length - 2];

    const sameDirection = (current.delta > 0) === (previous.delta > 0);
    const acceleration = Math.abs(current.delta) > Math.abs(previous.delta) * 1.8;
    const significantDelta = Math.abs(current.delta) > 400;

    if (sameDirection && acceleration && significantDelta) {
      const signal = current.delta > 0 ? 'BULLISH' : 'BEARISH';
      const deltaIncrease = ((Math.abs(current.delta) - Math.abs(previous.delta)) / Math.abs(previous.delta) * 100);
      
      return {
        type: 'DELTA_ACCELERATION',
        signal: signal,
        strength: Math.min(1.0, Math.abs(current.delta) / 2000),
        description: `Delta acceleration: ${deltaIncrease.toFixed(0)}% increase to ${current.delta.toFixed(0)}`,
        confidence: Math.abs(current.delta) > 1000 ? 'HIGH' : 'MEDIUM',
        priority: 'MEDIUM'
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
        confidence: 0,
        highPrioritySignals: 0
      };
    }

    const bullishCount = patterns.filter(p => p.signal === 'BULLISH').length;
    const bearishCount = patterns.filter(p => p.signal === 'BEARISH').length;
    const strongPatterns = patterns.filter(p => p.strength > 0.6 || p.confidence === 'HIGH').length;
    const highPriority = patterns.filter(p => p.priority === 'HIGH').length;

    let dominantSignal = 'NEUTRAL';
    let confidence = 25;

    if (bullishCount > bearishCount) {
      dominantSignal = 'BULLISH';
      confidence = Math.min(90, 35 + (bullishCount * 12) + (strongPatterns * 8) + (highPriority * 10));
    } else if (bearishCount > bullishCount) {
      dominantSignal = 'BEARISH'; 
      confidence = Math.min(90, 35 + (bearishCount * 12) + (strongPatterns * 8) + (highPriority * 10));
    }

    return {
      totalPatterns: patterns.length,
      bullishPatterns: bullishCount,
      bearishPatterns: bearishCount,
      strongSignals: strongPatterns,
      highPrioritySignals: highPriority,
      dominantSignal: dominantSignal,
      confidence: Math.round(confidence)
    };
  }
}
