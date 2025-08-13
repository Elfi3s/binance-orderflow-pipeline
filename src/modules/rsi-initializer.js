// src\modules\rsi-initializer.js
import fetch from 'node-fetch';
import chalk from 'chalk';
import { config } from '../../config.js';

export class RSIInitializer {
  constructor() {
    this.symbol = config.symbol;
  }

  async initializeRSIWithHistory(rsiCalculator, periodsNeeded = 20) {
    console.log(chalk.yellow(`📈 Initializing RSI with ${periodsNeeded} historical 4H bars...`));
    
    try {
      // Fetch historical 4H klines
      const historicalKlines = await this.fetchHistoricalKlines(periodsNeeded);
      
      if (historicalKlines.length === 0) {
        console.log(chalk.red('❌ No historical klines fetched'));
        return false;
      }

      // Add historical closes to RSI calculator
      let addedCount = 0;
      for (const kline of historicalKlines) {
        const closePrice = parseFloat(kline[4]); // Close price
        const closeTime = kline[1]; // Close time
        
        rsiCalculator.addClosePrice(closePrice, closeTime);
        addedCount++;
      }

      const rsiStats = rsiCalculator.getStats();
      console.log(chalk.green(`✅ RSI initialized with ${addedCount} historical periods`));
      console.log(chalk.blue('📊 Initial RSI Stats:'), {
        rsi: rsiStats.rsi,
        signal: rsiStats.signal,
        trend: rsiStats.trend,
        dataPoints: rsiStats.dataPoints
      });

      return true;

    } catch (error) {
      console.error(chalk.red('❌ RSI initialization failed:'), error);
      return false;
    }
  }

  async fetchHistoricalKlines(limit) {
    try {
      // Get the last N completed 4H klines
      const url = `${config.restUrls.futures}/fapi/v1/klines?symbol=${this.symbol}&interval=4h&limit=${limit}`;
      
      console.log(chalk.gray('🔗 Fetching from:'), url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      
      const klines = await response.json();
      
      if (klines.error) {
        throw new Error(`Binance API Error: ${klines.msg}`);
      }

      // Filter out the current incomplete kline (last one)
      const completedKlines = klines.slice(0, -1);
      
      console.log(chalk.green(`📊 Fetched ${completedKlines.length} completed 4H klines`));
      
      // Log sample data for verification
      if (completedKlines.length > 0) {
        const latestKline = completedKlines[completedKlines.length - 1];
        console.log(chalk.gray('📈 Latest historical bar:'), {
          openTime: new Date(latestKline[0]).toLocaleString(),
          closeTime: new Date(latestKline[1]).toLocaleString(),
          open: latestKline[2],
          high: latestKline[3], 
          low: latestKline[4],
          close: latestKline[5],
          volume: latestKline[6]
        });
      }
      
      return completedKlines;
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to fetch historical klines:'), error);
      return [];
    }
  }
}
