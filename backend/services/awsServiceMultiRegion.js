const AWS = require('aws-sdk');
const NodeCache = require('node-cache');

class MultiRegionAWSService {
  constructor() {
    // Multi-account configuration from environment variables
    this.accounts = {
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

    // Validate that both accounts are configured
    Object.keys(this.accounts).forEach(accountKey => {
      const account = this.accounts[accountKey];
      if (!account.accessKeyId || !account.secretAccessKey) {
        console.error(`ERROR: ${account.name} account credentials not configured!`);
        process.exit(1);
      }
    });

    // Disable all AWS credential providers except explicit credentials
    AWS.config.credentials = null;
    AWS.config.credentialProvider = null;

    // Store credentials for each account
    this.accountCredentials = {};
    Object.keys(this.accounts).forEach(accountKey => {
      const account = this.accounts[accountKey];
      this.accountCredentials[accountKey] = new AWS.Credentials({
        accessKeyId: account.accessKeyId,
        secretAccessKey: account.secretAccessKey
      });
    });

    // Configure AWS with default region
    AWS.config.update({
      region: process.env.AWS_REGION || 'us-east-1',
      maxRetries: 3,
      retryDelayOptions: {
        customBackoff: function(retryCount) {
          return Math.pow(2, retryCount) * 100;
        }
      }
    });

    console.log('AWS Multi-Account Multi-Region Configuration:');
    console.log('- Configured Accounts:', Object.keys(this.accounts).map(key => this.accounts[key].name).join(', '));
    console.log('- Default Region:', process.env.AWS_REGION || 'us-east-1');
    Object.keys(this.accounts).forEach(accountKey => {
      const account = this.accounts[accountKey];
      console.log(`- ${account.name} Access Key: ${account.accessKeyId.substring(0, 10)}...`);
    });

    // Connection pooling configuration
    this.httpOptions = {
      agent: new (require('https').Agent)({
        keepAlive: true,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: 60000,
        freeSocketTimeout: 30000
      })
    };

    // Caching
    this.instanceCache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // 5 min TTL
    this.metricsCache = new NodeCache({ stdTTL: 60, checkperiod: 30 }); // 1 min TTL
    this.regionsCache = new NodeCache({ stdTTL: 3600, checkperiod: 300 }); // 1 hour TTL for regions
    
    // Rate limiting
    this.requestQueue = [];
    this.processingQueue = false;
    this.maxConcurrentRequests = parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 15; // Lower for multi-region
    this.requestDelay = parseInt(process.env.REQUEST_DELAY) || 200; // Higher delay for multi-region
    
    // Batch configuration
    this.batchSize = parseInt(process.env.BATCH_SIZE) || 30; // Smaller batches for multi-region
    this.maxInstances = parseInt(process.env.MAX_INSTANCES) || 500;
    
    // Multi-account region management
    this.enabledRegions = new Set();
    this.accountRegionClients = new Map(); // EC2 clients per account per region
    this.accountRegionCloudWatchClients = new Map(); // CloudWatch clients per account per region
    this.accountRegionSSMClients = new Map(); // SSM clients per account per region
    
    // Initialize client maps for each account
    Object.keys(this.accounts).forEach(accountKey => {
      this.accountRegionClients.set(accountKey, new Map());
      this.accountRegionCloudWatchClients.set(accountKey, new Map());
      this.accountRegionSSMClients.set(accountKey, new Map());
    });
    
    console.log('Multi-Account Multi-Region AWS Service initialized with:');
    console.log(`- Accounts: ${Object.keys(this.accounts).length}`);
    console.log(`- Max Concurrent Requests: ${this.maxConcurrentRequests}`);
    console.log(`- Batch Size: ${this.batchSize}`);
    console.log(`- Max Instances: ${this.maxInstances}`);
    console.log(`- Base Region: ${process.env.AWS_REGION || 'us-east-1'}`);
  }

  // Get available accounts
  getAccounts() {
    return Object.keys(this.accounts).map(key => ({
      key: key,
      name: this.accounts[key].name,
      defaultRegion: this.accounts[key].defaultRegion
    }));
  }

  // Get account info by key
  getAccount(accountKey) {
    return this.accounts[accountKey] ? {
      key: accountKey,
      name: this.accounts[accountKey].name,
      defaultRegion: this.accounts[accountKey].defaultRegion
    } : null;
  }

  // Create EC2 client for specific account and region
  getEC2Client(accountKey, region) {
    const clientKey = `${accountKey}-${region}`;
    const accountClients = this.accountRegionClients.get(accountKey);
    
    if (!accountClients.has(region)) {
      const credentials = this.accountCredentials[accountKey];
      const client = new AWS.EC2({
        region: region,
        credentials: credentials,
        httpOptions: this.httpOptions
      });
      accountClients.set(region, client);
      console.log(`Created EC2 client for ${this.accounts[accountKey].name} in ${region}`);
    }
    
    return accountClients.get(region);
  }

  // Create CloudWatch client for specific account and region
  getCloudWatchClient(accountKey, region) {
    const accountClients = this.accountRegionCloudWatchClients.get(accountKey);
    
    if (!accountClients.has(region)) {
      const credentials = this.accountCredentials[accountKey];
      const client = new AWS.CloudWatch({
        region: region,
        credentials: credentials,
        httpOptions: this.httpOptions
      });
      accountClients.set(region, client);
      console.log(`Created CloudWatch client for ${this.accounts[accountKey].name} in ${region}`);
    }
    
    return accountClients.get(region);
  }

  // Create SSM client for specific account and region  
  getSSMClient(accountKey, region) {
    const accountClients = this.accountRegionSSMClients.get(accountKey);
    
    if (!accountClients.has(region)) {
      const credentials = this.accountCredentials[accountKey];
      const client = new AWS.SSM({
        region: region,
        credentials: credentials,
        httpOptions: this.httpOptions
      });
      accountClients.set(region, client);
      console.log(`Created SSM client for ${this.accounts[accountKey].name} in ${region}`);
    }
    
    return accountClients.get(region);
  }

  // Get all available AWS regions
  async getAvailableRegions() {
    const cacheKey = 'available_regions';
    const cached = this.regionsCache.get(cacheKey);
    
    if (cached) {
      console.log(`Using cached regions: ${cached.join(', ')}`);
      return cached;
    }

    try {
      console.log('Fetching available AWS regions...');
      // Use first account to discover regions
      const firstAccountKey = Object.keys(this.accounts)[0];
      const ec2 = this.getEC2Client(firstAccountKey, 'us-east-1');
      const data = await ec2.describeRegions().promise();
      
      // Get all regions without filtering to ensure we don't miss any instances
      const regions = data.Regions
        .map(region => region.RegionName)
        .sort();
      
      console.log('Scanning ALL AWS regions without exclusions');

      console.log(`Found ${regions.length} available regions:`, regions.join(', '));
      this.regionsCache.set(cacheKey, regions);
      return regions;
    } catch (error) {
      console.error('Error fetching available regions:', error.message);
      // Fallback to common regions
      const fallbackRegions = [
        'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
        'eu-west-1', 'eu-west-2', 'eu-central-1',
        'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1'
      ];
      console.log('Using fallback regions:', fallbackRegions.join(', '));
      return fallbackRegions;
    }
  }

  // Detect which regions have EC2 instances
  async detectActiveRegions() {
    try {
      console.log('Detecting regions with EC2 instances...');
      const allRegions = await this.getAvailableRegions();
      const activeRegions = [];

      // Check each region for instances in parallel batches
      const batchSize = 5; // Check 5 regions at a time
      for (let i = 0; i < allRegions.length; i += batchSize) {
        const regionBatch = allRegions.slice(i, i + batchSize);
        
        const batchPromises = regionBatch.map(async (region) => {
          try {
            const ec2 = new AWS.EC2({
              region,
              httpOptions: this.httpOptions,
              credentials: this.awsCredentials
            });
            
            // Quick check - just get first page with max 5 results
            const params = { MaxResults: 5 };
            const data = await ec2.describeInstances(params).promise();
            
            const hasInstances = data.Reservations && data.Reservations.length > 0 &&
                               data.Reservations.some(r => r.Instances && r.Instances.length > 0);
            
            if (hasInstances) {
              const instanceCount = data.Reservations.reduce((count, r) => count + r.Instances.length, 0);
              console.log(`✓ Found ${instanceCount}+ instances in region ${region}`);
              return region;
            } else {
              console.log(`✗ No instances found in region ${region}`);
              return null;
            }
          } catch (error) {
            if (error.code === 'UnauthorizedOperation') {
              console.log(`✗ No access to region ${region} (unauthorized)`);
            } else if (error.code === 'OptInRequired') {
              console.log(`✗ Region ${region} requires opt-in`);
            } else {
              console.error(`Error checking region ${region}:`, error.message);
            }
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        activeRegions.push(...batchResults.filter(region => region !== null));
      }

      // Always include the base region even if no instances found
      const baseRegion = process.env.AWS_REGION || 'us-east-1';
      if (!activeRegions.includes(baseRegion)) {
        activeRegions.push(baseRegion);
      }

      // Use ALL available regions to ensure we don't miss any instances
      const allAvailableRegions = await this.getAvailableRegions();
      this.enabledRegions = new Set(allAvailableRegions);
      console.log(`Using ALL ${allAvailableRegions.length} available regions: ${allAvailableRegions.join(', ')}`);
      
      // Initialize clients for all regions
      this.initializeRegionClients(allAvailableRegions);
      
      return allAvailableRegions;
    } catch (error) {
      console.error('Error detecting active regions:', error);
      // Fallback to base region
      const fallbackRegion = process.env.AWS_REGION || 'us-east-1';
      this.enabledRegions = new Set([fallbackRegion]);
      this.initializeRegionClients([fallbackRegion]);
      return [fallbackRegion];
    }
  }

  // Initialize EC2, CloudWatch, and SSM clients for each account and region
  initializeRegionClients(regions) {
    console.log('Initializing multi-account region clients...');
    
    // Initialize clients for all account/region combinations
    Object.keys(this.accounts).forEach(accountKey => {
      regions.forEach(region => {
        const accountClients = this.accountRegionClients.get(accountKey);
        const cloudwatchClients = this.accountRegionCloudWatchClients.get(accountKey);
        const ssmClients = this.accountRegionSSMClients.get(accountKey);
        
        if (!accountClients.has(region)) {
          const credentials = this.accountCredentials[accountKey];
          
          // Create clients for this account/region
          accountClients.set(region, new AWS.EC2({
            region,
            httpOptions: this.httpOptions,
            credentials: credentials
          }));
          
          cloudwatchClients.set(region, new AWS.CloudWatch({
            region,
            httpOptions: this.httpOptions,
            credentials: credentials
          }));
          
          ssmClients.set(region, new AWS.SSM({
            region,
            httpOptions: this.httpOptions,
            credentials: credentials
          }));
          
          console.log(`✓ Initialized clients for ${this.accounts[accountKey].name}/${region}`);
        }
      });
    });
  }

  // Get accurate SSM metrics (based on aws_fixed_reporter.py)
  async getSSMMetrics(accountKey, region, instanceId) {
    try {
      const ssm = this.getSSMClient(accountKey, region);
      
      // Commands from aws_fixed_reporter.py - fixed and reliable
      const commands = [
        // Memory usage - simple and reliable
        "free | grep '^Mem:' | awk '{printf \"%.2f\\n\", ($3/$2) * 100.0}'",
        // Disk usage - one filesystem per line
        "df | grep -E '^/dev/' | awk '{print $1 \":\" $5}' | head -5",
        // Average disk usage across all filesystems
        "df | grep -E '^/dev/' | awk '{sum += $5; count++} END {if(count > 0) printf \"%.2f\\n\", sum/count; else print \"0\\n\"}'",
        // Check for EFS mounts and get details
        "df -hT | grep efs | awk '{print $1\":\"$3\":\"$4\":\"$6}' | head -3 || echo 'NO_EFS'"
      ];

      console.log(`Collecting SSM metrics for ${this.accounts[accountKey].name}/${region}/${instanceId}`);
      
      const response = await ssm.sendCommand({
        InstanceIds: [instanceId],
        DocumentName: "AWS-RunShellScript",
        Parameters: { commands: commands },
        TimeoutSeconds: 45
      }).promise();

      const commandId = response.Command.CommandId;
      
      // Wait for command completion with timeout
      let attempts = 0;
      const maxAttempts = 15; // 45 seconds total
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        attempts++;
        
        try {
          const output = await ssm.getCommandInvocation({
            CommandId: commandId,
            InstanceId: instanceId
          }).promise();
          
          if (output.Status === 'Success') {
            const stdout = output.StandardOutputContent.trim();
            if (stdout) {
              const lines = stdout.split('\n').map(line => line.trim()).filter(line => line);
              
              const metrics = {
                memory_percent: 0,
                disk_usage_avg: 0,
                disk_details: [],
                efs_attached: false,
                success: false,
                collection_method: 'SSM'
              };
              
              if (lines.length >= 3) {
                try {
                  // Parse memory usage (first line)
                  const memory_val = parseFloat(lines[0]);
                  if (!isNaN(memory_val) && memory_val >= 0 && memory_val <= 100) {
                    metrics.memory_percent = memory_val;
                    metrics.success = true;
                  }
                  
                  // Parse disk details (middle lines)
                  const disk_usages = [];
                  const end_index = lines.length - 2;
                  for (let i = 1; i < end_index; i++) {
                    if (lines[i].includes(':')) {
                      const [filesystem, percent_str] = lines[i].split(':', 2);
                      const percent = parseFloat(percent_str.replace('%', ''));
                      if (!isNaN(percent)) {
                        metrics.disk_details.push({
                          filesystem: filesystem.trim(),
                          usage_percent: percent
                        });
                        disk_usages.push(percent);
                      }
                    }
                  }
                  
                  // Parse average disk usage (second to last line)
                  if (lines.length > 2) {
                    const avg_disk = parseFloat(lines[lines.length - 2]);
                    if (!isNaN(avg_disk) && avg_disk >= 0 && avg_disk <= 100) {
                      metrics.disk_usage_avg = avg_disk;
                    } else if (disk_usages.length > 0) {
                      metrics.disk_usage_avg = disk_usages.reduce((a, b) => a + b, 0) / disk_usages.length;
                    }
                  }
                  
                  // Check for EFS (last line)
                  if (lines.length > 3) {
                    const efs_line = lines[lines.length - 1];
                    if (efs_line && efs_line !== 'NO_EFS') {
                      metrics.efs_attached = true;
                    }
                  }
                  
                  console.log(`✓ SSM success for ${instanceId}: Memory=${metrics.memory_percent.toFixed(2)}%, Disk=${metrics.disk_usage_avg.toFixed(2)}%`);
                  return metrics;
                } catch (parseError) {
                  console.log(`⚠ SSM parse error for ${instanceId}: ${parseError.message}`);
                }
              }
            }
          } else if (output.Status === 'Failed') {
            console.log(`⚠ SSM failed for ${instanceId}: ${output.StandardErrorContent || 'Unknown error'}`);
            break;
          }
        } catch (invocationError) {
          console.log(`⚠ SSM invocation error for ${instanceId}: ${invocationError.message}`);
        }
      }
    } catch (ssmError) {
      console.log(`⚠ SSM command error for ${instanceId}: ${ssmError.message}`);
    }
    
    // Return failed metrics
    return {
      memory_percent: 0,
      disk_usage_avg: 0,
      disk_details: [],
      efs_attached: false,
      success: false,
      collection_method: 'SSM_Failed'
    };
  }

  // Rate-limited request executor
  async executeWithRateLimit(requestFn) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ requestFn, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.processingQueue = true;
    const activeRequests = [];

    while (this.requestQueue.length > 0 && activeRequests.length < this.maxConcurrentRequests) {
      const { requestFn, resolve, reject } = this.requestQueue.shift();
      
      const requestPromise = requestFn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          const index = activeRequests.indexOf(requestPromise);
          if (index > -1) activeRequests.splice(index, 1);
        });

      activeRequests.push(requestPromise);
      
      if (this.requestDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));
      }
    }

    if (activeRequests.length > 0) {
      await Promise.all(activeRequests);
    }

    this.processingQueue = false;

    if (this.requestQueue.length > 0) {
      setImmediate(() => this.processQueue());
    }
  }

  // Get EC2 instances from all accounts and regions
  async getEC2Instances(useCache = true, accountFilter = null, regionFilter = null) {
    const cacheKey = `all_instances_${accountFilter || 'all'}_${regionFilter || 'all'}`;
    
    if (useCache) {
      const cached = this.instanceCache.get(cacheKey);
      if (cached) {
        console.log(`Retrieved ${cached.length} instances from cache (${accountFilter || 'all accounts'}/${regionFilter || 'all regions'})`);
        return cached;
      }
    }

    try {
      // Ensure we have detected active regions
      if (this.enabledRegions.size === 0) {
        await this.detectActiveRegions();
      }

      // Determine which accounts to query
      const accountsToQuery = accountFilter ? [accountFilter] : Object.keys(this.accounts);
      const regionsToQuery = regionFilter ? [regionFilter] : Array.from(this.enabledRegions);

      console.log(`Fetching EC2 instances from ${accountsToQuery.length} accounts and ${regionsToQuery.length} regions...`);
      const allInstances = [];
      const accountRegionResults = [];

      // Fetch instances from all account/region combinations in parallel
      const accountRegionPromises = [];
      
      for (const accountKey of accountsToQuery) {
        for (const region of regionsToQuery) {
          accountRegionPromises.push(this.getAccountRegionInstances(accountKey, region));
        }
      }

      const accountRegionInstancesResults = await Promise.all(accountRegionPromises);
      
      // Collect all instances and results
      accountRegionInstancesResults.forEach(result => {
        if (result && result.instances && result.instances.length > 0) {
          allInstances.push(...result.instances);
          accountRegionResults.push(result);
        }
      });

      // Sort instances by account, region and name for consistent ordering
      allInstances.sort((a, b) => {
        if (a.AccountName !== b.AccountName) {
          return a.AccountName.localeCompare(b.AccountName);
        }
        if (a.Region !== b.Region) {
          return a.Region.localeCompare(b.Region);
        }
        const aName = a.Tags?.find(tag => tag.Key === 'Name')?.Value || a.InstanceId;
        const bName = b.Tags?.find(tag => tag.Key === 'Name')?.Value || b.InstanceId;
        return aName.localeCompare(bName);
      });

      console.log(`Total instances fetched from all accounts/regions: ${allInstances.length}`);
      accountRegionResults.forEach(result => {
        if (result.error) {
          console.log(`  ${result.account}/${result.region}: ERROR - ${result.error}`);
        } else {
          console.log(`  ${result.account}/${result.region}: ${result.count} instances`);
        }
      });

      this.instanceCache.set(cacheKey, allInstances);
      return allInstances;
    } catch (error) {
      console.error('Error fetching EC2 instances from multiple accounts/regions:', error);
      throw error;
    }
  }

  // Get instances from a specific account and region
  async getAccountRegionInstances(accountKey, region) {
    try {
      console.log(`Fetching instances from ${this.accounts[accountKey].name}/${region}...`);
      const ec2 = this.getEC2Client(accountKey, region);
      const cloudwatch = this.getCloudWatchClient(accountKey, region);

      const data = await ec2.describeInstances().promise();
      const instances = [];
      
      for (const reservation of data.Reservations) {
        for (const instance of reservation.Instances) {
          // Skip terminated instances
          if (instance.State.Name === 'terminated') continue;
          
          // Get SSM metrics for accurate memory and disk usage
          let ssmMetrics = null;
          if (instance.State.Name === 'running') {
            try {
              ssmMetrics = await this.getSSMMetrics(accountKey, region, instance.InstanceId);
            } catch (ssmError) {
              console.log(`SSM failed for ${instance.InstanceId}: ${ssmError.message}`);
            }
          }

          // Get CloudWatch CPU metrics
          let cpuUtilization = 0;
          try {
            const cpuData = await cloudwatch.getMetricStatistics({
              Namespace: 'AWS/EC2',
              MetricName: 'CPUUtilization',
              Dimensions: [{ Name: 'InstanceId', Value: instance.InstanceId }],
              StartTime: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
              EndTime: new Date(),
              Period: 300,
              Statistics: ['Average']
            }).promise();

            if (cpuData.Datapoints && cpuData.Datapoints.length > 0) {
              cpuUtilization = cpuData.Datapoints[0].Average;
            }
          } catch (cwError) {
            console.log(`CloudWatch CPU failed for ${instance.InstanceId}: ${cwError.message}`);
          }
          
          // Determine memory usage
          let memoryUtilization = 0;
          let diskUtilization = 0;
          let collectionMethod = 'CloudWatch Only';
          
          if (ssmMetrics && ssmMetrics.success) {
            memoryUtilization = ssmMetrics.memory_percent;
            diskUtilization = ssmMetrics.disk_usage_avg;
            collectionMethod = 'SSM + CloudWatch';
          } else {
            // Fallback estimation based on CPU (conservative)
            if (cpuUtilization > 70) {
              memoryUtilization = Math.min(80, cpuUtilization * 1.1);
            } else if (cpuUtilization > 30) {
              memoryUtilization = Math.min(60, cpuUtilization * 1.3);
            } else {
              memoryUtilization = 25;
            }
            collectionMethod = 'CloudWatch + Estimated';
          }

          // Add account and enhanced region information
          const enrichedInstance = {
            ...instance,
            AccountKey: accountKey,
            AccountName: this.accounts[accountKey].name,
            Region: region,
            RegionName: this.getRegionDisplayName(region),
            CPUUtilization: Math.round(cpuUtilization * 100) / 100,
            MemoryUtilization: Math.round(memoryUtilization * 100) / 100,
            DiskUtilization: Math.round(diskUtilization * 100) / 100,
            CollectionMethod: collectionMethod,
            SSMSuccess: ssmMetrics ? ssmMetrics.success : false,
            DiskDetails: ssmMetrics ? ssmMetrics.disk_details : [],
            EFSAttached: ssmMetrics ? ssmMetrics.efs_attached : false
          };

          instances.push(enrichedInstance);
        }
      }

      return {
        account: this.accounts[accountKey].name,
        accountKey: accountKey,
        region: region,
        count: instances.length,
        instances: instances
      };
    } catch (error) {
      console.error(`Error fetching instances from ${this.accounts[accountKey].name}/${region}:`, error.message);
      return {
        account: this.accounts[accountKey].name,
        accountKey: accountKey,
        region: region,
        count: 0,
        instances: [],
        error: error.message
      };
    }
  }

  // Get instances from a specific region

  // Get CloudWatch metrics for instances (with multi-account region support)
  async getInstanceMetrics(instanceId, region, accountKey = 'bamkom') {
    // Default to first account if not specified
    const cloudwatchClient = this.getCloudWatchClient(accountKey, region);
    if (!cloudwatchClient) {
      console.error(`No CloudWatch client for ${accountKey}/${region}`);
      return {};
    }

    const cacheKey = `instance_metrics_${instanceId}_${region}`;
    const cached = this.metricsCache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // Last hour

    try {
      const [cpuData, networkInData, networkOutData, diskReadData, diskWriteData] = await Promise.all([
        this.getCloudWatchMetrics(instanceId, 'CPUUtilization', startTime, endTime, cloudwatchClient),
        this.getCloudWatchMetrics(instanceId, 'NetworkIn', startTime, endTime, cloudwatchClient),
        this.getCloudWatchMetrics(instanceId, 'NetworkOut', startTime, endTime, cloudwatchClient),
        this.getCloudWatchMetrics(instanceId, 'DiskReadBytes', startTime, endTime, cloudwatchClient),
        this.getCloudWatchMetrics(instanceId, 'DiskWriteBytes', startTime, endTime, cloudwatchClient)
      ]);

      const result = {
        cpu: cpuData,
        networkIn: networkInData,
        networkOut: networkOutData,
        diskRead: diskReadData,
        diskWrite: diskWriteData,
        region: region
      };

      this.metricsCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`Error getting instance metrics for ${instanceId} in ${region}:`, error);
      return {};
    }
  }

  // Get CloudWatch metrics with specific client
  async getCloudWatchMetrics(instanceId, metricName, startTime, endTime, cloudwatchClient) {
    try {
      const requestFn = async () => {
        const params = {
          EndTime: endTime,
          MetricName: metricName,
          Namespace: 'AWS/EC2',
          Period: 300,
          StartTime: startTime,
          Statistics: ['Average', 'Maximum'],
          Dimensions: [{ Name: 'InstanceId', Value: instanceId }]
        };
        return cloudwatchClient.getMetricStatistics(params).promise();
      };

      const data = await this.executeWithRateLimit(requestFn);
      return data.Datapoints.sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
    } catch (error) {
      console.error(`Error fetching CloudWatch metrics for ${instanceId}:`, error.message);
      return [];
    }
  }

  // Get region display name
  getRegionDisplayName(region) {
    const regionNames = {
      'us-east-1': 'N. Virginia',
      'us-east-2': 'Ohio',
      'us-west-1': 'N. California',
      'us-west-2': 'Oregon',
      'eu-west-1': 'Ireland',
      'eu-west-2': 'London',
      'eu-west-3': 'Paris',
      'eu-central-1': 'Frankfurt',
      'eu-north-1': 'Stockholm',
      'ap-southeast-1': 'Singapore',
      'ap-southeast-2': 'Sydney',
      'ap-northeast-1': 'Tokyo',
      'ap-northeast-2': 'Seoul',
      'ap-south-1': 'Mumbai',
      'ca-central-1': 'Canada',
      'sa-east-1': 'São Paulo'
    };
    return regionNames[region] || region;
  }

  // Get region statistics
  getRegionStats() {
    let totalClients = 0;
    this.accountRegionClients.forEach(accountClients => {
      totalClients += accountClients.size;
    });
    
    return {
      totalRegions: this.enabledRegions.size,
      enabledRegions: Array.from(this.enabledRegions),
      totalAccountRegionClients: totalClients,
      accounts: Object.keys(this.accounts),
      lastRegionDetection: this.regionsCache.get('last_detection') || null
    };
  }

  // Force refresh of active regions
  async refreshActiveRegions() {
    console.log('Forcing refresh of active regions...');
    this.regionsCache.flushAll();
    this.enabledRegions.clear();
    
    // Clear all account region clients
    this.accountRegionClients.forEach(accountClients => accountClients.clear());
    this.accountRegionCloudWatchClients.forEach(accountClients => accountClients.clear());
    this.accountRegionSSMClients.forEach(accountClients => accountClients.clear());
    
    const activeRegions = await this.detectActiveRegions();
    this.regionsCache.set('last_detection', new Date());
    
    return activeRegions;
  }

  // Cache management
  clearCache() {
    this.instanceCache.flushAll();
    this.metricsCache.flushAll();
    console.log('Multi-region cache cleared');
  }

  getCacheStats() {
    return {
      instances: this.instanceCache.getStats(),
      metrics: this.metricsCache.getStats(),
      regions: this.regionsCache.getStats(),
      regionStats: this.getRegionStats()
    };
  }
}

module.exports = new MultiRegionAWSService();