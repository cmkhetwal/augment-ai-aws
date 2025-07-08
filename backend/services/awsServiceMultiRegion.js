const AWS = require('aws-sdk');
const NodeCache = require('node-cache');

class MultiRegionAWSService {
  constructor() {
    // Configure AWS with explicit credentials and disable IAM role
    AWS.config.update({
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      // Explicitly disable IAM role and metadata service
      credentials: new AWS.Credentials({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }),
      maxRetries: 3,
      retryDelayOptions: {
        customBackoff: function(retryCount) {
          return Math.pow(2, retryCount) * 100;
        }
      }
    });

    console.log('AWS Multi-Region Configuration:');
    console.log('- Region:', process.env.AWS_REGION || 'us-east-1');
    console.log('- Access Key ID:', process.env.AWS_ACCESS_KEY_ID ? process.env.AWS_ACCESS_KEY_ID.substring(0, 10) + '...' : 'NOT SET');
    console.log('- Secret Key:', process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET');

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
    
    // Region management
    this.enabledRegions = new Set();
    this.regionClients = new Map(); // EC2 clients per region
    this.regionCloudWatchClients = new Map(); // CloudWatch clients per region
    
    console.log('Multi-Region AWS Service initialized with:');
    console.log(`- Max Concurrent Requests: ${this.maxConcurrentRequests}`);
    console.log(`- Batch Size: ${this.batchSize}`);
    console.log(`- Max Instances: ${this.maxInstances}`);
    console.log(`- Base Region: ${process.env.AWS_REGION || 'us-east-1'}`);
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
      const ec2 = new AWS.EC2({ region: 'us-east-1', httpOptions: this.httpOptions });
      const data = await ec2.describeRegions().promise();
      
      const regions = data.Regions
        .map(region => region.RegionName)
        .filter(region => {
          // Filter out regions that are commonly restricted or not needed
          const excludeRegions = [
            'ap-northeast-3', // Osaka (limited availability)
            'me-south-1',     // Bahrain (opt-in required)
            'af-south-1',     // Cape Town (opt-in required)
            'eu-south-1',     // Milan (opt-in required)
            'ap-southeast-3', // Jakarta (opt-in required)
            'me-central-1',   // UAE (opt-in required)
            'ap-south-2',     // Hyderabad (opt-in required)
            'eu-south-2',     // Spain (opt-in required)
            'eu-central-2',   // Zurich (opt-in required)
            'ap-southeast-4'  // Melbourne (opt-in required)
          ];
          return !excludeRegions.includes(region);
        })
        .sort();

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
              credentials: new AWS.Credentials({
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
              })
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

      this.enabledRegions = new Set(activeRegions);
      console.log(`Active regions detected: ${activeRegions.join(', ')}`);
      
      // Initialize clients for active regions
      this.initializeRegionClients(activeRegions);
      
      return activeRegions;
    } catch (error) {
      console.error('Error detecting active regions:', error);
      // Fallback to base region
      const fallbackRegion = process.env.AWS_REGION || 'us-east-1';
      this.enabledRegions = new Set([fallbackRegion]);
      this.initializeRegionClients([fallbackRegion]);
      return [fallbackRegion];
    }
  }

