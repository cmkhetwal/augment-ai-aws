const AWS = require('aws-sdk');

// Multi-account configuration from environment variables
const accounts = {
  bamkom: {
    name: 'Bamkom',
    accessKeyId: process.env.BAMKOM_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.BAMKOM_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
    defaultRegion: process.env.BAMKOM_AWS_REGION || 'us-east-1'
  },
  unified: {
    name: 'Unified',
    accessKeyId: process.env.UNIFIED_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID_2,
    secretAccessKey: process.env.UNIFIED_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY_2,
    defaultRegion: process.env.UNIFIED_AWS_REGION || 'us-east-1'
  }
};

// Default services for backward compatibility (using environment credentials)
const cloudwatch = new AWS.CloudWatch({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const ec2 = new AWS.EC2({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const ssm = new AWS.SSM({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

class MetricsService {
  // Get SSM client for a specific account
  getSSMClient(accountKey, region = 'us-east-1') {
    const account = accounts[accountKey];
    if (!account) {
      console.error(`Unknown account key: ${accountKey}`);
      return ssm; // Fallback to default
    }

    return new AWS.SSM({
      region: region,
      accessKeyId: account.accessKeyId,
      secretAccessKey: account.secretAccessKey
    });
  }

  async getSystemMetrics(instanceId, accountKey = null, region = 'us-east-1') {
    try {
      console.log(`Getting system metrics for ${instanceId}`);
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 10 * 60 * 1000); // Last 10 minutes

      const [cpuMetrics, memoryMetrics, diskMetrics, networkMetrics] = await Promise.all([
        this.getCPUMetrics(instanceId, startTime, endTime),
        this.getMemoryMetrics(instanceId, startTime, endTime),
        this.getDiskMetrics(instanceId, startTime, endTime),
        this.getNetworkMetrics(instanceId, startTime, endTime)
      ]);

      console.log(`Metrics collected for ${instanceId}:`, {
        cpu: !!cpuMetrics,
        memory: !!memoryMetrics,
        disk: !!diskMetrics,
        network: !!networkMetrics
      });

      const topProcesses = await this.getTopProcesses(instanceId, accountKey, region);
      console.log(`Top processes for ${instanceId} (account: ${accountKey}, region: ${region}):`, !!topProcesses);

      const result = {
        instanceId,
        timestamp: new Date().toISOString(),
        cpu: cpuMetrics,
        memory: memoryMetrics,
        disk: diskMetrics,
        network: networkMetrics,
        topProcesses
      };

      console.log(`Final metrics response keys for ${instanceId}:`, Object.keys(result));
      return result;
    } catch (error) {
      console.error(`Error getting system metrics for ${instanceId}:`, error);
      throw error;
    }
  }

  async getCPUMetrics(instanceId, startTime, endTime) {
    try {
      // Use shorter time window for more recent data
      const recentEndTime = new Date();
      const recentStartTime = new Date(recentEndTime.getTime() - 5 * 60 * 1000); // Last 5 minutes
      
      const params = {
        EndTime: recentEndTime,
        MetricName: 'CPUUtilization',
        Namespace: 'AWS/EC2',
        Period: 60, // Try 1-minute periods for detailed monitoring
        StartTime: recentStartTime,
        Statistics: ['Average', 'Maximum', 'Minimum'],
        Dimensions: [
          {
            Name: 'InstanceId',
            Value: instanceId
          }
        ]
      };

      console.log(`Getting CPU metrics for ${instanceId} from ${recentStartTime.toISOString()} to ${recentEndTime.toISOString()}`);

      const data = await cloudwatch.getMetricStatistics(params).promise();
      const sortedData = data.Datapoints.sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
      
      console.log(`Got ${sortedData.length} CPU data points for ${instanceId}, latest: ${sortedData.length > 0 ? sortedData[sortedData.length - 1].Average : 'none'}`);
      
      // Also try to get CPU credit metrics for T2 instances
      let cpuCredits = null;
      try {
        const creditParams = {
          EndTime: recentEndTime,
          MetricName: 'CPUCreditBalance',
          Namespace: 'AWS/EC2',
          Period: 300,
          StartTime: recentStartTime,
          Statistics: ['Average'],
          Dimensions: [{ Name: 'InstanceId', Value: instanceId }]
        };
        const creditData = await cloudwatch.getMetricStatistics(creditParams).promise();
        if (creditData.Datapoints.length > 0) {
          cpuCredits = creditData.Datapoints[creditData.Datapoints.length - 1].Average;
          console.log(`CPU Credits for ${instanceId}: ${cpuCredits}`);
        }
      } catch (creditError) {
        console.log(`No CPU credit data for ${instanceId}: ${creditError.message}`);
      }
      
      const currentCPU = sortedData.length > 0 ? sortedData[sortedData.length - 1].Average : 0;
      const maxCPU = sortedData.length > 0 ? Math.max(...sortedData.map(d => d.Maximum)) : 0;
      
      return {
        current: currentCPU.toFixed(2),
        max: maxCPU.toFixed(2),
        average: sortedData.length > 0 ? (sortedData.reduce((sum, d) => sum + d.Average, 0) / sortedData.length).toFixed(2) : 0,
        cpuCredits: cpuCredits,
        dataPoints: sortedData.map(d => ({
          timestamp: d.Timestamp,
          value: d.Average
        }))
      };
    } catch (error) {
      console.error('Error getting CPU metrics:', error);
      return { current: 0, max: 0, average: 0, dataPoints: [] };
    }
  }

  async getMemoryMetrics(instanceId, startTime, endTime) {
    try {
      // Try multiple CloudWatch Agent configurations
      const namespaces = ['CWAgent', 'AWS/EC2'];
      const metricNames = ['MemoryUtilization', 'mem_used_percent'];
      
      for (const namespace of namespaces) {
        for (const metricName of metricNames) {
          try {
            const params = {
              EndTime: endTime,
              MetricName: metricName,
              Namespace: namespace,
              Period: 300,
              StartTime: startTime,
              Statistics: ['Average', 'Maximum'],
              Dimensions: [
                {
                  Name: 'InstanceId',
                  Value: instanceId
                }
              ]
            };

            const data = await cloudwatch.getMetricStatistics(params).promise();
            const sortedData = data.Datapoints.sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
            
            if (sortedData.length > 0) {
              const currentMemory = sortedData[sortedData.length - 1].Average;
              const maxMemory = Math.max(...sortedData.map(d => d.Maximum));
              
              console.log(`Found memory metrics for ${instanceId} using ${namespace}/${metricName}`);
              return {
                current: currentMemory.toFixed(2),
                max: maxMemory.toFixed(2),
                average: (sortedData.reduce((sum, d) => sum + d.Average, 0) / sortedData.length).toFixed(2),
                dataPoints: sortedData.map(d => ({
                  timestamp: d.Timestamp,
                  value: d.Average
                }))
              };
            }
          } catch (innerError) {
            console.log(`No memory metrics found for ${instanceId} in ${namespace}/${metricName}: ${innerError.message}`);
          }
        }
      }
      
      // If no CloudWatch metrics found, use fallback
      console.log(`No CloudWatch memory metrics available for ${instanceId}, using fallback`);
      return this.getMemoryMetricsFromInstance(instanceId);
    } catch (error) {
      console.error('Error getting memory metrics from CloudWatch:', error);
      return this.getMemoryMetricsFromInstance(instanceId);
    }
  }

  async getMemoryMetricsFromInstance(instanceId) {
    // Instead of random fallback, try to get real memory data via SSM
    try {
      // Try to get memory via SSM using the same free command
      const command = "free | grep '^Mem:' | awk '{printf \"%.2f\\n\", ($3/$2) * 100.0}'";
      
      const response = await this.ssm.sendCommand({
        InstanceIds: [instanceId],
        DocumentName: "AWS-RunShellScript", 
        Parameters: { commands: [command] },
        TimeoutSeconds: 30
      }).promise();

      const commandId = response.Command.CommandId;
      
      // Wait for command completion
      let attempts = 0;
      while (attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
        
        const output = await this.ssm.getCommandInvocation({
          CommandId: commandId,
          InstanceId: instanceId
        }).promise();
        
        if (output.Status === 'Success') {
          const memoryPercent = parseFloat(output.StandardOutputContent.trim());
          if (!isNaN(memoryPercent)) {
            return {
              current: memoryPercent,
              max: memoryPercent,
              average: memoryPercent,
              dataPoints: []
            };
          }
        } else if (output.Status === 'Failed') {
          break;
        }
      }
    } catch (error) {
      console.log(`SSM fallback failed for ${instanceId}: ${error.message}`);
    }
    
    // If SSM completely fails, return null to indicate no data
    return {
      current: 0,
      max: 0, 
      average: 0,
      dataPoints: []
    };
  }

  async getDiskMetrics(instanceId, startTime, endTime) {
    try {
      const [diskReadParams, diskWriteParams] = [
        {
          EndTime: endTime,
          MetricName: 'DiskReadBytes',
          Namespace: 'AWS/EC2',
          Period: 300,
          StartTime: startTime,
          Statistics: ['Sum'],
          Dimensions: [{ Name: 'InstanceId', Value: instanceId }]
        },
        {
          EndTime: endTime,
          MetricName: 'DiskWriteBytes',
          Namespace: 'AWS/EC2',
          Period: 300,
          StartTime: startTime,
          Statistics: ['Sum'],
          Dimensions: [{ Name: 'InstanceId', Value: instanceId }]
        }
      ];

      const [readData, writeData] = await Promise.all([
        cloudwatch.getMetricStatistics(diskReadParams).promise(),
        cloudwatch.getMetricStatistics(diskWriteParams).promise()
      ]);

      const readBytes = readData.Datapoints.reduce((sum, d) => sum + d.Sum, 0);
      const writeBytes = writeData.Datapoints.reduce((sum, d) => sum + d.Sum, 0);

      return {
        readBytes: readBytes,
        writeBytes: writeBytes,
        readMB: (readBytes / (1024 * 1024)).toFixed(2),
        writeMB: (writeBytes / (1024 * 1024)).toFixed(2)
      };
    } catch (error) {
      console.error('Error getting disk metrics:', error);
      return { readBytes: 0, writeBytes: 0, readMB: 0, writeMB: 0 };
    }
  }

  async getNetworkMetrics(instanceId, startTime, endTime) {
    try {
      const [networkInParams, networkOutParams] = [
        {
          EndTime: endTime,
          MetricName: 'NetworkIn',
          Namespace: 'AWS/EC2',
          Period: 300,
          StartTime: startTime,
          Statistics: ['Sum'],
          Dimensions: [{ Name: 'InstanceId', Value: instanceId }]
        },
        {
          EndTime: endTime,
          MetricName: 'NetworkOut',
          Namespace: 'AWS/EC2',
          Period: 300,
          StartTime: startTime,
          Statistics: ['Sum'],
          Dimensions: [{ Name: 'InstanceId', Value: instanceId }]
        }
      ];

      const [inData, outData] = await Promise.all([
        cloudwatch.getMetricStatistics(networkInParams).promise(),
        cloudwatch.getMetricStatistics(networkOutParams).promise()
      ]);

      const networkIn = inData.Datapoints.reduce((sum, d) => sum + d.Sum, 0);
      const networkOut = outData.Datapoints.reduce((sum, d) => sum + d.Sum, 0);

      return {
        inBytes: networkIn,
        outBytes: networkOut,
        inMB: (networkIn / (1024 * 1024)).toFixed(2),
        outMB: (networkOut / (1024 * 1024)).toFixed(2)
      };
    } catch (error) {
      console.error('Error getting network metrics:', error);
      return { inBytes: 0, outBytes: 0, inMB: 0, outMB: 0 };
    }
  }

  async getTopProcesses(instanceId, accountKey = null, region = 'us-east-1') {
    try {
      console.log(`Attempting to get process data for ${instanceId} via SSM (account: ${accountKey}, region: ${region})...`);
      
      // First check if SSM agent is available using account-specific credentials
      const ssmAvailable = await this.checkSSMAvailability(instanceId, accountKey, region);
      
      if (ssmAvailable) {
        return await this.getProcessesViaSSM(instanceId, accountKey, region);
      } else {
        // Fallback to simulated data based on CloudWatch metrics
        return await this.getSimulatedProcesses(instanceId);
      }
    } catch (error) {
      console.error('Error getting top processes:', error);
      // Return simulated data as fallback
      return await this.getSimulatedProcesses(instanceId);
    }
  }

  async checkSSMAvailability(instanceId, accountKey = null, region = 'us-east-1') {
    try {
      const params = {
        Filters: [
          {
            Key: 'InstanceIds',
            Values: [instanceId]
          }
        ]
      };
      
      // Use account-specific SSM client if accountKey is provided
      const ssmClient = accountKey ? this.getSSMClient(accountKey, region) : ssm;
      
      const result = await ssmClient.describeInstanceInformation(params).promise();
      const available = result.InstanceInformationList.length > 0;
      console.log(`SSM available for ${instanceId} (account: ${accountKey || 'default'}, region: ${region}): ${available}`);
      return available;
    } catch (error) {
      console.log(`SSM not available for ${instanceId} (account: ${accountKey || 'default'}, region: ${region}): ${error.message}`);
      return false;
    }
  }

  async getProcessesViaSSM(instanceId, accountKey = null, region = 'us-east-1') {
    try {
      const command = `ps aux --sort=-%cpu | head -6 | tail -5 | awk '{print $2","$3","$4","$11}' | while IFS=, read pid cpu mem cmd; do echo "PID:$pid,CPU:$cpu,MEM:$mem,CMD:$cmd"; done`;
      
      const params = {
        DocumentName: 'AWS-RunShellScript',
        InstanceIds: [instanceId],
        Parameters: {
          commands: [command]
        }
      };

      // Use account-specific SSM client
      const ssmClient = accountKey ? this.getSSMClient(accountKey, region) : ssm;
      
      const result = await ssmClient.sendCommand(params).promise();
      const commandId = result.Command.CommandId;

      // Wait for command to complete
      await new Promise(resolve => setTimeout(resolve, 3000));

      const output = await ssmClient.getCommandInvocation({
        CommandId: commandId,
        InstanceId: instanceId
      }).promise();

      if (output.Status === 'Success') {
        const processes = this.parseSSMProcessOutput(output.StandardOutputContent);
        console.log(`Got ${processes.length} processes via SSM for ${instanceId}`);
        return { processes, method: 'SSM' };
      } else {
        console.log(`SSM command failed for ${instanceId}, falling back to simulation`);
        return await this.getSimulatedProcesses(instanceId);
      }
    } catch (error) {
      console.error(`SSM error for ${instanceId}:`, error.message);
      return await this.getSimulatedProcesses(instanceId);
    }
  }

  parseSSMProcessOutput(output) {
    const lines = output.trim().split('\n');
    const processes = [];

    lines.forEach(line => {
      const match = line.match(/PID:(\d+),CPU:([\d.]+),MEM:([\d.]+),CMD:(.+)/);
      if (match) {
        processes.push({
          pid: parseInt(match[1]),
          name: match[4].split(' ')[0].split('/').pop(),
          cpu: parseFloat(match[2]),
          memory: parseFloat(match[3])
        });
      }
    });

    return processes.sort((a, b) => b.cpu - a.cpu).slice(0, 5);
  }

  async getSimulatedProcesses(instanceId) {
    try {
      // Get current CPU usage from CloudWatch to create realistic simulation
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 5 * 60 * 1000); // Last 5 minutes
      
      const cpuData = await this.getCPUMetrics(instanceId, startTime, endTime);
      const currentCPU = parseFloat(cpuData.current) || 5;
      
      // Create simulated processes based on actual CPU usage
      const baseProcesses = [
        { name: 'systemd', baseCpu: 0.1, baseMem: 0.5 },
        { name: 'kthreadd', baseCpu: 0.0, baseMem: 0.0 },
        { name: 'ksoftirqd', baseCpu: 0.2, baseMem: 0.0 },
        { name: 'rcu_gp', baseCpu: 0.1, baseMem: 0.0 },
        { name: 'rcu_par_gp', baseCpu: 0.1, baseMem: 0.0 },
        { name: 'migration', baseCpu: 0.0, baseMem: 0.0 },
        { name: 'sshd', baseCpu: 0.2, baseMem: 2.1 },
        { name: 'chronyd', baseCpu: 0.0, baseMem: 0.8 },
        { name: 'NetworkManager', baseCpu: 0.1, baseMem: 1.2 },
        { name: 'dbus', baseCpu: 0.0, baseMem: 0.9 },
        { name: 'systemd-logind', baseCpu: 0.0, baseMem: 0.7 },
        { name: 'rsyslog', baseCpu: 0.1, baseMem: 1.5 }
      ];

      // If CPU is high, add some high-usage processes
      if (currentCPU > 20) {
        baseProcesses.push(
          { name: 'stress', baseCpu: Math.max(10, currentCPU * 0.3), baseMem: 5.2 },
          { name: 'python3', baseCpu: Math.max(5, currentCPU * 0.2), baseMem: 8.1 },
          { name: 'dd', baseCpu: Math.max(8, currentCPU * 0.2), baseMem: 2.3 }
        );
      }

      if (currentCPU > 50) {
        baseProcesses.push(
          { name: 'mysql', baseCpu: Math.max(12, currentCPU * 0.25), baseMem: 15.6 },
          { name: 'nginx', baseCpu: Math.max(6, currentCPU * 0.15), baseMem: 4.2 }
        );
      }

      // Generate realistic process data
      const processes = baseProcesses.map((proc, index) => {
        const variance = (Math.random() - 0.5) * 2; // ±1% variance
        const cpuMultiplier = currentCPU > 10 ? (currentCPU / 10) : 1;
        
        return {
          pid: 1000 + index + Math.floor(Math.random() * 100),
          name: proc.name,
          cpu: Math.max(0, (proc.baseCpu * cpuMultiplier + variance)).toFixed(1),
          memory: Math.max(0, (proc.baseMem + variance * 0.5)).toFixed(1)
        };
      });

      // Sort by CPU and return top 5
      const topProcesses = processes
        .sort((a, b) => parseFloat(b.cpu) - parseFloat(a.cpu))
        .slice(0, 5);

      console.log(`Generated ${topProcesses.length} simulated processes for ${instanceId} (CPU: ${currentCPU}%)`);
      
      return {
        processes: topProcesses,
        method: 'Simulated',
        note: `Simulated based on ${currentCPU}% CPU usage. Install SSM Agent for real data.`
      };
    } catch (error) {
      console.error('Error generating simulated processes:', error);
      return { 
        processes: [], 
        error: error.message,
        method: 'Error'
      };
    }
  }

  async getDetailedSystemInfo(instanceId) {
    try {
      return {
        cpu: await this.getCPUInfo(),
        memory: await this.getMemoryInfo(),
        disk: await this.getDiskInfo(),
        network: await this.getNetworkInfo(),
        os: await this.getOSInfo()
      };
    } catch (error) {
      console.error('Error getting detailed system info:', error);
      return {};
    }
  }

  async getCPUInfo() {
    try {
      const cpuData = await si.cpu();
      const cpuTemp = await si.cpuTemperature();
      const cpuLoad = await si.currentLoad();

      return {
        manufacturer: cpuData.manufacturer,
        brand: cpuData.brand,
        cores: cpuData.cores,
        physicalCores: cpuData.physicalCores,
        speed: cpuData.speed,
        temperature: cpuTemp.main || 0,
        currentLoad: cpuLoad.currentLoad
      };
    } catch (error) {
      return {};
    }
  }

  async getMemoryInfo() {
    try {
      const memData = await si.mem();
      return {
        total: memData.total,
        available: memData.available,
        used: memData.used,
        free: memData.free,
        usedPercentage: ((memData.used / memData.total) * 100).toFixed(2)
      };
    } catch (error) {
      return {};
    }
  }

  async getDiskInfo() {
    try {
      const diskData = await si.fsSize();
      return diskData.map(disk => ({
        fs: disk.fs,
        size: disk.size,
        used: disk.used,
        available: disk.available,
        usedPercentage: ((disk.used / disk.size) * 100).toFixed(2),
        mount: disk.mount
      }));
    } catch (error) {
      return [];
    }
  }

  async getNetworkInfo() {
    try {
      const networkData = await si.networkStats();
      return networkData.map(net => ({
        iface: net.iface,
        rx_bytes: net.rx_bytes,
        tx_bytes: net.tx_bytes,
        rx_sec: net.rx_sec,
        tx_sec: net.tx_sec
      }));
    } catch (error) {
      return [];
    }
  }

  async getOSInfo() {
    try {
      const osData = await si.osInfo();
      const uptime = await si.time();
      
      return {
        platform: osData.platform,
        distro: osData.distro,
        release: osData.release,
        kernel: osData.kernel,
        arch: osData.arch,
        hostname: osData.hostname,
        uptime: uptime.uptime
      };
    } catch (error) {
      return {};
    }
  }
}

module.exports = new MetricsService();