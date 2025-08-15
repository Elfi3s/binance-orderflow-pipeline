// src/modules/alert-manager.js - NEW FILE
export class AlertManager {
  constructor() {
    this.alertRules = new Map();
    this.recentAlerts = [];
    this.cooldownPeriod = 60000; // 1 minute cooldown
  }

  addRule(name, condition, priority = 'MEDIUM') {
    this.alertRules.set(name, { condition, priority, lastTriggered: 0 });
  }

  checkAlerts(data) {
    const alerts = [];
    const now = Date.now();

    for (const [name, rule] of this.alertRules.entries()) {
      if (now - rule.lastTriggered > this.cooldownPeriod) {
        if (rule.condition(data)) {
          const alert = {
            name: name,
            priority: rule.priority,
            timestamp: now,
            data: data
          };
          alerts.push(alert);
          rule.lastTriggered = now;
          this.recentAlerts.push(alert);
        }
      }
    }

    return alerts;
  }
}
