// config.js
import path from 'path';

export const config = {
  symbol: 'ETHUSDT',
  interval: '15m',
  
  // Binance WebSocket URLs
  wsUrls: {
    futures: 'wss://fstream.binance.com',
    spot: 'wss://stream.binance.com:9443'
  },
  
  // REST API URLs
  restUrls: {
    futures: 'https://fapi.binance.com',
    spot: 'https://api.binance.com'
  },
  
  // Trading parameters
  tickSize: 0.01, // ETHUSDT tick size
  rsiPeriod: 14,
  imbalanceThreshold: 2.5, // 250% threshold for stacked imbalances
  domDepth: 20, // Top 20 levels for DOM
  
  // Output settings (Windows paths)
outputPath: path.resolve('./data/snapshots'),
logPath: path.resolve('./logs'),
logLevel: 'info'
};
