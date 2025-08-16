// src/modules/enhanced-dom-analyzer.js - NEW FILE
export class EnhancedDOMAnalyzer {
  constructor() {
    this.domHistory = [];
    this.maxHistory = 100;
    this.spoofingThreshold = 1000; // ETH threshold for spoof detection
    this.lastAnalysis = 0;
  }

  onDepthUpdate(depthData, orderBookManager) {
    const timestamp = Date.now();

  // ADD COOLDOWN - Only analyze every 5 seconds
  if (this.lastAnalysis && timestamp - this.lastAnalysis < 5000) {
    return null;
  }
  this.lastAnalysis = timestamp;

    const topLevels = orderBookManager.getTopLevels(20);
    
    if (!topLevels) return null;

    const domSnapshot = {
      timestamp: timestamp,
      bids: topLevels.bids.slice(0, 10),
      asks: topLevels.asks.slice(0, 10),
      totalBidVolume: topLevels.bids.reduce((sum, level) => sum + level.quantity, 0),
      totalAskVolume: topLevels.asks.reduce((sum, level) => sum + level.quantity, 0),
      spread: topLevels.asks.price - topLevels.bids.price
    };

    this.domHistory.push(domSnapshot);
    if (this.domHistory.length > this.maxHistory) {
      this.domHistory.shift();
    }

    return this.analyzeDOMPatterns(domSnapshot);
  }

  analyzeDOMPatterns(currentDOM) {
    const patterns = [];

    // 1. Spoof Detection
    const spoofing = this.detectSpoofing(currentDOM);
    if (spoofing) patterns.push(spoofing);

    // 2. Hidden Liquidity Detection
    const hiddenLiquidity = this.detectHiddenLiquidity();
    if (hiddenLiquidity) patterns.push(hiddenLiquidity);

    // 3. Liquidity Imbalance
    const imbalance = this.detectLiquidityImbalance(currentDOM);
    if (imbalance) patterns.push(imbalance);

    return patterns.length > 0 ? patterns : null;
  }

  detectSpoofing(currentDOM) {
    if (this.domHistory.length < 5) return null;

    const recent = this.domHistory.slice(-5);
    const current = currentDOM;

    // Check for large orders that appear and disappear quickly
    for (const level of current.bids) {
      if (level.quantity > this.spoofingThreshold) {
        const wasPresent = recent.some(dom => 
          dom.bids.some(bid => 
            Math.abs(bid.price - level.price) < 0.01 && 
            bid.quantity > this.spoofingThreshold * 0.8
          )
        );

        if (!wasPresent) {
          return {
            type: 'POTENTIAL_SPOOF_ORDER',
            signal: 'BEARISH', // Large bid might be fake
            side: 'BID',
            price: level.price,
            volume: level.quantity,
            strength: Math.min(1.0, level.quantity / (this.spoofingThreshold * 3))
          };
        }
      }
    }

    for (const level of current.asks) {
      if (level.quantity > this.spoofingThreshold) {
        const wasPresent = recent.some(dom => 
          dom.asks.some(ask => 
            Math.abs(ask.price - level.price) < 0.01 && 
            ask.quantity > this.spoofingThreshold * 0.8
          )
        );

        if (!wasPresent) {
          return {
            type: 'POTENTIAL_SPOOF_ORDER',
            signal: 'BULLISH', // Large ask might be fake
            side: 'ASK',
            price: level.price,
            volume: level.quantity,
            strength: Math.min(1.0, level.quantity / (this.spoofingThreshold * 3))
          };
        }
      }
    }

    return null;
  }

  detectHiddenLiquidity() {
    if (this.domHistory.length < 10) return null;

    const recent = this.domHistory.slice(-10);
    const current = recent[recent.length - 1];
    const previous = recent[recent.length - 2];

    // Check for systematic order placement patterns
    const bidVolumeIncrease = current.totalBidVolume > previous.totalBidVolume * 1.3;
    const askVolumeIncrease = current.totalAskVolume > previous.totalAskVolume * 1.3;

    if (bidVolumeIncrease && !askVolumeIncrease) {
      return {
        type: 'HIDDEN_LIQUIDITY_ACCUMULATION',
        signal: 'BULLISH',
        side: 'BID',
        volumeIncrease: current.totalBidVolume - previous.totalBidVolume,
        strength: Math.min(1.0, (current.totalBidVolume / previous.totalBidVolume - 1) * 2)
      };
    }

    if (askVolumeIncrease && !bidVolumeIncrease) {
      return {
        type: 'HIDDEN_LIQUIDITY_ACCUMULATION',
        signal: 'BEARISH',
        side: 'ASK',
        volumeIncrease: current.totalAskVolume - previous.totalAskVolume,
        strength: Math.min(1.0, (current.totalAskVolume / previous.totalAskVolume - 1) * 2)
      };
    }

    return null;
  }

detectLiquidityImbalance(currentDOM) {
  const ratio = currentDOM.totalBidVolume / currentDOM.totalAskVolume;
  
  // MUCH HIGHER THRESHOLDS AND ADD COOLDOWN
  if (ratio > 5.0) { // Changed from 3.0 to 5.0
    return {
      type: 'EXTREME_BID_LIQUIDITY',
      signal: 'BULLISH',
      ratio: ratio,
      bidVolume: currentDOM.totalBidVolume,
      askVolume: currentDOM.totalAskVolume,
      strength: Math.min(1.0, (ratio - 1) / 15) // Reduced sensitivity
    };
  }

  if (ratio < 0.15) { // Changed from 0.33 to 0.15
    return {
      type: 'EXTREME_ASK_LIQUIDITY',
      signal: 'BEARISH',
      ratio: ratio,
      bidVolume: currentDOM.totalBidVolume,
      askVolume: currentDOM.totalAskVolume,
      strength: Math.min(1.0, (1 - ratio) / 0.85) // Reduced sensitivity
    };
  }

  return null;
}


  getDOMStats() {
    if (this.domHistory.length === 0) return null;

    const current = this.domHistory[this.domHistory.length - 1];
    const avgSpread = this.domHistory.reduce((sum, dom) => sum + dom.spread, 0) / this.domHistory.length;

    return {
      currentSpread: current.spread,
      avgSpread: avgSpread,
      spreadRatio: current.spread / avgSpread,
      liquidityRatio: current.totalBidVolume / current.totalAskVolume,
      totalLiquidity: current.totalBidVolume + current.totalAskVolume
    };
  }
}
