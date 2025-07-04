const portscanner = require('portscanner');
const { spawn } = require('child_process');

class PortScanService {
  constructor() {
    this.commonPorts = [
      { port: 21, service: 'FTP' },
      { port: 22, service: 'SSH' },
      { port: 23, service: 'Telnet' },
      { port: 25, service: 'SMTP' },
      { port: 53, service: 'DNS' },
      { port: 80, service: 'HTTP' },
      { port: 110, service: 'POP3' },
      { port: 111, service: 'NFS' },
      { port: 135, service: 'RPC' },
      { port: 139, service: 'NetBIOS' },
      { port: 143, service: 'IMAP' },
      { port: 443, service: 'HTTPS' },
      { port: 445, service: 'SMB' },
      { port: 993, service: 'IMAPS' },
      { port: 995, service: 'POP3S' },
      { port: 1433, service: 'SQL Server' },
      { port: 2049, service: 'NFS' },
      { port: 3306, service: 'MySQL' },
      { port: 3389, service: 'RDP' },
      { port: 5432, service: 'PostgreSQL' },
      { port: 5984, service: 'CouchDB' },
      { port: 6379, service: 'Redis' },
      { port: 8080, service: 'HTTP Alt' },
      { port: 8443, service: 'HTTPS Alt' },
      { port: 9200, service: 'Elasticsearch' },
      { port: 27017, service: 'MongoDB' },
      // Add more common Linux services
      { port: 123, service: 'NTP' },
      { port: 161, service: 'SNMP' },
      { port: 162, service: 'SNMP-trap' },
      { port: 389, service: 'LDAP' },
      { port: 636, service: 'LDAPS' },
      { port: 993, service: 'IMAPS' },
      { port: 1521, service: 'Oracle' },
      { port: 5901, service: 'VNC' },
      { port: 5902, service: 'VNC' },
      { port: 6000, service: 'X11' }
    ];
  }

