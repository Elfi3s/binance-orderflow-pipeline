// src\app.js - Complete Phase 3 with RSI and Imbalances
import WebSocket from 'ws';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { config } from '../config.js';
import { OrderBookManager } from './modules/orderbook-manager.js';
import { TradeClassifier } from './modules/trade-classifier.js';
import { BarAggregator } from './modules/bar-aggregator.js';
import { RSICalculator } from './modules/rsi-calculator.js';
import { ImbalanceDetector } from './modules/imbalance-detector.js';
import { Logger } from './utils/logger.js';
import { RSIInitializer } from './modules/rsi-initializer.js';
import { CVDAnalyzer } from './modules/cvd-analyzer.js';
import { WhaleDetector } from './modules/whale-detector.js';
import { SignalEngine } from './modules/signal-engine.js';
import { VolumeProfile } from './modules/volume-profile.js';
import { ReliabilityScorer } from './modules/reliability-scorer.js';
import { Checklist } from './modules/checklist.js';
// WITH:
import { EnhancedDeltaAnalyzer } from './modules/enhanced-delta-analyzer.js';
import { VisualChecklist } from './modules/visual-checklist.js';
import { AbsorptionDetector } from './modules/absorption-detector.js';
import { IcebergDetector } from './modules/iceberg-detector.js';
import { VolumeAnomalyDetector } from './modules/volume-anomaly-detector.js';
import { ExhaustionDetector } from './modules/exhaustion-detector.js';
import { EnhancedDOMAnalyzer } from './modules/enhanced-dom-analyzer.js';
class BinanceOrderFlowPipeline {
    constructor() {

        this.logger = new Logger();
        this.logger.info('Pipeline initialized', { symbol: config.symbol, interval: config.interval });
        this.symbol = config.symbol.toLowerCase();
        this.connections = new Map();

        // Initialize all modules
        this.orderBookManager = new OrderBookManager();
        this.tradeClassifier = new TradeClassifier(this.orderBookManager);
        this.barAggregator = new BarAggregator();
        this.rsiCalculator = new RSICalculator(config.rsiPeriod);
        this.imbalanceDetector = new ImbalanceDetector(config.imbalanceThreshold);
        this.rsiInitializer = new RSIInitializer();
        this.cvdAnalyzer = new CVDAnalyzer();
        this.whaleDetector = new WhaleDetector();
        this.signalEngine = new SignalEngine();
        this.volumeProfile = new VolumeProfile();
        this.reliabilityScorer = new ReliabilityScorer();
        this.checklist = new Checklist();
        globalThis.TICK_SIZE = config.tickSize;
// WITH:
this.enhancedDeltaAnalyzer = new EnhancedDeltaAnalyzer();
this.visualChecklist = new VisualChecklist();
this.absorptionDetector = new AbsorptionDetector();
this.icebergDetector = new IcebergDetector();
this.volumeAnomalyDetector = new VolumeAnomalyDetector();
this.exhaustionDetector = new ExhaustionDetector();
this.enhancedDOMAnalyzer = new EnhancedDOMAnalyzer();
        // Ensure output directories exist (Windows)
        this.ensureDirectories();

        console.log(chalk.blue(`🚀 Initializing Binance Order Flow Pipeline (${config.interval.toUpperCase()}) - Phase 3 Complete`));
        console.log(chalk.gray(`Symbol: ${config.symbol}, Interval: ${config.interval}`));
        console.log(chalk.gray(`RSI Period: ${config.rsiPeriod}, Imbalance Threshold: ${config.imbalanceThreshold}x`));
        console.log(chalk.gray(`Output Path: ${config.outputPath}`));
    }

    ensureDirectories() {
        try {
            if (!fs.existsSync(config.outputPath)) {
                fs.mkdirSync(config.outputPath, { recursive: true });
                console.log(chalk.green(`✅ Created output directory: ${config.outputPath}`));
            }

            if (!fs.existsSync(config.logPath)) {
                fs.mkdirSync(config.logPath, { recursive: true });
                console.log(chalk.green(`✅ Created log directory: ${config.logPath}`));
            }
        } catch (error) {
            console.error(chalk.red('❌ Failed to create directories:'), error);
        }
    }

