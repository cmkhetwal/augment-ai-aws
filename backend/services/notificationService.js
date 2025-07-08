const axios = require('axios');
const NodeCache = require('node-cache');

class NotificationService {
  constructor() {
    this.alertCache = new NodeCache({ stdTTL: 300 }); // 5 min cache to prevent spam
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
    
    // Load configuration from environment variables
    this.config = {
      email: {
        enabled: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',
        smtpHost: process.env.SMTP_HOST,
        smtpPort: process.env.SMTP_PORT || 587,
        smtpUser: process.env.SMTP_USER,
        smtpPass: process.env.SMTP_PASS,
        fromEmail: process.env.FROM_EMAIL,
        toEmails: process.env.TO_EMAILS ? process.env.TO_EMAILS.split(',') : []
      },
      slack: {
        enabled: process.env.SLACK_NOTIFICATIONS_ENABLED === 'true',
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_CHANNEL || '#aws-monitoring',
        username: process.env.SLACK_USERNAME || 'AWS Monitor Bot'
      },
      googleChat: {
        enabled: process.env.GOOGLE_CHAT_NOTIFICATIONS_ENABLED === 'true',
        webhookUrl: process.env.GOOGLE_CHAT_WEBHOOK_URL
      }
    };

    console.log('Notification Service initialized with:');
    console.log(`- Email: ${this.config.email.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`- Slack: ${this.config.slack.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`- Google Chat: ${this.config.googleChat.enabled ? 'Enabled' : 'Disabled'}`);
  }

  // Check if alert should be sent (prevents spam)
  shouldSendAlert(alertKey) {
    const lastSent = this.alertCache.get(alertKey);
    if (lastSent) {
      return false; // Alert already sent recently
    }
    this.alertCache.set(alertKey, Date.now());
    return true;
  }

  // Retry mechanism for failed notifications
  async retryRequest(requestFn, attempts = this.retryAttempts) {
    for (let i = 0; i < attempts; i++) {
      try {
        return await requestFn();
      } catch (error) {
        if (i === attempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (i + 1)));
      }
    }
  }

  // Send Slack notification
  async sendSlackNotification(alert) {
    if (!this.config.slack.enabled || !this.config.slack.webhookUrl) {
      return { success: false, reason: 'Slack not configured' };
    }

    const color = this.getAlertColor(alert.severity);
    const payload = {
      channel: this.config.slack.channel,
      username: this.config.slack.username,
      attachments: [{
        color: color,
        title: `🚨 ${alert.title}`,
        text: alert.message,
        fields: [
          {
            title: 'Instance',
            value: alert.instanceName || alert.instanceId,
            short: true
          },
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Time',
            value: new Date(alert.timestamp).toLocaleString(),
            short: true
          },
          ...(alert.metrics ? [{
            title: 'Metrics',
            value: this.formatMetrics(alert.metrics),
            short: false
          }] : [])
        ]
      }]
    };

