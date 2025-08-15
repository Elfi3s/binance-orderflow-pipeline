// src/modules/visual-checklist.js
import chalk from 'chalk';
import { config } from '../../config.js';

export class VisualChecklist {
  constructor() {
    this.checkmark = '✅';
    this.crossmark = '❌';
    this.warning = '⚠️';
    this.neutral = '➖';
  }

  displayOrderFlowChecklist({
    rsi,
    price, 
    vwap,
    valueAreaLow,
    valueAreaHigh,
    cvd,
    divergence,
    whales,
    imbalances,
    deltaPatterns,
    finalizedBar,
    interval
  }) {
    console.log('');
    console.log(chalk.blue('══════════════════════════════════════════════════════════════'));
    console.log(chalk.blue(`📋 ${interval.toUpperCase()} ORDER FLOW ANALYSIS CHECKLIST`));
    console.log(chalk.blue('══════════════════════════════════════════════════════════════'));

    const checks = [];

    // === RSI MOMENTUM ===
    console.log(chalk.yellow('🎯 MOMENTUM ANALYSIS:'));
    
    if (rsi <= 30) {
      console.log(`  ${this.checkmark} ${chalk.green('RSI Oversold')} (${rsi.toFixed(1)}) - Potential bounce`);
      checks.push({ signal: 'RSI_OVERSOLD', bullish: true, weight: 1.0 });
    } else if (rsi >= 70) {
      console.log(`  ${this.crossmark} ${chalk.red('RSI Overbought')} (${rsi.toFixed(1)}) - Potential pullback`);
      checks.push({ signal: 'RSI_OVERBOUGHT', bearish: true, weight: 1.0 });
    } else if (rsi < 40) {
      console.log(`  ${this.warning} ${chalk.yellow('RSI Weak')} (${rsi.toFixed(1)}) - Bearish bias`);
      checks.push({ signal: 'RSI_WEAK', bearish: true, weight: 0.3 });
    } else if (rsi > 60) {
      console.log(`  ${this.warning} ${chalk.yellow('RSI Strong')} (${rsi.toFixed(1)}) - Bullish bias`);
      checks.push({ signal: 'RSI_STRONG', bullish: true, weight: 0.3 });
    } else {
      console.log(`  ${this.neutral} RSI Neutral (${rsi.toFixed(1)}) - No momentum signal`);
    }

    // === PRICE STRUCTURE ===
    console.log(chalk.cyan('📊 PRICE STRUCTURE:'));
    
    const vwapDiff = ((price - vwap) / vwap * 100);
    if (Math.abs(vwapDiff) < 0.15) {
      console.log(`  ${this.warning} Price at VWAP (${vwapDiff.toFixed(2)}% diff) - Decision zone`);
    } else if (vwapDiff > 0.15) {
      console.log(`  ${this.checkmark} ${chalk.green('Price Above VWAP')} (+${vwapDiff.toFixed(2)}%) - Bullish structure`);
      checks.push({ signal: 'ABOVE_VWAP', bullish: true, weight: 0.6 });
    } else {
      console.log(`  ${this.crossmark} ${chalk.red('Price Below VWAP')} (${vwapDiff.toFixed(2)}%) - Bearish structure`);
      checks.push({ signal: 'BELOW_VWAP', bearish: true, weight: 0.6 });
    }

    const inValueArea = price >= valueAreaLow && price <= valueAreaHigh;
    if (inValueArea) {
      console.log(`  ${this.checkmark} ${chalk.green('In Value Area')} (${valueAreaLow.toFixed(2)} - ${valueAreaHigh.toFixed(2)}) - Fair value zone`);
      checks.push({ signal: 'IN_VALUE_AREA', neutral: true, weight: 0.2 });
    } else if (price > valueAreaHigh) {
      console.log(`  ${this.warning} ${chalk.yellow('Above Value Area')} - Extended/expensive`);
      checks.push({ signal: 'ABOVE_VALUE_AREA', bearish: true, weight: 0.4 });
    } else {
      console.log(`  ${this.warning} ${chalk.yellow('Below Value Area')} - Extended/cheap`);
      checks.push({ signal: 'BELOW_VALUE_AREA', bullish: true, weight: 0.4 });
    }

    // === DELTA ANALYSIS ===
    console.log(chalk.magenta('⚡ DELTA & VOLUME FLOW:'));

    const currentDelta = finalizedBar.totalDelta;
    if (currentDelta > 400) {
      console.log(`  ${this.checkmark} ${chalk.green('Strong Buy Delta')} (+${currentDelta.toFixed(0)} ETH) - Aggressive buying`);
      checks.push({ signal: 'STRONG_BUY_DELTA', bullish: true, weight: 0.8 });
    } else if (currentDelta < -400) {
      console.log(`  ${this.crossmark} ${chalk.red('Strong Sell Delta')} (${currentDelta.toFixed(0)} ETH) - Aggressive selling`);
      checks.push({ signal: 'STRONG_SELL_DELTA', bearish: true, weight: 0.8 });
    } else if (currentDelta > 100) {
      console.log(`  ${this.warning} Mild Buy Delta (+${currentDelta.toFixed(0)} ETH)`);
      checks.push({ signal: 'MILD_BUY_DELTA', bullish: true, weight: 0.3 });
    } else if (currentDelta < -100) {
      console.log(`  ${this.warning} Mild Sell Delta (${currentDelta.toFixed(0)} ETH)`);
      checks.push({ signal: 'MILD_SELL_DELTA', bearish: true, weight: 0.3 });
    } else {
      console.log(`  ${this.neutral} Balanced Delta (${currentDelta.toFixed(0)} ETH)`);
    }

    // CVD Divergence
    if (divergence) {
      if (divergence.type === 'BULLISH_DIVERGENCE') {
        console.log(`  ${this.checkmark} ${chalk.green('Bullish CVD Divergence')} (${divergence.strength.toFixed(2)}) - Hidden buying`);
        checks.push({ signal: 'BULLISH_CVD_DIVERGENCE', bullish: true, weight: 1.2 });
      } else {
        console.log(`  ${this.crossmark} ${chalk.red('Bearish CVD Divergence')} (${divergence.strength.toFixed(2)}) - Hidden selling`);
        checks.push({ signal: 'BEARISH_CVD_DIVERGENCE', bearish: true, weight: 1.2 });
      }
    } else {
      console.log(`  ${this.neutral} No CVD Divergence detected`);
    }

    // === ADVANCED DELTA PATTERNS ===
    console.log(chalk.red('🔍 ADVANCED DELTA PATTERNS:'));
    
    if (deltaPatterns && deltaPatterns.patterns.length > 0) {
      deltaPatterns.patterns.forEach(pattern => {
        const icon = pattern.signal === 'BULLISH' ? this.checkmark : 
                    pattern.signal === 'BEARISH' ? this.crossmark : this.warning;
        const color = pattern.signal === 'BULLISH' ? chalk.green : 
                     pattern.signal === 'BEARISH' ? chalk.red : chalk.yellow;
        
        console.log(`  ${icon} ${color(pattern.type.replace(/_/g, ' '))}: ${pattern.description}`);
        const weight = pattern.priority === 'HIGH' ? 1.0 : 0.6;
        checks.push({ 
          signal: pattern.type, 
          bullish: pattern.signal === 'BULLISH',
          bearish: pattern.signal === 'BEARISH',
          weight: weight * pattern.strength
        });
      });

      // Summary of pattern dominance
      const summary = deltaPatterns.summary;
      if (summary.dominantSignal !== 'NEUTRAL') {
        console.log(`  ${summary.dominantSignal === 'BULLISH' ? this.checkmark : this.crossmark} ${chalk.bold('Pattern Consensus:')} ${summary.dominantSignal} (${summary.confidence}%)`);
      }
    } else {
      console.log(`  ${this.neutral} No significant delta patterns detected`);
    }

    // === INSTITUTIONAL FLOW ===
    console.log(chalk.green('🐋 INSTITUTIONAL ACTIVITY:'));
    
    if (whales.detected) {
      if (whales.netFlow > 150) {
        console.log(`  ${this.checkmark} ${chalk.green('Large Whale Buying')} (+${whales.netFlow.toFixed(0)} ETH, ${whales.count} orders)`);
        checks.push({ signal: 'WHALE_BUYING', bullish: true, weight: 0.8 });
      } else if (whales.netFlow < -150) {
        console.log(`  ${this.crossmark} ${chalk.red('Large Whale Selling')} (${whales.netFlow.toFixed(0)} ETH, ${whales.count} orders)`);
        checks.push({ signal: 'WHALE_SELLING', bearish: true, weight: 0.8 });
      } else {
        console.log(`  ${this.warning} Mixed Whale Activity (${whales.netFlow.toFixed(0)} ETH net, ${whales.count} orders)`);
        checks.push({ signal: 'MIXED_WHALE_ACTIVITY', neutral: true, weight: 0.2 });
      }
    } else {
      console.log(`  ${this.neutral} No significant whale activity`);
    }

    // === ORDER BOOK IMBALANCES ===
    console.log(chalk.gray('📚 ORDER BOOK PRESSURE:'));
    
    const totalImbalances = (imbalances.buy || 0) + (imbalances.sell || 0);
    if (imbalances.buy >= 4) {
      console.log(`  ${this.checkmark} ${chalk.green('Strong Buy Imbalances')} (${imbalances.buy}) - Upside pressure`);
      checks.push({ signal: 'STRONG_BUY_IMBALANCES', bullish: true, weight: 0.6 });
    } else if (imbalances.sell >= 4) {
      console.log(`  ${this.crossmark} ${chalk.red('Strong Sell Imbalances')} (${imbalances.sell}) - Downside pressure`);
      checks.push({ signal: 'STRONG_SELL_IMBALANCES', bearish: true, weight: 0.6 });
    } else if (imbalances.buy >= 2) {
      console.log(`  ${this.warning} Moderate Buy Imbalances (${imbalances.buy})`);
      checks.push({ signal: 'MODERATE_BUY_IMBALANCES', bullish: true, weight: 0.3 });
    } else if (imbalances.sell >= 2) {
      console.log(`  ${this.warning} Moderate Sell Imbalances (${imbalances.sell})`);
      checks.push({ signal: 'MODERATE_SELL_IMBALANCES', bearish: true, weight: 0.3 });
    } else {
      console.log(`  ${this.neutral} No significant order book imbalances`);
    }

    return this.generateWeightedSummary(checks);
  }

