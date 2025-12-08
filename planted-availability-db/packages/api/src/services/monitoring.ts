/**
 * Monitoring & Alerting Service
 *
 * Tracks scraper health, API performance, and system metrics.
 * Sends alerts via email, Slack, or webhooks when issues are detected.
 */

import { getFirestore, Timestamp } from 'firebase-admin/firestore';

export interface ScraperHealth {
  scraper_id: string;
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'inactive';
  last_run: Date | null;
  last_success: Date | null;
  success_rate_7d: number;
  avg_duration_ms: number;
  items_scraped_7d: number;
  error_count_7d: number;
  next_run: Date | null;
}

export interface SystemMetrics {
  timestamp: Date;
  api_requests_1h: number;
  api_errors_1h: number;
  avg_response_time_ms: number;
  cache_hit_rate: number;
  firestore_reads_1h: number;
  firestore_writes_1h: number;
  active_venues: number;
  active_dishes: number;
  stale_records: number;
}

export interface Alert {
  id: string;
  type: 'scraper_failure' | 'high_error_rate' | 'stale_data' | 'quota_warning' | 'system_error';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  scraper_id?: string;
  created_at: Date;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: Date;
}

export interface AlertConfig {
  slack_webhook_url?: string;
  email_recipients?: string[];
  webhook_url?: string;
  thresholds: {
    scraper_failure_count: number; // Alert after N consecutive failures
    error_rate_percent: number; // Alert if error rate exceeds this
    stale_records_percent: number; // Alert if stale records exceed this
    response_time_ms: number; // Alert if avg response time exceeds this
  };
}

const DEFAULT_THRESHOLDS = {
  scraper_failure_count: 3,
  error_rate_percent: 5,
  stale_records_percent: 20,
  response_time_ms: 2000,
};

/**
 * Monitoring service
 */
export class MonitoringService {
  private db = getFirestore();
  private config: AlertConfig;

  constructor(config: Partial<AlertConfig> = {}) {
    this.config = {
      slack_webhook_url: config.slack_webhook_url || process.env.SLACK_WEBHOOK_URL,
      email_recipients: config.email_recipients || [],
      webhook_url: config.webhook_url,
      thresholds: { ...DEFAULT_THRESHOLDS, ...config.thresholds },
    };
  }

