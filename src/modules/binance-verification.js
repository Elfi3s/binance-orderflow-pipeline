// src/modules/binance-verification.js - NEW FILE FOR VERIFICATION
import fetch from 'node-fetch';
import { config } from '../../config.js';

export class BinanceVerification {
  static async getOfficialKline(startTime, endTime) {
    try {
      const url = `${config.restUrls.futures}/fapi/v1/klines?symbol=${config.symbol}&interval=${config.interval}&startTime=${startTime}&endTime=${endTime}&limit=1`;
      
      const response = await fetch(url);
      const klines = await response.json();
      
      if (klines.length > 0) {
        const kline = klines[0];
        return {
          volume: parseFloat(kline[2]), // Volume
          quoteVolume: parseFloat(kline[3]), // Quote asset volume
          trades: parseInt(kline[4]), // Number of trades
          buyVolume: parseFloat(kline[5]), // Taker buy base asset volume
          buyQuoteVolume: parseFloat(kline[6]) // Taker buy quote asset volume
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching official kline:', error);
      return null;
    }
  }
}
