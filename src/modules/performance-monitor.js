// src/modules/performance-monitor.js - NEW FILE
export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      tradesProcessed: 0,
      barsCompleted: 0,
      signalsGenerated: 0,
      averageProcessingTime: 0,
      memoryUsage: 0,
      uptime: Date.now()
    };
    this.startTime = Date.now();
  }

  recordTradeProcessing(processingTimeMs) {
    this.metrics.tradesProcessed++;
    this.updateAverageProcessingTime(processingTimeMs);
  }

  recordBarCompletion() {
    this.metrics.barsCompleted++;
  }

  getStats() {
    const uptimeSeconds = (Date.now() - this.startTime) / 1000;
    this.metrics.memoryUsage = process.memoryUsage();
    
    return {
      ...this.metrics,
      uptimeSeconds: uptimeSeconds,
      tradesPerSecond: this.metrics.tradesProcessed / uptimeSeconds
    };
  }

  updateAverageProcessingTime(processingTimeMs) {
  const currentAvg = this.metrics.averageProcessingTime;
  const count = this.metrics.tradesProcessed;
  this.metrics.averageProcessingTime = ((currentAvg * (count - 1)) + processingTimeMs) / count;
}
}
