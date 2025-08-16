// src/utils/timezone-formatter.js - NEW FILE
import { config } from '../../config.js';

export class TimezoneFormatter {
  static formatTime(timestamp, includeDate = true) {
    try {
      const date = new Date(timestamp);
      
      if (includeDate) {
        return date.toLocaleString('en-SG', {
          timeZone: config.displayTimezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      } else {
        return date.toLocaleTimeString('en-SG', {
          timeZone: config.displayTimezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      }
    } catch (error) {
      // Fallback to UTC if timezone fails
      return new Date(timestamp).toISOString();
    }
  }

  static getCurrentTime() {
    return this.formatTime(Date.now(), false);
  }

  static getCurrentDateTime() {
    return this.formatTime(Date.now(), true);
  }
}