    async start() {
        try {
            // Initialize order book first
            console.log(chalk.yellow('⚙️ Initializing order book...'));
            await this.orderBookManager.initialize();


            // Initialize RSI with historical data
            console.log(chalk.yellow('⚙️ Initializing RSI with historical data...'));
            await this.rsiInitializer.initializeRSIWithHistory(this.rsiCalculator, 20);

            await this.connectWebSockets();
            console.log(chalk.green('✅ All WebSocket connections established'));
            console.log(chalk.yellow('Press Ctrl+C to stop the pipeline gracefully'));

            // Start status updates
            this.startStatusUpdates();

        } catch (error) {
            console.error(chalk.red('❌ Failed to start pipeline:'), error);
        }
    }

    startStatusUpdates() {
        // Show summary every 30 seconds
        setInterval(() => {
            const currentBar = this.barAggregator.getCurrentBar();
            const obStats = this.orderBookManager.getStats();
            const recentTrades = this.tradeClassifier.getRecentTrades(30000);
            const rsiStats = this.rsiCalculator.getStats();

            console.log(chalk.magenta('════════════════════════════════════════'));
            console.log(chalk.blue('📊 COMPLETE PIPELINE STATUS'));
            const cvdStats = this.cvdAnalyzer.getSnapshotStats();
            const whaleLast = this.whaleDetector.getLast();
            console.log(chalk.green('📈 Flow Stats:'), {
                cvd: cvdStats.cvd,
                whales: whaleLast.detected
                    ? { count: whaleLast.count, net: whaleLast.netFlow, thr: whaleLast.threshold }
                    : 'none'
            });

            if (currentBar) {
                console.log(chalk.green(`📋 Current ${config.interval.toUpperCase()} Bar:`), {
                    start: new Date(currentBar.startTime).toLocaleString('en-US', { timeZone: 'UTC' }),
                    footprintLevels: currentBar.footprint.size,
                    totalBuyVol: currentBar.totalBuyVolume.toFixed(2),
                    totalSellVol: currentBar.totalSellVolume.toFixed(2),
                    netDelta: currentBar.totalDelta.toFixed(2),
                    poc: `${currentBar.poc.price} (${currentBar.poc.volume.toFixed(2)})`
                });
            }

            console.log(chalk.cyan('💰 Recent Activity (30s):'), {
                trades: recentTrades.length,
                buyTrades: recentTrades.filter(t => t.side === 'BUY').length,
                sellTrades: recentTrades.filter(t => t.side === 'SELL').length
            });

            console.log(chalk.yellow(`📈 RSI Analysis (${config.interval.toUpperCase()}):`), {
                rsi: rsiStats.rsi,
                signal: rsiStats.signal,
                trend: rsiStats.trend,
                dataPoints: rsiStats.dataPoints
            });

            // Check current imbalances
            const domData = this.orderBookManager.getTopLevels(20);
            const imbalances = this.imbalanceDetector.detectImbalances(null, domData);
            const imbalanceStats = this.imbalanceDetector.getImbalanceStats();

            console.log(chalk.red('⚖️ Current Imbalances:'), {
                total: imbalances.length,
                buy: imbalances.filter(i => i.direction === 'BUY').length,
                sell: imbalances.filter(i => i.direction === 'SELL').length,
                avgStrength: imbalanceStats.avgStrength
            });


            // Get live intrabar VWAP metrics
            const liveVP = this.volumeProfile.getLiveMetrics();

            // Log in the status summary
            console.log(chalk.cyan('📊 Intrabar VWAP Preview:'), {
                vwap: liveVP.vwap,
                poc: liveVP.poc.price,
                pocVolume: liveVP.poc.volume,
                totalVol: liveVP.totalVolume
            });
            console.log(chalk.gray('📖 Order Book:'), {
                bidLevels: obStats.bidLevels,
                askLevels: obStats.askLevels,
                bestBid: obStats.bid?.toFixed(2),
                bestAsk: obStats.ask?.toFixed(2),
                spread: obStats.spread?.toFixed(4)
            });
            console.log(chalk.magenta('════════════════════════════════════════'));
        }, 30000); // Every 30 seconds
    }

    async connectWebSockets() {
        this.connectKlineStream();
        this.connectAggTradeStream();
        this.connectDepthStream();
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    connectKlineStream() {
        const klineUrl = `${config.wsUrls.futures}/ws/${this.symbol}@kline_${config.interval}`;
        console.log(chalk.yellow('🔌 Connecting to kline stream...'));

        const ws = new WebSocket(klineUrl);

        ws.on('open', () => {
            console.log(chalk.green('✅ Kline stream connected'));
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleKlineData(message);
            } catch (error) {
                console.error(chalk.red('❌ Kline data parsing error:'), error);
            }
        });

        ws.on('error', (error) => {
            console.error(chalk.red('❌ Kline WebSocket error:'), error);
        });

        ws.on('close', (code, reason) => {
            console.log(chalk.yellow(`🔌 Kline connection closed: ${code} - ${reason}`));
        });

        this.connections.set('kline', ws);
    }

