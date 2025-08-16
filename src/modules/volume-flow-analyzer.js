// src/modules/volume-flow-analyzer.js - REPLACE ENTIRE FILE
export class VolumeFlowAnalyzer {
  constructor() {
    this.tradeHistory = [];
    this.volumeBaseline = this.initializeBaseline();
    this.flowStates = new Map(); // timeframe -> flow state
    this.timeframes = [30, 60, 180]; // seconds
    this.maxHistory = 2000;
    
    // ADD COOLDOWN SYSTEM
    this.lastSignalTime = new Map(); // timeframe -> last signal timestamp
    this.signalCooldown = 30000; // 30 seconds cooldown per timeframe
    this.confidenceThreshold = 80; // Only show signals with 80%+ confidence
  }

  initializeBaseline() {
    return {
      avgTradeSize: 15, // ETH - will be dynamically updated
      tradesPerMinute: 20, // will be dynamically updated
      volumePerMinute: 300, // ETH - will be dynamically updated
      lastUpdate: Date.now(),
      sampleCount: 0
    };
  }

  onTrade(trade) {
    const now = Date.now();
    
    this.tradeHistory.push({
      time: now,
      volume: trade.quantity,
      side: trade.side,
      price: trade.price,
      classification: trade.classification
    });

    if (this.tradeHistory.length > this.maxHistory) {
      this.tradeHistory.shift();
    }

    // Update baseline every 5 minutes
    if (now - this.volumeBaseline.lastUpdate > 300000) {
      this.updateBaseline(now);
    }

    return this.analyzeVolumeFlow(now);
  }

  updateBaseline(now) {
    const fiveMinutesTrades = this.tradeHistory.filter(t => now - t.time <= 300000);
    
    if (fiveMinutesTrades.length > 50) { // Enough data
      const totalVolume = fiveMinutesTrades.reduce((sum, t) => sum + t.volume, 0);
      
      this.volumeBaseline.avgTradeSize = totalVolume / fiveMinutesTrades.length;
      this.volumeBaseline.tradesPerMinute = fiveMinutesTrades.length / 5;
      this.volumeBaseline.volumePerMinute = totalVolume / 5;
      this.volumeBaseline.lastUpdate = now;
      this.volumeBaseline.sampleCount++;
    }
  }

  analyzeVolumeFlow(now) {
    const signals = [];
    
    for (const timeframe of this.timeframes) {
      const windowMs = timeframe * 1000;
      const windowTrades = this.tradeHistory.filter(t => now - t.time <= windowMs);
      
      if (windowTrades.length < 10) continue; // Need minimum trades
      
      // CHECK COOLDOWN - DON'T ANALYZE IF IN COOLDOWN
      const lastSignal = this.lastSignalTime.get(`${timeframe}s`) || 0;
      if (now - lastSignal < this.signalCooldown) {
        continue; // Skip this timeframe, still in cooldown
      }
      
      const analysis = this.calculateFlowMetrics(windowTrades, timeframe);
      const flowSignal = this.detectFlowAnomalies(analysis, timeframe);
      
      // ONLY SIGNAL IF HIGH CONFIDENCE AND SIGNIFICANT
      if (flowSignal && flowSignal.confidence >= this.confidenceThreshold) {
        // Check if this is actually a NEW signal (different from last state)
        const lastState = this.flowStates.get(`${timeframe}s`);
        const isNewSignal = !lastState || 
                           lastState.state !== flowSignal.signal || 
                           Math.abs(flowSignal.strength - lastState.strength) > 0.3;
        
        if (isNewSignal) {
          signals.push(flowSignal);
          
          // Update state and cooldown
          this.flowStates.set(`${timeframe}s`, {
            state: flowSignal.signal,
            strength: flowSignal.strength,
            timestamp: now
          });
          
          this.lastSignalTime.set(`${timeframe}s`, now);
        }
      }
    }
    
    return signals.length > 0 ? signals : null;
  }

  calculateFlowMetrics(trades, timeframeSeconds) {
    const totalVolume = trades.reduce((sum, t) => sum + t.volume, 0);
    const buyVolume = trades.filter(t => t.side === 'BUY').reduce((sum, t) => sum + t.volume, 0);
    const sellVolume = totalVolume - buyVolume;
    const marketOrders = trades.filter(t => t.classification === 'MARKET');
    const aggressiveVolume = marketOrders.reduce((sum, t) => sum + t.volume, 0);
    
    // Calculate rates per minute
    const volumeRate = (totalVolume / timeframeSeconds) * 60;
    const tradeRate = (trades.length / timeframeSeconds) * 60;
    
    return {
      totalVolume,
      buyVolume,
      sellVolume,
      volumeRate,
      tradeRate,
      aggressiveVolume,
      aggressiveRatio: aggressiveVolume / totalVolume,
      buyRatio: buyVolume / totalVolume,
      avgTradeSize: totalVolume / trades.length
    };
  }

  detectFlowAnomalies(metrics, timeframe) {
    const baseline = this.volumeBaseline;
    
    // INCREASE THRESHOLDS TO REDUCE NOISE
    const volumeRateRatio = metrics.volumeRate / baseline.volumePerMinute;
    const tradeRateRatio = metrics.tradeRate / baseline.tradesPerMinute;
    
    // MUCH HIGHER THRESHOLD: 5x volume AND strong directional bias
    if (volumeRateRatio > 5.0 && Math.abs(metrics.buyRatio - 0.5) > 0.25 && metrics.totalVolume > 500) {
      return {
        type: 'DIRECTIONAL_VOLUME_SURGE',
        timeframe: timeframe,
        signal: metrics.buyRatio > 0.5 ? 'BULLISH' : 'BEARISH',
        strength: Math.min(1.0, volumeRateRatio / 10.0),
        volumeRateMultiplier: volumeRateRatio,
        directionBias: Math.abs(metrics.buyRatio - 0.5) * 2,
        aggressiveness: metrics.aggressiveRatio,
        confidence: this.calculateFlowConfidence(metrics, volumeRateRatio)
      };
    }
    
    // MUCH HIGHER THRESHOLD: 85% aggressive trades AND significant volume
    if (metrics.aggressiveRatio > 0.85 && metrics.totalVolume > 1000) {
      return {
        type: 'AGGRESSIVE_FLOW_PATTERN',
        timeframe: timeframe,
        signal: metrics.buyRatio > 0.5 ? 'BULLISH' : 'BEARISH',
        strength: metrics.aggressiveRatio,
        aggressiveRatio: metrics.aggressiveRatio,
        directionBias: Math.abs(metrics.buyRatio - 0.5) * 2,
        totalVolume: metrics.totalVolume,
        confidence: Math.min(95, metrics.aggressiveRatio * 100 + (Math.abs(metrics.buyRatio - 0.5) * 50))
      };
    }
    
    return null;
  }

  calculateFlowConfidence(metrics, volumeRatio) {
    let confidence = 0;
    
    // Volume significance (max 40 points)
    confidence += Math.min(40, volumeRatio * 5);
    
    // Directional clarity (max 40 points)
    confidence += Math.abs(metrics.buyRatio - 0.5) * 80;
    
    // Aggressiveness factor (max 20 points)
    confidence += metrics.aggressiveRatio * 20;
    
    return Math.min(95, Math.round(confidence));
  }
}
