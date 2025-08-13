// src/modules/volume-profile.js
import { config } from '../../config.js';

export class VolumeProfile {
  constructor(tickSize = config.tickSize) {
    this.tickSize = tickSize;
    this.reset();
  }

  reset() {
    this.profile = new Map();  // price -> volume (total volume at level)
    this.totalVolume = 0;
    this.vwapNumerator = 0;    // sum(price * volume)
    this.vwap = 0;
    this.poc = { price: 0, volume: 0 };
    this.valueAreaLow = 0;
    this.valueAreaHigh = 0;
  }

  // price: number, size: number (ETH), side not needed for VWAP; for profile we use total volume
  addTrade(price, size) {
    // Round to tick size
    const key = Math.round(price / this.tickSize) * this.tickSize;
    const prev = this.profile.get(key) || 0;
    const nextVol = prev + size;
    this.profile.set(key, nextVol);

    // Update totals
    this.totalVolume += size;
    this.vwapNumerator += price * size;

    // POC update
    if (nextVol > this.poc.volume) {
      this.poc = { price: key, volume: nextVol };
    }

    // Update VWAP lazily (can also compute on demand)
    this.vwap = this.totalVolume > 0 ? this.vwapNumerator / this.totalVolume : 0;
  }

  // Recompute Value Area High/Low to cover 70% of volume around POC
  computeValueArea(coverage = 0.7) {
    if (this.totalVolume <= 0 || this.profile.size === 0) {
      this.valueAreaLow = 0;
      this.valueAreaHigh = 0;
      return;
    }

    const entries = Array.from(this.profile.entries()) // [price, vol]
      .sort((a, b) => a[0] - b[0]); // ascending by price

    // Find POC index
    const pocIndex = entries.findIndex(([price]) => price === this.poc.price);
    if (pocIndex === -1) {
      // fallback: compute POC again from entries
      let best = { price: entries[0][0], volume: entries[0][1], idx: 0 };
      entries.forEach(([p, v], i) => { if (v > best.volume) best = { price: p, volume: v, idx: i }; });
      this.poc = { price: best.price, volume: best.volume };
    }

    // Expand from POC outwards until accumulating target volume
    const target = this.totalVolume * coverage;
    let acc = 0;

    // Recompute POC index (in case above changed)
    const pocIdx = entries.findIndex(([p]) => p === this.poc.price);

    let left = pocIdx;
    let right = pocIdx;
    acc += entries[pocIdx][1];

    while (acc < target && (left > 0 || right < entries.length - 1)) {
      const nextLeftVol = left > 0 ? entries[left - 1][1] : -1;
      const nextRightVol = right < entries.length - 1 ? entries[right + 1][1] : -1;

      if (nextRightVol >= nextLeftVol) {
        if (right < entries.length - 1) {
          right += 1;
          acc += entries[right][1];
        } else if (left > 0) {
          left -= 1;
          acc += entries[left][1];
        } else {
          break;
        }
      } else {
        if (left > 0) {
          left -= 1;
          acc += entries[left][1];
        } else if (right < entries.length - 1) {
          right += 1;
          acc += entries[right][1];
        } else {
          break;
        }
      }
    }

    this.valueAreaLow = entries[left][0];
    this.valueAreaHigh = entries[right][0];
  }

  // Call at 4h bar close to produce a snapshot; then reset for next bar
  finalizeBarAndGetMetrics() {
    this.computeValueArea(0.7);
    const out = {
      vwap: +this.vwap.toFixed(6),
      poc: { price: this.poc.price, volume: +this.poc.volume.toFixed(6) },
      valueAreaLow: this.valueAreaLow,
      valueAreaHigh: this.valueAreaHigh,
      totalVolume: +this.totalVolume.toFixed(6)
    };
    this.reset();
    return out;
  }

  // Return VWAP/POC/Volume on current (open) bar without resetting
getLiveMetrics() {
  // Compute live VWAP
  const vwap = this.totalVolume > 0 ? this.vwapNumerator / this.totalVolume : 0;

  // Find current POC
  let pocPrice = 0;
  let pocVolume = 0;
  for (const [price, volume] of this.profile.entries()) {
    if (volume > pocVolume) {
      pocVolume = volume;
      pocPrice = price;
    }
  }

  return {
    vwap: +vwap.toFixed(6),
    poc: { price: pocPrice, volume: +pocVolume.toFixed(6) },
    totalVolume: +this.totalVolume.toFixed(6)
  };
}

}
