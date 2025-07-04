const ping = require('ping');

class PingService {
  async pingInstance(host, timeout = 5000) {
    try {
      const result = await ping.promise.probe(host, {
        timeout: timeout / 1000,
        extra: ['-c', '3']
      });

      return {
        host: host,
        alive: result.alive,
        time: result.time,
        min: result.min,
        max: result.max,
        avg: result.avg,
        packetLoss: result.packetLoss,
        timestamp: new Date().toISOString(),
        status: result.alive ? 'success' : 'failed'
      };
    } catch (error) {
      console.error(`Ping error for ${host}:`, error);
      return {
        host: host,
        alive: false,
        time: 'unknown',
        error: error.message,
        timestamp: new Date().toISOString(),
        status: 'error'
      };
    }
  }

  async pingMultipleHosts(hosts, timeout = 5000) {
    try {
      const pingPromises = hosts.map(host => this.pingInstance(host, timeout));
      const results = await Promise.all(pingPromises);
      
      return results.reduce((acc, result) => {
        acc[result.host] = result;
        return acc;
      }, {});
    } catch (error) {
      console.error('Error pinging multiple hosts:', error);
      return {};
    }
  }

  async continuousPing(host, interval = 30000, callback) {
    const doPing = async () => {
      try {
        const result = await this.pingInstance(host);
        if (callback) callback(result);
        return result;
      } catch (error) {
        console.error(`Continuous ping error for ${host}:`, error);
        if (callback) callback({ host, error: error.message, alive: false });
      }
    };

    await doPing();
    
    const intervalId = setInterval(doPing, interval);
    
    return {
      stop: () => clearInterval(intervalId),
      intervalId: intervalId
    };
  }

  isHostReachable(pingResult) {
    return pingResult && pingResult.alive === true;
  }

  getPingQuality(avgTime) {
    if (avgTime === 'unknown' || avgTime === undefined) return 'unknown';
    
    const time = parseFloat(avgTime);
    if (time < 50) return 'excellent';
    if (time < 100) return 'good';
    if (time < 200) return 'fair';
    if (time < 500) return 'poor';
    return 'very poor';
  }

  generatePingReport(pingResults) {
    const report = {
      totalHosts: Object.keys(pingResults).length,
      reachableHosts: 0,
      unreachableHosts: 0,
      averageResponseTime: 0,
      hosts: {}
    };

    let totalResponseTime = 0;
    let reachableCount = 0;

    Object.entries(pingResults).forEach(([host, result]) => {
      report.hosts[host] = {
        ...result,
        quality: this.getPingQuality(result.avg)
      };

      if (result.alive) {
        report.reachableHosts++;
        if (result.avg && result.avg !== 'unknown') {
          totalResponseTime += parseFloat(result.avg);
          reachableCount++;
        }
      } else {
        report.unreachableHosts++;
      }
    });

    if (reachableCount > 0) {
      report.averageResponseTime = (totalResponseTime / reachableCount).toFixed(2);
    }

    report.healthPercentage = report.totalHosts > 0 
      ? ((report.reachableHosts / report.totalHosts) * 100).toFixed(1)
      : 0;

    return report;
  }
}

module.exports = new PingService();