    connectAggTradeStream() {
        const tradeUrl = `${config.wsUrls.futures}/ws/${this.symbol}@aggTrade`;
        console.log(chalk.yellow('🔌 Connecting to trade stream...'));

        const ws = new WebSocket(tradeUrl);

        ws.on('open', () => {
            console.log(chalk.green('✅ Trade stream connected'));
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleTradeData(message);
            } catch (error) {
                console.error(chalk.red('❌ Trade data parsing error:'), error);
            }
        });

        ws.on('error', (error) => {
            console.error(chalk.red('❌ Trade WebSocket error:'), error);
        });

        ws.on('close', (code, reason) => {
            console.log(chalk.yellow(`🔌 Trade connection closed: ${code} - ${reason}`));
        });

        this.connections.set('trade', ws);
    }

    connectDepthStream() {
        const depthUrl = `${config.wsUrls.futures}/ws/${this.symbol}@depth@100ms`;
        console.log(chalk.yellow('🔌 Connecting to depth stream...'));

        const ws = new WebSocket(depthUrl);

        ws.on('open', () => {
            console.log(chalk.green('✅ Depth stream connected'));
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleDepthData(message);
            } catch (error) {
                console.error(chalk.red('❌ Depth data parsing error:'), error);
            }
        });

        ws.on('error', (error) => {
            console.error(chalk.red('❌ Depth WebSocket error:'), error);
        });

        ws.on('close', (code, reason) => {
            console.log(chalk.yellow(`🔌 Depth connection closed: ${code} - ${reason}`));
        });

        this.connections.set('depth', ws);
    }

    handleKlineData(message) {
        const kline = message.k;

        // If the bar is closed, update RSI with that bar’s close  
        if (kline.x) {
            this.rsiCalculator.addClosePrice(kline.c, kline.T);
        }

        // Log occasionally so the console isn’t spammed
        if (Date.now() % 60000 < 5000) {
            console.log(chalk.blue('📊 Kline Update:'), {
                close: parseFloat(kline.c).toFixed(2),
                volume: parseFloat(kline.v).toFixed(2),
                rsi: this.rsiCalculator.getRSI()
            });
        }

        // Feed kline into the bar aggregator
        const finalizedBar = this.barAggregator.handleKlineUpdate(message);

        // When a 4H bar closes…
        if (finalizedBar) {
            //
            // === 1) Finalise CVD, divergences, whales, imbalances ===
            //

            // ADD THIS: Delta pattern analysis
            const deltaPatterns = this.enhancedDeltaAnalyzer.onBarClose(finalizedBar);
            const closedCvd = this.cvdAnalyzer.onBarClose({
                close: finalizedBar.ohlc.close,
                endTime: finalizedBar.endTime
            });

            const divergence = this.cvdAnalyzer.detectDivergence(finalizedBar.endTime);
            const whales = this.whaleDetector.detectCluster(finalizedBar.endTime);

            const imbalances = {
                buy: (finalizedBar.imbalances || []).filter(i => i.direction === 'BUY').length,
                sell: (finalizedBar.imbalances || []).filter(i => i.direction === 'SELL').length
            };

            //
            // === 2) Finalise Volume Profile (VWAP, Value Area, Profile POC) ===
            //
            const vp = this.volumeProfile.finalizeBarAndGetMetrics();
            // Example: vp = { vwap, poc:{price,volume}, valueAreaLow, valueAreaHigh, totalVolume }

            //
            // === 3) Reliability Scoring Inputs from DOM ===
            //
            const domTop = this.orderBookManager.getTopLevels(20);
            const spread = ((domTop?.asks?.[0]?.price ?? 0) - (domTop?.bids?.[0]?.price ?? 0)) || 0;
            const totalBidsVol = (domTop?.bids || []).reduce((s, l) => s + (l.quantity || 0), 0);
            const totalAsksVol = (domTop?.asks || []).reduce((s, l) => s + (l.quantity || 0), 0);
            const ratio = totalAsksVol > 0 ? totalBidsVol / totalAsksVol : Infinity;

            const spoofingDetected = false; // wire your spoof detector here
            const extremeImbalance = ratio > 10 || ratio < 0.1;
            const wideSpread = spread > (config.tickSize * 5);
            const lowLiquidity = (totalBidsVol + totalAsksVol) < 100; // tune this

            const reliabilities = this.reliabilityScorer.compute({
                spoofingDetected,
                extremeImbalance,
                wideSpread,
                lowLiquidity
            });

            //
            // === 4) Build Checklist for audit trail ===
            //
            const checklistRes = this.checklist.build({
                rsi: this.rsiCalculator.getRSI(),
                price: finalizedBar.ohlc.close,
                vwap: vp.vwap,
                valueAreaLow: vp.valueAreaLow,
                valueAreaHigh: vp.valueAreaHigh,
                poc: vp.poc, // profile POC — or finalizedBar.poc if you prefer footprint POC
                cvd: closedCvd,
                imbalances,
                whales,
                deltaPatterns  // ← ADD THIS

            });

            //
            // === 5) Signal Engine using Reliability + VWAP/VA feature ===
            //
            const signal = this.signalEngine.analyzeWithReliability(
                {
                    rsi: this.rsiCalculator.getRSI(),
                    cvd: closedCvd,
                    divergence,
                    whales: this.whaleDetector.getLast(),
                    imbalances,
                    price: finalizedBar.ohlc.close,
                    vwap: vp.vwap,
                    valueAreaLow: vp.valueAreaLow,
                    valueAreaHigh: vp.valueAreaHigh,
                    poc: finalizedBar.poc // or vp.poc
                },
                reliabilities
            );

            //
            // === 6) Persist snapshot with EVERYTHING ===
            //
            this.processBarClose(finalizedBar, {
                closedCvd,
                divergence,
                whales,
                imbalances,
                signal,
                dom: domTop,
                vwapPack: vp,
                checklist: checklistRes
            });
        }
    }


    handleTradeData(message) {
        const classifiedTrade = this.tradeClassifier.classifyTrade(message);
        this.barAggregator.addTradeToBar(classifiedTrade);
        // Feed Volume Profile for VWAP/Value Area
        this.volumeProfile.addTrade(classifiedTrade.price, classifiedTrade.quantity);


        // Feed CVD and Whale
        this.cvdAnalyzer.onTrade({
            side: classifiedTrade.side,
            quantity: classifiedTrade.quantity,
            time: classifiedTrade.time,
            price: classifiedTrade.price
        });
        this.whaleDetector.onTrade({
            side: classifiedTrade.side,
            quantity: classifiedTrade.quantity,
            time: classifiedTrade.time,
            price: classifiedTrade.price
        });
// NEW: Feed new analyzers
  this.absorptionDetector.onTrade(classifiedTrade);
  const icebergDetection = this.icebergDetector.onTrade(classifiedTrade);
  const volumeAnomaly = this.volumeAnomalyDetector.onTrade(classifiedTrade);

  // Log significant detections
  if (icebergDetection) {
    console.log(chalk.cyan('🧊 Iceberg Order Detected:'), icebergDetection);
  }
  
  if (volumeAnomaly) {
    console.log(chalk.yellow('📊 Volume Anomaly:'), volumeAnomaly);
  }
        // Occasionally detect clusters (whales)
        if (classifiedTrade.tradeId % 300 === 0) {
            this.whaleDetector.detectCluster();
        }

        // Log every 500th trade
        if (classifiedTrade.tradeId % 500 === 0) {
            console.log(chalk.cyan('💰 Trade:'), {
                price: classifiedTrade.price,
                qty: classifiedTrade.quantity.toFixed(3),
                side: classifiedTrade.side,
                classification: classifiedTrade.classification
            });
        }

        if (classifiedTrade.tradeId % 1000 === 0) {
            this.tradeClassifier.clearOldTrades();
        }
    }

