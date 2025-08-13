// src/modules/checklist.js
export class Checklist {
  constructor() {
    // Thresholds can be made configurable
    this.cfg = {
      rsiOversold: 30,
      rsiOverbought: 70,
      priceVsVWAPBand: 0.0015,  // 0.15% band considered "near VWAP"
      pocProximityTicks: 10,    // within 10 ticks of POC counts as near
      stackedImbMin: 2,
      cvdPositiveMin: 0,        // >0 bullish
      cvdNegativeMax: 0         // <0 bearish
    };
  }

  // inputs: rsi, price, vwap, valueAreaLow/High, poc, cvd, imbalances, whales
  build(inputs) {
    const {
      rsi,
      price,
      vwap,
      valueAreaLow,
      valueAreaHigh,
      poc,
      cvd,
      imbalances,   // { buy, sell }
      whales        // { detected, netFlow, count }
    } = inputs;

    const pctDiff = vwap > 0 ? Math.abs(price - vwap) / vwap : 0;
    const nearVWAP = pctDiff <= this.cfg.priceVsVWAPBand;

    const nearPOC = Math.abs(price - poc.price) <= (this.cfg.pocProximityTicks * (globalThis?.TICK_SIZE || 0.01));

    const inValueArea = (valueAreaLow && valueAreaHigh) ? (price >= valueAreaLow && price <= valueAreaHigh) : false;

    const bullishImb = (imbalances?.buy || 0) >= this.cfg.stackedImbMin;
    const bearishImb = (imbalances?.sell || 0) >= this.cfg.stackedImbMin;

    const checklist = {
      rsiOversold: rsi <= this.cfg.rsiOversold,
      rsiOverbought: rsi >= this.cfg.rsiOverbought,
      priceAboveVWAP: vwap > 0 ? price > vwap : false,
      priceBelowVWAP: vwap > 0 ? price < vwap : false,
      nearVWAP,
      inValueArea,
      nearPOC,
      bullishImbalances: bullishImb,
      bearishImbalances: bearishImb,
      cvdPositive: cvd > this.cfg.cvdPositiveMin,
      cvdNegative: cvd < this.cfg.cvdNegativeMax,
      whalesDetected: !!(whales?.detected),
      whaleNetBuy: (whales?.detected && whales.netFlow > 0) || false,
      whaleNetSell: (whales?.detected && whales.netFlow < 0) || false
    };

    // Summaries for convenience
    const longConfluence = [
      checklist.rsiOversold,
      checklist.priceAboveVWAP || checklist.nearVWAP,
      checklist.inValueArea || checklist.nearPOC,
      checklist.bullishImbalances,
      checklist.cvdPositive,
      checklist.whaleNetBuy
    ].filter(Boolean).length;

    const shortConfluence = [
      checklist.rsiOverbought,
      checklist.priceBelowVWAP || checklist.nearVWAP,
      checklist.inValueArea || checklist.nearPOC,
      checklist.bearishImbalances,
      checklist.cvdNegative,
      checklist.whaleNetSell
    ].filter(Boolean).length;

    return { checklist, longConfluence, shortConfluence };
  }
}