  /**
   * Get health status of all scrapers
   */
  async getAllScrapersHealth(): Promise<ScraperHealth[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const runsSnapshot = await this.db
      .collection('scraper_runs')
      .where('started_at', '>=', Timestamp.fromDate(sevenDaysAgo))
      .orderBy('started_at', 'desc')
      .get();

    // Group runs by scraper
    const scraperRuns = new Map<string, any[]>();
    for (const doc of runsSnapshot.docs) {
      const data = doc.data();
      const runs = scraperRuns.get(data.scraper_id) || [];
      runs.push({ id: doc.id, ...data });
      scraperRuns.set(data.scraper_id, runs);
    }

    const healthResults: ScraperHealth[] = [];

    for (const [scraperId, runs] of scraperRuns) {
      const successfulRuns = runs.filter(r => r.status === 'completed');
      const failedRuns = runs.filter(r => r.status === 'failed');
      const lastRun = runs[0];
      const lastSuccess = successfulRuns[0];

      const avgDuration = successfulRuns.length > 0
        ? successfulRuns.reduce((sum, r) => {
            if (r.completed_at && r.started_at) {
              return sum + (r.completed_at.toDate().getTime() - r.started_at.toDate().getTime());
            }
            return sum;
          }, 0) / successfulRuns.length
        : 0;

      const totalItems = successfulRuns.reduce((sum, r) => {
        return sum + (r.stats?.venues_updated || 0) + (r.stats?.dishes_found || 0);
      }, 0);

      // Determine health status
      let status: ScraperHealth['status'] = 'healthy';
      const recentFailures = runs.slice(0, 3).filter(r => r.status === 'failed').length;

      if (recentFailures >= 3) {
        status = 'critical';
      } else if (recentFailures >= 1) {
        status = 'warning';
      } else if (!lastRun || (Date.now() - lastRun.started_at.toDate().getTime()) > 48 * 60 * 60 * 1000) {
        status = 'inactive';
      }

      healthResults.push({
        scraper_id: scraperId,
        name: this.getScraperName(scraperId),
        status,
        last_run: lastRun?.started_at?.toDate() || null,
        last_success: lastSuccess?.started_at?.toDate() || null,
        success_rate_7d: runs.length > 0 ? (successfulRuns.length / runs.length) * 100 : 0,
        avg_duration_ms: avgDuration,
        items_scraped_7d: totalItems,
        error_count_7d: failedRuns.length,
        next_run: lastRun?.next_run?.toDate() || null,
      });
    }

    return healthResults.sort((a, b) => {
      const statusOrder = { critical: 0, warning: 1, inactive: 2, healthy: 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    // Count active records
    const [venuesCount, dishesCount, staleCount] = await Promise.all([
      this.db.collection('venues').where('status', '==', 'active').count().get(),
      this.db.collection('dishes').where('status', '==', 'active').count().get(),
      this.db.collection('venues').where('status', '==', 'stale').count().get(),
    ]);

    return {
      timestamp: new Date(),
      api_requests_1h: 0, // Would need Cloud Monitoring API
      api_errors_1h: 0,
      avg_response_time_ms: 0,
      cache_hit_rate: 0,
      firestore_reads_1h: 0,
      firestore_writes_1h: 0,
      active_venues: venuesCount.data().count,
      active_dishes: dishesCount.data().count,
      stale_records: staleCount.data().count,
    };
  }

  /**
   * Check for issues and create alerts
   */
  async checkAndAlert(): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const health = await this.getAllScrapersHealth();

    // Check for critical scrapers
    for (const scraper of health) {
      if (scraper.status === 'critical') {
        const alert = await this.createAlert({
          type: 'scraper_failure',
          severity: 'critical',
          title: `Scraper ${scraper.name} is failing`,
          message: `${scraper.name} has failed ${scraper.error_count_7d} times in the last 7 days. Last success: ${scraper.last_success?.toISOString() || 'never'}`,
          scraper_id: scraper.scraper_id,
        });
        alerts.push(alert);
      }
    }

    // Check for stale data
    const metrics = await this.getSystemMetrics();
    const totalRecords = metrics.active_venues + metrics.stale_records;
    const stalePercent = totalRecords > 0 ? (metrics.stale_records / totalRecords) * 100 : 0;

    if (stalePercent > this.config.thresholds.stale_records_percent) {
      const alert = await this.createAlert({
        type: 'stale_data',
        severity: 'warning',
        title: 'High number of stale records',
        message: `${stalePercent.toFixed(1)}% of records are stale (${metrics.stale_records} venues)`,
      });
      alerts.push(alert);
    }

    return alerts;
  }

  /**
   * Create and store an alert
   */
  async createAlert(data: Omit<Alert, 'id' | 'created_at' | 'acknowledged'>): Promise<Alert> {
    const alert: Alert = {
      ...data,
      id: '',
      created_at: new Date(),
      acknowledged: false,
    };

    const docRef = await this.db.collection('alerts').add({
      ...alert,
      created_at: Timestamp.fromDate(alert.created_at),
    });

    alert.id = docRef.id;

    // Send notifications
    await this.sendNotifications(alert);

    return alert;
  }

  /**
   * Send alert notifications
   */
  private async sendNotifications(alert: Alert): Promise<void> {
    // Slack notification
    if (this.config.slack_webhook_url) {
      await this.sendSlackNotification(alert);
    }

    // Custom webhook
    if (this.config.webhook_url) {
      await this.sendWebhookNotification(alert);
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(alert: Alert): Promise<void> {
    const emoji = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🚨',
    };

    const color = {
      info: '#36a64f',
      warning: '#ff9800',
      critical: '#dc3545',
    };

    try {
      await fetch(this.config.slack_webhook_url!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachments: [{
            color: color[alert.severity],
            title: `${emoji[alert.severity]} ${alert.title}`,
            text: alert.message,
            fields: [
              { title: 'Type', value: alert.type, short: true },
              { title: 'Severity', value: alert.severity, short: true },
            ],
            footer: 'PAD Monitoring',
            ts: Math.floor(alert.created_at.getTime() / 1000),
          }],
        }),
      });
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(alert: Alert): Promise<void> {
    try {
      await fetch(this.config.webhook_url!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
      });
    } catch (error) {
      console.error('Failed to send webhook notification:', error);
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    await this.db.collection('alerts').doc(alertId).update({
      acknowledged: true,
      acknowledged_by: userId,
      acknowledged_at: Timestamp.now(),
    });
  }

  /**
   * Get unacknowledged alerts
   */
  async getActiveAlerts(): Promise<Alert[]> {
    const snapshot = await this.db
      .collection('alerts')
      .where('acknowledged', '==', false)
      .orderBy('created_at', 'desc')
      .limit(50)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at.toDate(),
    })) as Alert[];
  }

  /**
   * Get scraper name from ID
   */
  private getScraperName(scraperId: string): string {
    const names: Record<string, string> = {
      'coop-ch': 'Coop Switzerland',
      'migros-ch': 'Migros Switzerland',
      'rewe-de': 'REWE Germany',
      'edeka-de': 'EDEKA Germany',
      'wolt-de': 'Wolt Germany',
      'lieferando-de': 'Lieferando Germany',
      'deliveroo-uk': 'Deliveroo UK',
      'sainsburys-uk': "Sainsbury's UK",
      'waitrose-uk': 'Waitrose UK',
      'albert-heijn-nl': 'Albert Heijn Netherlands',
      'carrefour-fr': 'Carrefour France',
      'glovo-es': 'Glovo Spain',
    };
    return names[scraperId] || scraperId;
  }
}

// Singleton instance
let monitoringService: MonitoringService | null = null;

export function getMonitoringService(config?: Partial<AlertConfig>): MonitoringService {
  if (!monitoringService) {
    monitoringService = new MonitoringService(config);
  }
  return monitoringService;
}

/**
 * Scheduled health check function (call from Cloud Scheduler)
 */
export async function runHealthCheck(): Promise<{
  healthy: boolean;
  alerts: Alert[];
  metrics: SystemMetrics;
}> {
  const service = getMonitoringService();
  const [alerts, metrics] = await Promise.all([
    service.checkAndAlert(),
    service.getSystemMetrics(),
  ]);

  const criticalAlerts = alerts.filter(a => a.severity === 'critical');

  return {
    healthy: criticalAlerts.length === 0,
    alerts,
    metrics,
  };
}