handleDepthData(message) {
  const success = this.orderBookManager.handleDepthUpdate(message);
  
  // NEW: Enhanced DOM analysis
  const domPatterns = this.enhancedDOMAnalyzer.onDepthUpdate(message, this.orderBookManager);
  if (domPatterns) {
    console.log(chalk.magenta('📚 DOM Patterns:'), domPatterns);
  }
}


processBarClose(finalizedBar, analytics) {
  const { closedCvd, divergence, whales, imbalances, signal, dom, vwapPack, checklist, deltaPatterns } = analytics;
const absorptionPattern = this.absorptionDetector.detectAbsorption();
const exhaustionPattern = this.exhaustionDetector.onBarClose(finalizedBar);
const activeIcebergs = this.icebergDetector.getActiveIcebergs();
const volumeImpact = this.volumeAnomalyDetector.getCumulativeBlockImpact();
const domStats = this.enhancedDOMAnalyzer.getDOMStats();
  // === VISUAL CHECKLIST (NEW - BEFORE SNAPSHOT) ===
  const checklistSummary = this.visualChecklist.displayOrderFlowChecklist({
    rsi: this.rsiCalculator.getRSI(),
    price: finalizedBar.ohlc.close,
    vwap: vwapPack.vwap,
    valueAreaLow: vwapPack.valueAreaLow,
    valueAreaHigh: vwapPack.valueAreaHigh,
    cvd: closedCvd,
    divergence,
    whales,
    imbalances,
    deltaPatterns,
    finalizedBar,
    interval: config.interval
  });

  const snapshot = {
    timestamp: Date.now(),
    barStart: finalizedBar.startTime,
    barEnd: finalizedBar.endTime,
    symbol: config.symbol,
    
    // Enhanced analytics
    deltaPatterns: deltaPatterns,
    visualChecklistSummary: checklistSummary, // NEW
    
    // ... rest of existing fields ...
    priceladder: finalizedBar.footprintArray,
    barTotals: {
      totalBuy: finalizedBar.totalBuyVolume,
      totalSell: finalizedBar.totalSellVolume,
      totalVolume: finalizedBar.totalBuyVolume + finalizedBar.totalSellVolume,
      netDelta: finalizedBar.totalDelta
    },
    ohlc: finalizedBar.ohlc,
    poc: finalizedBar.poc,
    dom: dom,
    rsi: this.rsiCalculator.getRSI(),
    cvd: {
      barCvd: closedCvd,
      divergence: divergence
    },
    whales: whales,
    imbalanceSummary: imbalances,
    volumeProfile: {
      vwap: vwapPack.vwap,
      valueAreaLow: vwapPack.valueAreaLow,
      valueAreaHigh: vwapPack.valueAreaHigh,
      poc: vwapPack.poc,
      totalVolume: vwapPack.totalVolume
    },
    checklist: {
      ...checklist.checklist,
      longConfluence: checklist.longConfluence,
      shortConfluence: checklist.shortConfluence
    },
    signal: signal,
    absorptionPattern: absorptionPattern,
exhaustionPattern: exhaustionPattern,
activeIcebergs: activeIcebergs,
volumeImpact: volumeImpact,
domStats: domStats
  };

  const fileName = `footprint_complete_${Date.now()}.json`;
  const filePath = path.join(config.outputPath, fileName);

  try {
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
    console.log(chalk.green(`✅ COMPLETE ${config.interval.toUpperCase()} footprint snapshot saved: ${filePath}`));
    
    // SIMPLE SUMMARY AFTER VISUAL CHECKLIST
    console.log(chalk.blue('📋 QUICK SUMMARY:'), {
      interval: config.interval.toUpperCase(),
      assessment: checklistSummary.overallSignal,
      confidence: `${checklistSummary.confidence}%`,
      rsi: this.rsiCalculator.getRSI(),
      delta: finalizedBar.totalDelta.toFixed(0),
      patterns: deltaPatterns.summary.totalPatterns
    });
    
  } catch (err) {
    console.error(chalk.red('❌ Failed to save snapshot:'), err);
  }
}




close() {
    console.log(chalk.yellow('🔌 Closing all WebSocket connections...'));

    for (const [name, ws] of this.connections) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.close();
            console.log(chalk.gray(`❌ ${name} connection closed`));
        }
    }

    this.connections.clear();
    console.log(chalk.blue('👋 Complete pipeline shutdown'));
}
}

// Initialize and start the pipeline
const pipeline = new BinanceOrderFlowPipeline();

// Windows-specific graceful shutdown handling
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 Received Ctrl+C (SIGINT), shutting down gracefully...'));
    pipeline.close();
    setTimeout(() => process.exit(0), 1000);
});

process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n🛑 Received SIGTERM, shutting down gracefully...'));
    pipeline.close();
    setTimeout(() => process.exit(0), 1000);
});

// Windows specific - handle console window close
if (process.platform === "win32") {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.on("SIGINT", () => {
        process.emit("SIGINT");
    });
}

// Start the complete pipeline
pipeline.start().catch((error) => {
    console.error(chalk.red('❌ Pipeline startup failed:'), error);
    setTimeout(() => process.exit(1), 1000);
});
