// src/modules/signal-engine.js
export class SignalEngine {
  constructor() {
    this.weights = {
      rsi: 0.18,
      cvd: 0.22,
      divergence: 0.22,
      whales: 0.18,
      imbalances: 0.10,
      vwapValueArea: 0.10
    };

    this.rsiOversold = 30;
    this.rsiOverbought = 70;
    this.minWhaleNet = 50;
    this.minStackedImb = 2;
  }

  analyzeWithReliability(
    {
      rsi, cvd, divergence, whales, imbalances, price, vwap, valueAreaLow, valueAreaHigh, poc
    },
    reliabilities // { rsi, cvd, vwap, valueArea, orderBookImbalance, footprint }
  ) {
    // Signals in [-1, 1]
    const comp = {
      rsi:
        rsi <= this.rsiOversold ? 1 :
        rsi >= this.rsiOverbought ? -1 : 0,

      cvd: cvd > 0 ? 0.5 : cvd < 0 ? -0.5 : 0,

      divergence:
        divergence?.type === 'BULLISH_DIVERGENCE'
          ? Math.min(1, Math.max(0.3, divergence.strength))
          : divergence?.type === 'BEARISH_DIVERGENCE'
          ? -Math.min(1, Math.max(0.3, divergence.strength))
          : 0,

      whales:
        whales?.detected
          ? whales.netFlow > this.minWhaleNet
            ? 0.8
            : whales.netFlow < -this.minWhaleNet
            ? -0.8
            : whales.netFlow > 0
            ? 0.3
            : whales.netFlow < 0
            ? -0.3
            : 0
          : 0,

      imbalances:
        (imbalances?.buy || 0) - (imbalances?.sell || 0) >= this.minStackedImb
          ? 0.4
          : (imbalances?.sell || 0) - (imbalances?.buy || 0) >= this.minStackedImb
          ? -0.4
          : 0,

      vwapValueArea: (() => {
        if (!vwap || !valueAreaLow || !valueAreaHigh || !price) return 0;
        // Favor longs when price above VWAP and inside/near value area top half
        if (price > vwap && price <= valueAreaHigh) return 0.35;
        // Favor shorts when price below VWAP and inside/near value area bottom half
        if (price < vwap && price >= valueAreaLow) return -0.35;
        return 0;
      })()
    };

    // Apply reliability multipliers per component
    const score =
      comp.rsi * this.weights.rsi * (reliabilities.rsi ?? 1) +
      comp.cvd * this.weights.cvd * (reliabilities.cvd ?? 1) +
      comp.divergence * this.weights.divergence * (reliabilities.footprint ?? 1) +
      comp.whales * this.weights.whales * 1 + // whales relies on executions; keep high
      comp.imbalances * this.weights.imbalances * (reliabilities.orderBookImbalance ?? 1) +
      comp.vwapValueArea * this.weights.vwapValueArea * ((reliabilities.vwap + reliabilities.valueArea) / 2 || 1);

    let signal = 'NEUTRAL';
    if (score > 0.35) signal = 'LONG';
    else if (score < -0.35) signal = 'SHORT';

    const strength = Math.min(1, Math.abs(score));
    const confidence = Math.round(strength * 100);

    return {
      signal,
      strength: +strength.toFixed(3),
      confidence,
      components: comp,
      appliedReliabilities: reliabilities
    };
  }
}
