// src/modules/order-stacking-detector.js - CREATE THIS FILE  
export class OrderStackingDetector {
  constructor() {
    this.stackHistory = [];
    this.minStackSize = 500; // ETH threshold for significant stack
    this.priceRange = 5; // Look within 5 price levels
  }

  onDepthUpdate(orderBookManager) {
    const stacks = this.detectStacking(orderBookManager);
    if (stacks.length > 0) {
      this.stackHistory.push(...stacks.map(s => ({ ...s, time: Date.now() })));
      // Keep last 50 stacks
      if (this.stackHistory.length > 50) {
        this.stackHistory = this.stackHistory.slice(-50);
      }
      return stacks;
    }
    return null;
  }

  detectStacking(orderBookManager) {
    const topLevels = orderBookManager.getTopLevels(20);
    if (!topLevels) return [];

    const stacks = [];
    
    // Detect bid stacking (support building)
    const bidStack = this.findStack(topLevels.bids, 'BID');
    if (bidStack) stacks.push(bidStack);
    
    // Detect ask stacking (resistance building)
    const askStack = this.findStack(topLevels.asks, 'ASK');
    if (askStack) stacks.push(askStack);
    
    return stacks;
  }

  findStack(levels, side) {
    for (let i = 0; i < levels.length - 2; i++) {
      const consecutiveLevels = levels.slice(i, i + 3);
      const totalVolume = consecutiveLevels.reduce((sum, level) => sum + level.quantity, 0);
      
      if (totalVolume > this.minStackSize) {
        // Check if volumes are relatively similar (stacked, not just one big order)
        const avgVolume = totalVolume / 3;
        const isStacked = consecutiveLevels.every(level => 
          level.quantity > avgVolume * 0.5 // At least half of average
        );
        
        if (isStacked) {
          return {
            type: `${side}_STACK`,
            signal: side === 'BID' ? 'BULLISH' : 'BEARISH',
            levels: consecutiveLevels,
            totalVolume,
            avgPrice: consecutiveLevels.reduce((sum, l) => sum + l.price, 0) / 3,
            strength: Math.min(1.0, totalVolume / (this.minStackSize * 2))
          };
        }
      }
    }
    return null;
  }

  getStackingStats() {
    const recent = this.stackHistory.filter(s => Date.now() - s.time < 180000); // Last 3 minutes
    const bidStacks = recent.filter(s => s.type === 'BID_STACK');
    const askStacks = recent.filter(s => s.type === 'ASK_STACK');
    
    return {
      total: recent.length,
      bidStacks: bidStacks.length,
      askStacks: askStacks.length,
      netStacking: bidStacks.length - askStacks.length // Positive = more support building
    };
  }
}
