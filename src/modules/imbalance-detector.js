// src\modules\imbalance-detector.js
import chalk from 'chalk';
import { config } from '../../config.js';

export class ImbalanceDetector {
  constructor(threshold = 2.5) {
    this.threshold = threshold; // 250% threshold
    this.detectedImbalances = [];
  }

  detectImbalances(footprintArray, domData) {
    this.detectedImbalances = [];

    // 1. Detect footprint imbalances (from completed bar data)
    if (footprintArray && footprintArray.length > 0) {
      this.detectFootprintImbalances(footprintArray);
    }

    // 2. Detect order book imbalances (from current DOM)
    if (domData && domData.bids && domData.asks) {
      this.detectOrderBookImbalances(domData);
    }

    return this.detectedImbalances;
  }

  detectFootprintImbalances(footprintArray) {
    // Sort by price descending
    const sortedFootprint = footprintArray.sort((a, b) => b.price - a.price);

    for (let i = 0; i < sortedFootprint.length - 2; i++) {
      const currentLevel = sortedFootprint[i];
      const nextLevel = sortedFootprint[i + 1];
      const thirdLevel = sortedFootprint[i + 2];

      // Check for stacked buy imbalance (3+ levels)
      if (this.isStackedBuyImbalance([currentLevel, nextLevel, thirdLevel])) {
        this.detectedImbalances.push({
          type: 'FOOTPRINT_STACKED',
          direction: 'BUY',
          startPrice: thirdLevel.price,
          endPrice: currentLevel.price,
          strength: this.calculateImbalanceStrength([currentLevel, nextLevel, thirdLevel], 'BUY'),
          levels: 3,
          source: 'footprint'
        });
      }

      // Check for stacked sell imbalance
      if (this.isStackedSellImbalance([currentLevel, nextLevel, thirdLevel])) {
        this.detectedImbalances.push({
          type: 'FOOTPRINT_STACKED',
          direction: 'SELL',
          startPrice: currentLevel.price,
          endPrice: thirdLevel.price,
          strength: this.calculateImbalanceStrength([currentLevel, nextLevel, thirdLevel], 'SELL'),
          levels: 3,
          source: 'footprint'
        });
      }
    }
  }

  detectOrderBookImbalances(domData) {
    const bids = domData.bids || [];
    const asks = domData.asks || [];

    if (bids.length === 0 || asks.length === 0) return;

    // Check for order book imbalances at each price level
    for (let i = 0; i < Math.min(bids.length, asks.length, 10); i++) {
      const bid = bids[i];
      const ask = asks[i];

      // Calculate bid/ask ratio at similar price levels
      const bidVolume = bid.quantity;
      const askVolume = ask.quantity;

      if (bidVolume > 0 && askVolume > 0) {
        const ratio = Math.max(bidVolume / askVolume, askVolume / bidVolume);
        
        if (ratio >= this.threshold) {
          this.detectedImbalances.push({
            type: 'ORDERBOOK_LEVEL',
            direction: bidVolume > askVolume ? 'BUY' : 'SELL',
            startPrice: bidVolume > askVolume ? bid.price : ask.price,
            endPrice: bidVolume > askVolume ? bid.price : ask.price,
            strength: ratio,
            levels: 1,
            source: 'orderbook',
            bidVolume: bidVolume,
            askVolume: askVolume
          });
        }
      }
    }

    // Check for stacked order book imbalances
    this.detectStackedOrderBookImbalances(bids, asks);
  }

  detectStackedOrderBookImbalances(bids, asks) {
    // Check for 3+ consecutive levels of bid imbalance
    for (let i = 0; i < bids.length - 2; i++) {
      const bidLevels = [bids[i], bids[i + 1], bids[i + 2]];
      const totalBidVolume = bidLevels.reduce((sum, level) => sum + level.quantity, 0);
      
      // Find corresponding ask levels
      const askLevels = [];
      for (const bidLevel of bidLevels) {
        const correspondingAsk = asks.find(ask => Math.abs(ask.price - bidLevel.price) < config.tickSize * 10);
        if (correspondingAsk) {
          askLevels.push(correspondingAsk);
        }
      }

      if (askLevels.length >= 2) {
        const totalAskVolume = askLevels.reduce((sum, level) => sum + level.quantity, 0);
        
        if (totalAskVolume > 0) {
          const ratio = totalBidVolume / totalAskVolume;
          
          if (ratio >= this.threshold) {
            this.detectedImbalances.push({
              type: 'ORDERBOOK_STACKED',
              direction: 'BUY',
              startPrice: bidLevels[2].price,
              endPrice: bidLevels.price,
              strength: ratio,
              levels: bidLevels.length,
              source: 'orderbook',
              totalBidVolume: totalBidVolume,
              totalAskVolume: totalAskVolume
            });
          }
        }
      }
    }

    // Similar check for ask imbalances
    for (let i = 0; i < asks.length - 2; i++) {
      const askLevels = [asks[i], asks[i + 1], asks[i + 2]];
      const totalAskVolume = askLevels.reduce((sum, level) => sum + level.quantity, 0);
      
      const bidLevels = [];
      for (const askLevel of askLevels) {
        const correspondingBid = bids.find(bid => Math.abs(bid.price - askLevel.price) < config.tickSize * 10);
        if (correspondingBid) {
          bidLevels.push(correspondingBid);
        }
      }

      if (bidLevels.length >= 2) {
        const totalBidVolume = bidLevels.reduce((sum, level) => sum + level.quantity, 0);
        
        if (totalBidVolume > 0) {
          const ratio = totalAskVolume / totalBidVolume;
          
          if (ratio >= this.threshold) {
            this.detectedImbalances.push({
              type: 'ORDERBOOK_STACKED',
              direction: 'SELL',
              startPrice: askLevels[0].price,
              endPrice: askLevels[1].price,
              strength: ratio,
              levels: askLevels.length,
              source: 'orderbook',
              totalBidVolume: totalBidVolume,
              totalAskVolume: totalAskVolume
            });
          }
        }
      }
    }
  }

  isStackedBuyImbalance(levels) {
    return levels.every(level => {
      const ratio = level.buyQty / Math.max(level.sellQty, 0.001);
      return ratio >= this.threshold;
    });
  }

  isStackedSellImbalance(levels) {
    return levels.every(level => {
      const ratio = level.sellQty / Math.max(level.buyQty, 0.001);
      return ratio >= this.threshold;
    });
  }

  calculateImbalanceStrength(levels, direction) {
    const ratios = levels.map(level => {
      if (direction === 'BUY') {
        return level.buyQty / Math.max(level.sellQty, 0.001);
      } else {
        return level.sellQty / Math.max(level.buyQty, 0.001);
      }
    });

    return Math.round((ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length) * 100) / 100;
  }

  getImbalanceStats() {
    const buyImbalances = this.detectedImbalances.filter(imb => imb.direction === 'BUY');
    const sellImbalances = this.detectedImbalances.filter(imb => imb.direction === 'SELL');
    const stackedImbalances = this.detectedImbalances.filter(imb => imb.type.includes('STACKED'));

    return {
      total: this.detectedImbalances.length,
      buyImbalances: buyImbalances.length,
      sellImbalances: sellImbalances.length,
      stackedImbalances: stackedImbalances.length,
      avgStrength: this.detectedImbalances.length > 0 
        ? Math.round((this.detectedImbalances.reduce((sum, imb) => sum + imb.strength, 0) / this.detectedImbalances.length) * 100) / 100
        : 0
    };
  }
}
