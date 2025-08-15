// src/utils/config-validator.js - NEW FILE
export class ConfigValidator {
  static validate(config) {
    const errors = [];

    // Validate interval format
    if (!config.interval.match(/^\d+[smhd]$/)) {
      errors.push(`Invalid interval format: ${config.interval}`);
    }

    // Validate numeric values
    if (config.rsiPeriod < 5 || config.rsiPeriod > 50) {
      errors.push(`RSI period should be between 5 and 50, got: ${config.rsiPeriod}`);
    }

    if (config.tickSize <= 0) {
      errors.push(`Tick size must be positive, got: ${config.tickSize}`);
    }

    // Validate URLs
    if (!config.wsUrls.futures.startsWith('wss://')) {
      errors.push(`Invalid WebSocket URL: ${config.wsUrls.futures}`);
    }

    return errors;
  }
}