    try {
      await this.retryRequest(async () => {
        const response = await axios.post(this.config.slack.webhookUrl, payload, {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' }
        });
        return response.data;
      });

      console.log(`Slack notification sent for ${alert.instanceId}`);
      return { success: true };
    } catch (error) {
      console.error('Failed to send Slack notification:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Send Google Chat notification
  async sendGoogleChatNotification(alert) {
    if (!this.config.googleChat.enabled || !this.config.googleChat.webhookUrl) {
      return { success: false, reason: 'Google Chat not configured' };
    }

    const payload = {
      text: `🚨 *${alert.title}*\n\n` +
            `📍 *Instance:* ${alert.instanceName || alert.instanceId}\n` +
            `⚠️ *Severity:* ${alert.severity.toUpperCase()}\n` +
            `📊 *Message:* ${alert.message}\n` +
            `🕒 *Time:* ${new Date(alert.timestamp).toLocaleString()}` +
            (alert.metrics ? `\n📈 *Metrics:*\n${this.formatMetrics(alert.metrics)}` : '')
    };

    try {
      await this.retryRequest(async () => {
        const response = await axios.post(this.config.googleChat.webhookUrl, payload, {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' }
        });
        return response.data;
      });

      console.log(`Google Chat notification sent for ${alert.instanceId}`);
      return { success: true };
    } catch (error) {
      console.error('Failed to send Google Chat notification:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Send email notification
  async sendEmailNotification(alert) {
    if (!this.config.email.enabled) {
      return { success: false, reason: 'Email not configured' };
    }

    // For email, we'll use a simple approach with axios to call an email service
    // In production, you might want to use nodemailer or an email service API
    const subject = `AWS EC2 Alert: ${alert.title}`;
    const body = `
      AWS EC2 Monitoring Alert

      Instance: ${alert.instanceName || alert.instanceId}
      Severity: ${alert.severity.toUpperCase()}
      Time: ${new Date(alert.timestamp).toLocaleString()}

      Message: ${alert.message}

      ${alert.metrics ? 'Metrics:\n' + this.formatMetrics(alert.metrics) : ''}

      Please investigate this issue as soon as possible.

      ---
      AWS EC2 Monitor
    `;

    try {
      // This is a placeholder for email sending
      // In a real implementation, you'd integrate with your email service
      console.log(`Email notification prepared for ${alert.instanceId}:`);
      console.log(`Subject: ${subject}`);
      console.log(`Body: ${body}`);
      
      return { success: true, note: 'Email prepared (implement actual sending)' };
    } catch (error) {
      console.error('Failed to send email notification:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Send notification to all configured channels
  async sendAlert(alert) {
    const alertKey = `${alert.instanceId}_${alert.type}_${alert.severity}`;
    
    if (!this.shouldSendAlert(alertKey)) {
      console.log(`Alert suppressed for ${alert.instanceId} - recently sent`);
      return { suppressed: true };
    }

    const results = {};

    // Send to all configured channels in parallel
    const notifications = [];

    if (this.config.slack.enabled) {
      notifications.push(
        this.sendSlackNotification(alert)
          .then(result => { results.slack = result; })
          .catch(error => { results.slack = { success: false, error: error.message }; })
      );
    }

    if (this.config.googleChat.enabled) {
      notifications.push(
        this.sendGoogleChatNotification(alert)
          .then(result => { results.googleChat = result; })
          .catch(error => { results.googleChat = { success: false, error: error.message }; })
      );
    }

    if (this.config.email.enabled) {
      notifications.push(
        this.sendEmailNotification(alert)
          .then(result => { results.email = result; })
          .catch(error => { results.email = { success: false, error: error.message }; })
      );
    }

    await Promise.all(notifications);

    console.log(`Alert sent for ${alert.instanceId}:`, results);
    return results;
  }

  // Helper methods
  getAlertColor(severity) {
    switch (severity.toLowerCase()) {
      case 'critical': return '#ff0000';
      case 'high': return '#ff6600';
      case 'medium': return '#ffcc00';
      case 'low': return '#00ff00';
      default: return '#808080';
    }
  }

  formatMetrics(metrics) {
    const formatted = [];
    if (metrics.cpu) formatted.push(`CPU: ${metrics.cpu}%`);
    if (metrics.memory) formatted.push(`Memory: ${metrics.memory}%`);
    if (metrics.disk) formatted.push(`Disk: ${metrics.disk}%`);
    if (metrics.network) formatted.push(`Network: ${metrics.network}`);
    return formatted.join(' | ');
  }

  // Alert type helpers
  createHighCPUAlert(instanceId, instanceName, cpuUsage) {
    return {
      instanceId,
      instanceName,
      type: 'high_cpu',
      severity: cpuUsage > 90 ? 'critical' : cpuUsage > 80 ? 'high' : 'medium',
      title: 'High CPU Usage Detected',
      message: `CPU usage is at ${cpuUsage}% on instance ${instanceName}`,
      timestamp: new Date(),
      metrics: { cpu: cpuUsage }
    };
  }

  createHighMemoryAlert(instanceId, instanceName, memoryUsage) {
    return {
      instanceId,
      instanceName,
      type: 'high_memory',
      severity: memoryUsage > 90 ? 'critical' : memoryUsage > 80 ? 'high' : 'medium',
      title: 'High Memory Usage Detected',
      message: `Memory usage is at ${memoryUsage}% on instance ${instanceName}`,
      timestamp: new Date(),
      metrics: { memory: memoryUsage }
    };
  }

  createInstanceDownAlert(instanceId, instanceName) {
    return {
      instanceId,
      instanceName,
      type: 'instance_down',
      severity: 'critical',
      title: 'Instance Down',
      message: `Instance ${instanceName} is not responding to ping checks`,
      timestamp: new Date()
    };
  }

  createSecurityAlert(instanceId, instanceName, riskPorts) {
    return {
      instanceId,
      instanceName,
      type: 'security_risk',
      severity: 'high',
      title: 'Security Risk Detected',
      message: `Instance ${instanceName} has ${riskPorts.length} high-risk ports open: ${riskPorts.join(', ')}`,
      timestamp: new Date()
    };
  }

  // Configuration management
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('Notification configuration updated');
  }

  // Website monitoring specific alerts
  async sendWebsiteDownAlert(website, result) {
    const alertKey = `website_down_${website.id}`;
    if (this.alertCache.get(alertKey)) {
      return; // Prevent spam
    }

    this.alertCache.set(alertKey, true);

    const alert = {
      instanceId: website.id,
      type: 'website_down',
      severity: 'critical',
      title: `🚨 Website Down: ${website.name}`,
      message: `Website ${website.name} (${website.url}) is down.\nStatus: ${result.status}\nError: ${result.error || 'Unknown error'}\nResponse Time: ${result.responseTime}ms`,
      timestamp: new Date().toISOString(),
      metadata: {
        website: website.name,
        url: website.url,
        status: result.status,
        responseTime: result.responseTime,
        error: result.error
      }
    };

    await this.sendAlert(alert);
  }

  async sendWebsiteUpAlert(website, result) {
    const alertKey = `website_up_${website.id}`;
    if (this.alertCache.get(alertKey)) {
      return; // Prevent spam
    }

    this.alertCache.set(alertKey, true);

    const alert = {
      instanceId: website.id,
      type: 'website_up',
      severity: 'info',
      title: `✅ Website Recovered: ${website.name}`,
      message: `Website ${website.name} (${website.url}) is back online.\nStatus: ${result.status}\nResponse Time: ${result.responseTime}ms`,
      timestamp: new Date().toISOString(),
      metadata: {
        website: website.name,
        url: website.url,
        status: result.status,
        responseTime: result.responseTime
      }
    };

    await this.sendAlert(alert);
  }

  async sendSSLExpiryAlert(website, sslInfo) {
    const alertKey = `ssl_expiry_${website.id}_${sslInfo.daysUntilExpiry}`;
    if (this.alertCache.get(alertKey)) {
      return; // Prevent spam
    }

    this.alertCache.set(alertKey, true);

    const urgency = sslInfo.daysUntilExpiry <= 7 ? '🚨' : sslInfo.daysUntilExpiry <= 30 ? '⚠️' : '🔒';
    const severity = sslInfo.daysUntilExpiry <= 7 ? 'critical' : sslInfo.daysUntilExpiry <= 30 ? 'warning' : 'info';

    const alert = {
      instanceId: website.id,
      type: 'ssl_expiry',
      severity: severity,
      title: `${urgency} SSL Certificate Expiring: ${website.name}`,
      message: `SSL certificate for ${website.name} (${website.url}) expires in ${sslInfo.daysUntilExpiry} days.\nExpiry Date: ${new Date(sslInfo.validTo).toLocaleDateString()}`,
      timestamp: new Date().toISOString(),
      metadata: {
        website: website.name,
        url: website.url,
        daysUntilExpiry: sslInfo.daysUntilExpiry,
        expiryDate: sslInfo.validTo
      }
    };

    await this.sendAlert(alert);
  }

  getConfig() {
    // Return config without sensitive data
    return {
      email: { enabled: this.config.email.enabled },
      slack: { enabled: this.config.slack.enabled, channel: this.config.slack.channel },
      googleChat: { enabled: this.config.googleChat.enabled }
    };
  }
}

module.exports = new NotificationService();