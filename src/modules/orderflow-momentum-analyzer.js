// src/modules/orderflow-momentum-analyzer.js - NEW FILE
import { config } from '../../config.js';

export class OrderFlowMomentumAnalyzer {
  constructor() {
    this.timeWindows = [30, 60, 120]; // seconds
    this.tradeHistory = [];
    this.momentumStates = new Map();
    this.significanceThreshold = 500; // ETH volume threshold for significance
    this.maxHistory = 1000;
  }

  onTrade(trade) {
    const now = Date.now();
    
    this.tradeHistory.push({
      time: now,
      price: trade.price,
      quantity: trade.quantity,
      side: trade.side,
      classification: trade.classification, // MARKET, LIMIT, etc
      aggressiveness: trade.classification === 'MARKET' ? 1.0 : 0.3
    });

    // Cleanup old trades
    if (this.tradeHistory.length > this.maxHistory) {
      this.tradeHistory.shift();
    }

    return this.analyzeMomentum(now);
  }

analyzeMomentum(now) {
  const signals = [];
  
  for (const window of this.timeWindows) {
    const windowMs = window * 1000;
    const recentTrades = this.tradeHistory.filter(t => now - t.time <= windowMs);
    
    if (recentTrades.length < 20) continue; // INCREASED from 10 to 20
    
    const analysis = this.calculateWindowMomentum(recentTrades, window);
    
    // STRICTER CRITERIA: significant volume AND strong direction AND confidence
    if (analysis.totalVolume >= this.significanceThreshold && 
        Math.abs(analysis.netFlow) > 0.4) { // INCREASED from 0.3 to 0.4
      
      const previousState = this.momentumStates.get(`${window}s`) || { signal: 'NEUTRAL', strength: 0, lastSignal: 0 };
      
      // ADD COOLDOWN - Don't signal if within 30 seconds of last signal for this window
      if (now - (previousState.lastSignal || 0) < 30000) {
        continue;
      }
      
      // Check for momentum shift
      if (this.isSignificantShift(previousState, analysis)) {
        const confidence = this.calculateConfidence(analysis);
        
        // ONLY SIGNAL IF HIGH CONFIDENCE
        if (confidence >= 75) {
          signals.push({
            type: 'ORDER_FLOW_MOMENTUM_SHIFT',
            window: window,
            signal: analysis.netFlow > 0 ? 'BULLISH' : 'BEARISH',
            strength: Math.min(1.0, Math.abs(analysis.netFlow)),
            volume: analysis.totalVolume,
            tradeCount: recentTrades.length,
            aggressiveness: analysis.avgAggressiveness,
            priceChange: analysis.priceChange,
            confidence: confidence
          });
          
          this.momentumStates.set(`${window}s`, {
            signal: analysis.netFlow > 0 ? 'BULLISH' : 'BEARISH',
            strength: Math.abs(analysis.netFlow),
            timestamp: now,
            lastSignal: now // ADD THIS
          });
        }
      }
    }
  }
  
  return signals.length > 0 ? signals : null;
}

  calculateWindowMomentum(trades, windowSeconds) {
    let buyVolume = 0, sellVolume = 0, totalAggressiveness = 0;
    const prices = trades.map(t => t.price);
    
    for (const trade of trades) {
      const weightedVolume = trade.quantity * trade.aggressiveness;
      
      if (trade.side === 'BUY') {
        buyVolume += weightedVolume;
      } else {
        sellVolume += weightedVolume;
      }
      
      totalAggressiveness += trade.aggressiveness;
    }

    const totalVolume = buyVolume + sellVolume;
    const netFlow = totalVolume > 0 ? (buyVolume - sellVolume) / totalVolume : 0;
    
    return {
      netFlow: netFlow,
      totalVolume: buyVolume + sellVolume,
      buyVolume: buyVolume,
      sellVolume: sellVolume,
      avgAggressiveness: totalAggressiveness / trades.length,
      priceChange: prices[prices.length - 1] - prices[0],
      tradeRate: trades.length / windowSeconds
    };
  }

isSignificantShift(previous, current) {
  // MUCH STRICTER CRITERIA
  const volumeThreshold = 1000; // Need at least 1000 ETH volume
  const strengthThreshold = 0.5; // Need at least 50% net flow
  
  // Must have significant volume first
  if (current.totalVolume < volumeThreshold) return false;
  
  // Must have strong directional flow
  if (Math.abs(current.netFlow) < strengthThreshold) return false;
  
  // Then check for direction change or significant strength increase
  const directionChange = (previous.signal === 'BULLISH' && current.netFlow < -0.4) ||
                         (previous.signal === 'BEARISH' && current.netFlow > 0.4) ||
                         (previous.signal === 'NEUTRAL' && Math.abs(current.netFlow) > 0.6);
  
  const significantStrengthIncrease = Math.abs(current.netFlow) > previous.strength * 2.0;
  
  return directionChange || significantStrengthIncrease;
}

  calculateConfidence(analysis) {
    let confidence = 0;
    
    // Volume significance
    confidence += Math.min(30, analysis.totalVolume / this.significanceThreshold * 30);
    
    // Flow clarity (how one-sided)
    confidence += Math.abs(analysis.netFlow) * 40;
    
    // Aggressiveness (market orders vs limit orders)
    confidence += analysis.avgAggressiveness * 30;
    
    return Math.min(95, Math.round(confidence));
  }
}
