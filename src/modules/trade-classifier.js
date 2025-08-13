// src\modules\trade-classifier.js
import chalk from 'chalk';

export class TradeClassifier {
  constructor(orderBookManager) {
    this.orderBook = orderBookManager;
    this.classifiedTrades = [];
  }

  classifyTrade(tradeData) {
    // Binance aggTrade provides maker/taker info via 'm' field
    // m = true means buyer is maker (SELL), m = false means buyer is taker (BUY)
    const isBuyerMaker = tradeData.m;
    
    const trade = {
      symbol: tradeData.s,
      tradeId: tradeData.t,
      price: parseFloat(tradeData.p),
      quantity: parseFloat(tradeData.q),
      time: tradeData.T,
      
      // Trade side classification
      side: isBuyerMaker ? 'SELL' : 'BUY',
      isBuyerMaker: isBuyerMaker,
      
      // Additional classification based on order book
      ...this.classifyAgainstOrderBook(parseFloat(tradeData.p), isBuyerMaker)
    };

    this.classifiedTrades.push(trade);
    return trade;
  }

  classifyAgainstOrderBook(price, isBuyerMaker) {
    const bestBidAsk = this.orderBook.getBestBidAsk();
    
    if (!bestBidAsk.bid || !bestBidAsk.ask) {
      return { classification: 'UNKNOWN', confidence: 0 };
    }

    let classification = 'MIDDLE';
    let confidence = 1.0;

    if (price >= bestBidAsk.ask) {
      classification = 'AGGRESSIVE_BUY'; // Took the ask
      confidence = 1.0;
    } else if (price <= bestBidAsk.bid) {
      classification = 'AGGRESSIVE_SELL'; // Took the bid
      confidence = 1.0;
    } else if (price > bestBidAsk.bid && price < bestBidAsk.ask) {
      // Trade occurred inside spread (unusual)
      classification = isBuyerMaker ? 'PASSIVE_SELL' : 'PASSIVE_BUY';
      confidence = 0.7;
    }

    return {
      classification,
      confidence,
      bestBid: bestBidAsk.bid,
      bestAsk: bestBidAsk.ask,
      spread: bestBidAsk.spread
    };
  }

  getRecentTrades(timeWindow = 60000) { // Last minute by default
    const cutoff = Date.now() - timeWindow;
    return this.classifiedTrades.filter(trade => trade.time >= cutoff);
  }

  clearOldTrades(maxAge = 3600000) { // Keep 1 hour of trades
    const cutoff = Date.now() - maxAge;
    const initialLength = this.classifiedTrades.length;
    this.classifiedTrades = this.classifiedTrades.filter(trade => trade.time >= cutoff);
    
    const removed = initialLength - this.classifiedTrades.length;
    if (removed > 0) {
      console.log(chalk.gray(`🗑️ Cleaned ${removed} old trades, ${this.classifiedTrades.length} remaining`));
    }
  }
}
