const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const dns = require('dns').promises;
const notificationService = require('./notificationService');

class WebsiteMonitoringService {
  constructor() {
    this.monitoredSites = new Map();
    this.monitoringResults = new Map();
    this.monitoringInterval = null;
  }

  // Add a website to monitor
  async addWebsite(websiteData) {
    const { url, name, checkInterval = 300000, alertThreshold = 5000 } = websiteData;
    
    if (!url || !name) {
      throw new Error('URL and name are required');
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      throw new Error('Invalid URL format');
    }

    const websiteId = crypto.randomUUID();
    const website = {
      id: websiteId,
      url,
      name,
      checkInterval,
      alertThreshold,
      createdAt: new Date(),
      isActive: true
    };

    this.monitoredSites.set(websiteId, website);
    
    // Initialize monitoring results
    this.monitoringResults.set(websiteId, {
      websiteId,
      status: 'pending',
      lastCheck: null,
      uptime: 100,
      responseTime: 0,
      statusCode: null,
      sslInfo: null,
      dnsInfo: null,
      securityHeaders: {},
      performanceMetrics: {},
      checks: []
    });

    // Perform initial check
    await this.checkWebsite(websiteId);
    
    return website;
  }

  // Update a website
  async updateWebsite(websiteId, updateData) {
    const website = this.monitoredSites.get(websiteId);
    if (!website) {
      throw new Error('Website not found');
    }

    const { url, name, checkInterval, alertThreshold } = updateData;

    if (!url || !name) {
      throw new Error('URL and name are required');
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      throw new Error('Invalid URL format');
    }

    // Update website properties
    website.url = url;
    website.name = name;
    website.checkInterval = checkInterval || 300000;
    website.alertThreshold = alertThreshold || 5000;
    website.updatedAt = new Date();

    this.monitoredSites.set(websiteId, website);

    return website;
  }

  // Remove a website from monitoring
  removeWebsite(websiteId) {
    const removed = this.monitoredSites.delete(websiteId);
    this.monitoringResults.delete(websiteId);
    return removed;
  }

  // Get all monitored websites
  getMonitoredWebsites() {
    return Array.from(this.monitoredSites.values());
  }

  // Get monitoring results for a specific website
  getWebsiteResults(websiteId) {
    return this.monitoringResults.get(websiteId);
  }

  // Get all monitoring results
  getAllResults() {
    return Array.from(this.monitoringResults.values());
  }

  // Perform comprehensive website check
  async checkWebsite(websiteId) {
    const website = this.monitoredSites.get(websiteId);
    if (!website || !website.isActive) {
      return null;
    }

    const startTime = Date.now();
    const checkResult = {
      timestamp: new Date(),
      status: 'checking',
      responseTime: 0,
      statusCode: null,
      error: null,
      sslInfo: null,
      dnsInfo: null,
      securityHeaders: {},
      performanceMetrics: {}
    };

    try {
      // DNS resolution check
      const urlObj = new URL(website.url);
      checkResult.dnsInfo = await this.checkDNS(urlObj.hostname);

      // HTTP/HTTPS check
      const httpResult = await this.checkHTTP(website.url);
      checkResult.statusCode = httpResult.statusCode;
      checkResult.responseTime = httpResult.responseTime;
      checkResult.securityHeaders = httpResult.securityHeaders;
      checkResult.performanceMetrics = httpResult.performanceMetrics;

      // SSL certificate check (for HTTPS)
      if (urlObj.protocol === 'https:') {
        checkResult.sslInfo = await this.checkSSL(urlObj.hostname, urlObj.port || 443);
      }

      checkResult.status = httpResult.statusCode >= 200 && httpResult.statusCode < 400 ? 'up' : 'down';
      
    } catch (error) {
      checkResult.status = 'down';
      checkResult.error = error.message;
      checkResult.responseTime = Date.now() - startTime;
    }

    // Update monitoring results
    const results = this.monitoringResults.get(websiteId);
    if (results) {
      results.lastCheck = checkResult.timestamp;
      results.status = checkResult.status;
      results.responseTime = checkResult.responseTime;
      results.statusCode = checkResult.statusCode;
      results.sslInfo = checkResult.sslInfo;
      results.dnsInfo = checkResult.dnsInfo;
      results.securityHeaders = checkResult.securityHeaders;
      results.performanceMetrics = checkResult.performanceMetrics;

      // Add to checks history (keep last 100 checks)
      results.checks.unshift(checkResult);
      if (results.checks.length > 100) {
        results.checks = results.checks.slice(0, 100);
      }

      // Calculate uptime percentage (last 24 hours)
      results.uptime = this.calculateUptime(results.checks);

      // Send alerts based on status changes and SSL expiry
      await this.checkAndSendAlerts(website, checkResult, results);
    }

    return checkResult;
  }

  // Check and send alerts based on website status and SSL expiry
  async checkAndSendAlerts(website, checkResult, results) {
    try {
      // Get previous status from checks history
      const previousStatus = results.checks.length > 1 ? results.checks[1].status : null;
      const currentStatus = checkResult.status;

      // Website down alert
      if (currentStatus === 'down' && previousStatus !== 'down') {
        await notificationService.sendWebsiteDownAlert(website, checkResult);
      }

      // Website recovery alert
      if (currentStatus === 'up' && previousStatus === 'down') {
        await notificationService.sendWebsiteUpAlert(website, checkResult);
      }

      // SSL certificate expiry alerts
      if (checkResult.sslInfo && checkResult.sslInfo.valid && checkResult.sslInfo.daysUntilExpiry) {
        const daysUntilExpiry = checkResult.sslInfo.daysUntilExpiry;

        // Send alerts at 30, 14, 7, 3, and 1 days before expiry
        if ([30, 14, 7, 3, 1].includes(daysUntilExpiry)) {
          await notificationService.sendSSLExpiryAlert(website, checkResult.sslInfo);
        }
      }
    } catch (error) {
      console.error('Error sending alerts:', error);
    }
  }