  generateWeightedSummary(checks) {
    const bullishWeight = checks.filter(c => c.bullish).reduce((sum, c) => sum + (c.weight || 1), 0);
    const bearishWeight = checks.filter(c => c.bearish).reduce((sum, c) => sum + (c.weight || 1), 0);
    const neutralWeight = checks.filter(c => c.neutral).reduce((sum, c) => sum + (c.weight || 1), 0);
    
    const bullishCount = checks.filter(c => c.bullish).length;
    const bearishCount = checks.filter(c => c.bearish).length;
    const neutralCount = checks.filter(c => c.neutral).length;

    const totalWeight = bullishWeight + bearishWeight;
    let overallSignal = 'NEUTRAL';
    let confidence = 30;

    if (totalWeight > 0) {
      const bullishRatio = bullishWeight / totalWeight;
      const bearishRatio = bearishWeight / totalWeight;

      if (bullishRatio > 0.6) {
        overallSignal = 'BULLISH';
        confidence = Math.min(95, 45 + (bullishRatio * 40) + (bullishCount * 3));
      } else if (bearishRatio > 0.6) {
        overallSignal = 'BEARISH';
        confidence = Math.min(95, 45 + (bearishRatio * 40) + (bearishCount * 3));
      } else if (bullishRatio > bearishRatio) {
        overallSignal = 'LEAN_BULLISH';
        confidence = Math.min(70, 35 + (bullishRatio * 25));
      } else if (bearishRatio > bullishRatio) {
        overallSignal = 'LEAN_BEARISH';
        confidence = Math.min(70, 35 + (bearishRatio * 25));
      }
    }

    console.log(chalk.blue('══════════════════════════════════════════════════════════════'));
    
    const summaryColor = overallSignal.includes('BULLISH') ? chalk.green : 
                        overallSignal.includes('BEARISH') ? chalk.red : chalk.yellow;
    
    console.log(summaryColor(`📊 OVERALL ASSESSMENT: ${overallSignal.replace('_', ' ')} (${confidence.toFixed(0)}% confidence)`));
    console.log(summaryColor(`📈 Signal Strength: ${bullishWeight.toFixed(1)} Bullish | ${bearishWeight.toFixed(1)} Bearish | ${neutralWeight.toFixed(1)} Neutral`));
    console.log(summaryColor(`🔢 Signal Count: ${bullishCount} Bullish | ${bearishCount} Bearish | ${neutralCount} Neutral`));
    
    console.log(chalk.blue('══════════════════════════════════════════════════════════════'));

    return {
      overallSignal,
      confidence: Math.round(confidence),
      bullishWeight: parseFloat(bullishWeight.toFixed(1)),
      bearishWeight: parseFloat(bearishWeight.toFixed(1)),
      neutralWeight: parseFloat(neutralWeight.toFixed(1)),
      bullishCount,
      bearishCount,
      neutralCount,
      totalChecks: checks.length
    };
  }
}