  async scanPort(host, port, timeout = 3000) {
    try {
      const status = await portscanner.checkPortStatus(port, host, {
        timeout: timeout
      });
      
      return {
        port: port,
        status: status,
        open: status === 'open',
        service: this.getServiceName(port),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        port: port,
        status: 'error',
        open: false,
        service: this.getServiceName(port),
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async scanCommonPorts(host, timeout = 3000) {
    try {
      const scanPromises = this.commonPorts.map(portInfo => 
        this.scanPort(host, portInfo.port, timeout)
      );
      
      const results = await Promise.all(scanPromises);
      const openPorts = results.filter(result => result.open);
      
      return {
        host: host,
        totalScanned: this.commonPorts.length,
        openPorts: openPorts,
        openCount: openPorts.length,
        timestamp: new Date().toISOString(),
        scanDuration: Date.now()
      };
    } catch (error) {
      console.error(`Error scanning common ports for ${host}:`, error);
      return {
        host: host,
        totalScanned: 0,
        openPorts: [],
        openCount: 0,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async scanPortRange(host, startPort, endPort, timeout = 3000) {
    try {
      const ports = [];
      for (let port = startPort; port <= endPort; port++) {
        ports.push(port);
      }

      const scanPromises = ports.map(port => this.scanPort(host, port, timeout));
      const results = await Promise.all(scanPromises);
      const openPorts = results.filter(result => result.open);

      return {
        host: host,
        portRange: `${startPort}-${endPort}`,
        totalScanned: ports.length,
        openPorts: openPorts,
        openCount: openPorts.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error scanning port range ${startPort}-${endPort} for ${host}:`, error);
      return {
        host: host,
        portRange: `${startPort}-${endPort}`,
        totalScanned: 0,
        openPorts: [],
        openCount: 0,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async quickScan(host, timeout = 2000) {
    const quickPorts = [21, 22, 23, 25, 53, 80, 135, 139, 443, 445, 993, 995, 1723, 3306, 3389, 5900, 8080];
    
    try {
      const scanPromises = quickPorts.map(port => this.scanPort(host, port, timeout));
      const results = await Promise.all(scanPromises);
      const openPorts = results.filter(result => result.open);

      return {
        host: host,
        scanType: 'quick',
        totalScanned: quickPorts.length,
        openPorts: openPorts,
        openCount: openPorts.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error in quick scan for ${host}:`, error);
      return {
        host: host,
        scanType: 'quick',
        totalScanned: 0,
        openPorts: [],
        openCount: 0,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async deepScan(host, timeout = 5000) {
    try {
      const wellKnownPorts = Array.from({length: 1024}, (_, i) => i + 1);
      const batchSize = 50;
      const results = [];

      for (let i = 0; i < wellKnownPorts.length; i += batchSize) {
        const batch = wellKnownPorts.slice(i, i + batchSize);
        const batchPromises = batch.map(port => this.scanPort(host, port, timeout));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const openPorts = results.filter(result => result.open);

      return {
        host: host,
        scanType: 'deep',
        totalScanned: wellKnownPorts.length,
        openPorts: openPorts,
        openCount: openPorts.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error in deep scan for ${host}:`, error);
      return {
        host: host,
        scanType: 'deep',
        totalScanned: 0,
        openPorts: [],
        openCount: 0,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async nmapScan(host, options = '') {
    return new Promise((resolve, reject) => {
      const nmapCommand = `nmap ${options} ${host}`;
      const nmap = spawn('nmap', [options, host].filter(Boolean));
      
      let output = '';
      let errorOutput = '';

      nmap.stdout.on('data', (data) => {
        output += data.toString();
      });

      nmap.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      nmap.on('close', (code) => {
        if (code === 0) {
          const parsedResult = this.parseNmapOutput(output);
          resolve({
            host: host,
            scanType: 'nmap',
            command: nmapCommand,
            rawOutput: output,
            parsedResult: parsedResult,
            timestamp: new Date().toISOString()
          });
        } else {
          reject(new Error(`Nmap scan failed with code ${code}: ${errorOutput}`));
        }
      });

      nmap.on('error', (error) => {
        reject(new Error(`Failed to start nmap: ${error.message}`));
      });
    });
  }

  parseNmapOutput(output) {
    const lines = output.split('\n');
    const openPorts = [];
    
    lines.forEach(line => {
      const portMatch = line.match(/^(\d+)\/(\w+)\s+(\w+)\s+(.+)$/);
      if (portMatch) {
        const [, port, protocol, state, service] = portMatch;
        if (state === 'open') {
          openPorts.push({
            port: parseInt(port),
            protocol: protocol,
            state: state,
            service: service.trim()
          });
        }
      }
    });

    return {
      openPorts: openPorts,
      openCount: openPorts.length
    };
  }

  getServiceName(port) {
    const portInfo = this.commonPorts.find(p => p.port === port);
    return portInfo ? portInfo.service : 'Unknown';
  }

  getRiskLevel(port) {
    const highRiskPorts = [21, 23, 135, 139, 445, 1433, 3389];
    const mediumRiskPorts = [22, 25, 53, 110, 143, 993, 995];
    const lowRiskPorts = [80, 443, 8080, 8443];

    if (highRiskPorts.includes(port)) return 'high';
    if (mediumRiskPorts.includes(port)) return 'medium';
    if (lowRiskPorts.includes(port)) return 'low';
    return 'unknown';
  }

  generatePortReport(scanResults) {
    if (!scanResults.openPorts) return null;

    const report = {
      host: scanResults.host,
      timestamp: scanResults.timestamp,
      totalOpen: scanResults.openCount,
      riskAssessment: {
        high: 0,
        medium: 0,
        low: 0,
        unknown: 0
      },
      services: {},
      recommendations: []
    };

    scanResults.openPorts.forEach(portResult => {
      const risk = this.getRiskLevel(portResult.port);
      report.riskAssessment[risk]++;
      
      const service = portResult.service || this.getServiceName(portResult.port);
      if (!report.services[service]) {
        report.services[service] = [];
      }
      report.services[service].push({
        port: portResult.port,
        risk: risk
      });
    });

    if (report.riskAssessment.high > 0) {
      report.recommendations.push('High-risk ports detected. Consider closing unnecessary services.');
    }
    
    if (scanResults.openPorts.some(p => p.port === 22)) {
      report.recommendations.push('SSH is open. Ensure strong authentication is configured.');
    }
    
    if (scanResults.openPorts.some(p => p.port === 3389)) {
      report.recommendations.push('RDP is open. Consider using VPN or restricting access.');
    }

    return report;
  }

  async scanMultipleHosts(hosts, scanType = 'common', timeout = 3000) {
    try {
      const scanPromises = hosts.map(host => {
        switch (scanType) {
          case 'quick':
            return this.quickScan(host, timeout);
          case 'deep':
            return this.deepScan(host, timeout);
          default:
            return this.scanCommonPorts(host, timeout);
        }
      });

      const results = await Promise.all(scanPromises);
      
      return {
        scanType: scanType,
        totalHosts: hosts.length,
        results: results,
        summary: this.generateScanSummary(results),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error scanning multiple hosts:', error);
      return {
        scanType: scanType,
        totalHosts: hosts.length,
        results: [],
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  generateScanSummary(results) {
    const summary = {
      totalHosts: results.length,
      hostsWithOpenPorts: 0,
      totalOpenPorts: 0,
      mostCommonPorts: {},
      riskDistribution: { high: 0, medium: 0, low: 0, unknown: 0 }
    };

    results.forEach(result => {
      if (result.openCount > 0) {
        summary.hostsWithOpenPorts++;
        summary.totalOpenPorts += result.openCount;

        result.openPorts.forEach(port => {
          const portNum = port.port;
          summary.mostCommonPorts[portNum] = (summary.mostCommonPorts[portNum] || 0) + 1;
          
          const risk = this.getRiskLevel(portNum);
          summary.riskDistribution[risk]++;
        });
      }
    });

    return summary;
  }
}

module.exports = new PortScanService();