  // Check DNS resolution
  async checkDNS(hostname) {
    try {
      const startTime = Date.now();
      const addresses = await dns.resolve4(hostname);
      const responseTime = Date.now() - startTime;
      
      return {
        resolved: true,
        addresses,
        responseTime,
        error: null
      };
    } catch (error) {
      return {
        resolved: false,
        addresses: [],
        responseTime: 0,
        error: error.message
      };
    }
  }

  // Check HTTP/HTTPS response
  async checkHTTP(url) {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(url, {
        timeout: 30000,
        maxRedirects: 5,
        validateStatus: () => true, // Don't throw on any status code
        headers: {
          'User-Agent': 'AWS-EC2-Monitor/1.0 Website-Monitor'
        }
      });

      const responseTime = Date.now() - startTime;
      
      // Extract security headers
      const securityHeaders = this.extractSecurityHeaders(response.headers);
      
      // Performance metrics
      const performanceMetrics = {
        responseTime,
        contentLength: response.headers['content-length'] || 0,
        contentType: response.headers['content-type'] || 'unknown',
        server: response.headers['server'] || 'unknown',
        redirectCount: response.request._redirectCount || 0
      };

      return {
        statusCode: response.status,
        responseTime,
        securityHeaders,
        performanceMetrics,
        headers: response.headers
      };
    } catch (error) {
      return {
        statusCode: 0,
        responseTime: Date.now() - startTime,
        securityHeaders: {},
        performanceMetrics: {},
        error: error.message
      };
    }
  }

  // Check SSL certificate
  async checkSSL(hostname, port = 443) {
    return new Promise((resolve) => {
      const tls = require('tls');

      const socket = tls.connect({
        host: hostname,
        port: port,
        servername: hostname,
        rejectUnauthorized: false,
        timeout: 10000
      });

      socket.on('secureConnect', () => {
        try {
          const cert = socket.getPeerCertificate(true);

          if (cert && cert.subject) {
            const now = new Date();
            const validFrom = new Date(cert.valid_from);
            const validTo = new Date(cert.valid_to);
            const daysUntilExpiry = Math.ceil((validTo - now) / (1000 * 60 * 60 * 24));

            socket.destroy();
            resolve({
              valid: now >= validFrom && now <= validTo,
              issuer: cert.issuer,
              subject: cert.subject,
              validFrom: validFrom,
              validTo: validTo,
              daysUntilExpiry: daysUntilExpiry,
              fingerprint: cert.fingerprint,
              serialNumber: cert.serialNumber,
              algorithm: cert.sigalg || cert.signatureAlgorithm
            });
          } else {
            socket.destroy();
            resolve({
              valid: false,
              error: 'No certificate found'
            });
          }
        } catch (error) {
          socket.destroy();
          resolve({
            valid: false,
            error: `SSL parsing error: ${error.message}`
          });
        }
      });

      socket.on('error', (error) => {
        socket.destroy();
        resolve({
          valid: false,
          error: `SSL connection error: ${error.message}`
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          valid: false,
          error: 'SSL check timeout'
        });
      });

      socket.setTimeout(10000);
    });
  }

  // Extract security headers
  extractSecurityHeaders(headers) {
    const securityHeaders = {};
    
    const headerChecks = {
      'strict-transport-security': 'HSTS',
      'content-security-policy': 'CSP',
      'x-frame-options': 'X-Frame-Options',
      'x-content-type-options': 'X-Content-Type-Options',
      'x-xss-protection': 'X-XSS-Protection',
      'referrer-policy': 'Referrer-Policy',
      'permissions-policy': 'Permissions-Policy'
    };

    Object.entries(headerChecks).forEach(([header, name]) => {
      securityHeaders[name] = {
        present: !!headers[header],
        value: headers[header] || null
      };
    });

    return securityHeaders;
  }

  // Calculate uptime percentage
  calculateUptime(checks) {
    if (checks.length === 0) return 100;
    
    const upChecks = checks.filter(check => check.status === 'up').length;
    return Math.round((upChecks / checks.length) * 100);
  }

  // Start monitoring all websites
  startMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Check all websites every 5 minutes
    this.monitoringInterval = setInterval(async () => {
      const websites = Array.from(this.monitoredSites.keys());
      
      for (const websiteId of websites) {
        try {
          await this.checkWebsite(websiteId);
        } catch (error) {
          console.error(`Error checking website ${websiteId}:`, error);
        }
      }
    }, 300000); // 5 minutes

    console.log('Website monitoring started');
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('Website monitoring stopped');
  }

  // Get monitoring statistics
  getMonitoringStats() {
    const results = this.getAllResults();
    
    return {
      totalSites: results.length,
      upSites: results.filter(r => r.status === 'up').length,
      downSites: results.filter(r => r.status === 'down').length,
      averageResponseTime: results.length > 0 
        ? Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length)
        : 0,
      averageUptime: results.length > 0
        ? Math.round(results.reduce((sum, r) => sum + r.uptime, 0) / results.length)
        : 100
    };
  }
}

module.exports = new WebsiteMonitoringService();