  // Initialize EC2 and CloudWatch clients for each region
  initializeRegionClients(regions) {
    console.log('Initializing region clients...');
    
    regions.forEach(region => {
      if (!this.regionClients.has(region)) {
        this.regionClients.set(region, new AWS.EC2({
          region,
          httpOptions: this.httpOptions,
          credentials: new AWS.Credentials({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
          })
        }));
        this.regionCloudWatchClients.set(region, new AWS.CloudWatch({
          region,
          httpOptions: this.httpOptions,
          credentials: new AWS.Credentials({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
          })
        }));
        console.log(`✓ Initialized clients for region ${region}`);
      }
    });
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

  // Get EC2 instances from all regions
  async getEC2Instances(useCache = true) {
    const cacheKey = 'all_instances_multi_region';
    
    if (useCache) {
      const cached = this.instanceCache.get(cacheKey);
      if (cached) {
        console.log(`Retrieved ${cached.length} instances from cache (multi-region)`);
        return cached;
      }
    }

    try {
      // Ensure we have detected active regions
      if (this.enabledRegions.size === 0) {
        await this.detectActiveRegions();
      }

      console.log(`Fetching EC2 instances from ${this.enabledRegions.size} regions...`);
      const allInstances = [];
      const regionResults = [];

      // Fetch instances from all regions in parallel
      const regionPromises = Array.from(this.enabledRegions).map(async (region) => {
        try {
          console.log(`Fetching instances from region: ${region}`);
          const regionInstances = await this.getRegionInstances(region);
          
          // Add region information to each instance
          const enrichedInstances = regionInstances.map(instance => ({
            ...instance,
            Region: region,
            RegionName: this.getRegionDisplayName(region)
          }));

          regionResults.push({
            region: region,
            count: enrichedInstances.length,
            instances: enrichedInstances
          });

          return enrichedInstances;
        } catch (error) {
          console.error(`Error fetching instances from region ${region}:`, error.message);
          regionResults.push({
            region: region,
            count: 0,
            instances: [],
            error: error.message
          });
          return [];
        }
      });

      const regionInstanceArrays = await Promise.all(regionPromises);
      
      // Flatten all instances into single array
      regionInstanceArrays.forEach(instances => {
        allInstances.push(...instances);
      });

      // Sort instances by region and name for consistent ordering
      allInstances.sort((a, b) => {
        if (a.Region !== b.Region) {
          return a.Region.localeCompare(b.Region);
        }
        const aName = a.Tags?.find(tag => tag.Key === 'Name')?.Value || a.InstanceId;
        const bName = b.Tags?.find(tag => tag.Key === 'Name')?.Value || b.InstanceId;
        return aName.localeCompare(bName);
      });

      console.log(`Total instances fetched from all regions: ${allInstances.length}`);
      regionResults.forEach(result => {
        if (result.error) {
          console.log(`  ${result.region}: ERROR - ${result.error}`);
        } else {
          console.log(`  ${result.region}: ${result.count} instances`);
        }
      });

      this.instanceCache.set(cacheKey, allInstances);
      return allInstances;
    } catch (error) {
      console.error('Error fetching EC2 instances from multiple regions:', error);
      throw error;
    }
  }

  // Get instances from a specific region
  async getRegionInstances(region) {
    const ec2Client = this.regionClients.get(region);
    if (!ec2Client) {
      throw new Error(`No EC2 client initialized for region ${region}`);
    }

    const instances = [];
    let nextToken = null;
    let pageCount = 0;

    do {
      const requestFn = async () => {
        const params = {
          MaxResults: 100,
          ...(nextToken && { NextToken: nextToken })
        };
        return ec2Client.describeInstances(params).promise();
      };

      const data = await this.executeWithRateLimit(requestFn);
      pageCount++;
      
      if (data.Reservations && data.Reservations.length > 0) {
        data.Reservations.forEach(reservation => {
          reservation.Instances.forEach(instance => {
            instances.push({
              InstanceId: instance.InstanceId,
              InstanceType: instance.InstanceType,
              State: instance.State,
              PublicIpAddress: instance.PublicIpAddress,
              PrivateIpAddress: instance.PrivateIpAddress,
              LaunchTime: instance.LaunchTime,
              Tags: instance.Tags || [],
              SecurityGroups: instance.SecurityGroups || [],
              VpcId: instance.VpcId,
              SubnetId: instance.SubnetId,
              AvailabilityZone: instance.Placement?.AvailabilityZone,
              KeyName: instance.KeyName,
              Platform: instance.Platform,
              Architecture: instance.Architecture,
              // Add computed fields for sorting/filtering
              Name: instance.Tags?.find(tag => tag.Key === 'Name')?.Value || instance.InstanceId,
              IsRunning: instance.State.Name === 'running'
            });
          });
        });
      }

      nextToken = data.NextToken;

      // Safety limit per region
      if (instances.length >= (this.maxInstances / this.enabledRegions.size)) {
        console.log(`Reached per-region instance limit for ${region}`);
        break;
      }

    } while (nextToken && pageCount < 20); // Max 20 pages per region

    return instances;
  }

  // Get CloudWatch metrics for instances (with region support)
  async getInstanceMetrics(instanceId, region) {
    const cloudwatchClient = this.regionCloudWatchClients.get(region);
    if (!cloudwatchClient) {
      console.error(`No CloudWatch client for region ${region}`);
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
    return {
      totalRegions: this.enabledRegions.size,
      enabledRegions: Array.from(this.enabledRegions),
      regionClients: this.regionClients.size,
      lastRegionDetection: this.regionsCache.get('last_detection') || null
    };
  }

  // Force refresh of active regions
  async refreshActiveRegions() {
    console.log('Forcing refresh of active regions...');
    this.regionsCache.flushAll();
    this.enabledRegions.clear();
    this.regionClients.clear();
    this.regionCloudWatchClients.clear();
    
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