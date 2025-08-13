// src/modules/reliability-scorer.js
export class ReliabilityScorer {
  constructor() {
    // Base reliabilities (executed-trade-based signals are high; DOM-based are lower)
    this.base = {
      footprint: 0.9,
      cvd: 0.9,
      rsi: 0.95,
      vwap: 0.9,
      valueArea: 0.85,
      orderBookImbalance: 0.35
    };
  }

  // Provide flags about suspected spoofing or DOM instability
  compute({
    spoofingDetected = false,
    extremeImbalance = false,
    wideSpread = false,
    lowLiquidity = false
  } = {}) {
    const factor = (rel) => {
      let r = rel;
      if (spoofingDetected) r *= 0.5;     // heavy penalty
      if (extremeImbalance) r *= 0.7;
      if (wideSpread) r *= 0.85;
      if (lowLiquidity) r *= 0.85;
      return Math.max(0.1, Math.min(1.0, r));
    };

    return {
      footprint: factor(this.base.footprint),
      cvd: factor(this.base.cvd),
      rsi: factor(this.base.rsi),
      vwap: factor(this.base.vwap),
      valueArea: factor(this.base.valueArea),
      orderBookImbalance: factor(this.base.orderBookImbalance)
    };
  }
}
