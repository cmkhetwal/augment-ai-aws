const AWS = require('aws-sdk');
const NodeCache = require('node-cache');

// Configure AWS with explicit credentials and connection pooling
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  maxRetries: 3,
  retryDelayOptions: {
    customBackoff: function(retryCount) {
      return Math.pow(2, retryCount) * 100;
    }
  }
});

// Connection pooling configuration
const httpOptions = {
  agent: new (require('https').Agent)({
    keepAlive: true,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 60000,
    freeSocketTimeout: 30000
  })
};

const ec2 = new AWS.EC2({ httpOptions });
const cloudwatch = new AWS.CloudWatch({ httpOptions });

class OptimizedAWSService {
  constructor() {
    this.instanceCache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // 5 min TTL
    this.metricsCache = new NodeCache({ stdTTL: 60, checkperiod: 30 }); // 1 min TTL
    this.statusCache = new NodeCache({ stdTTL: 120, checkperiod: 60 }); // 2 min TTL
    
    // Rate limiting
    this.requestQueue = [];
    this.processingQueue = false;
    this.maxConcurrentRequests = parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 20;
    this.requestDelay = parseInt(process.env.REQUEST_DELAY) || 100; // ms
    
    // Batch configuration
    this.batchSize = parseInt(process.env.BATCH_SIZE) || 50;
    this.maxInstances = parseInt(process.env.MAX_INSTANCES) || 500;
    
    console.log('Optimized AWS Service initialized with:');
    console.log(`- Max Concurrent Requests: ${this.maxConcurrentRequests}`);
    console.log(`- Batch Size: ${this.batchSize}`);
    console.log(`- Max Instances: ${this.maxInstances}`);
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

    // Wait for all active requests to complete
    if (activeRequests.length > 0) {
      await Promise.all(activeRequests);
    }

    this.processingQueue = false;

    // Process remaining items in queue
    if (this.requestQueue.length > 0) {
      setImmediate(() => this.processQueue());
    }
  }

  // Optimized instance fetching with pagination and caching
  async getEC2Instances(useCache = true) {
    const cacheKey = 'all_instances';
    
    if (useCache) {
      const cached = this.instanceCache.get(cacheKey);
      if (cached) {
        console.log(`Retrieved ${cached.length} instances from cache`);
        return cached;
      }
    }

    try {
      console.log('Fetching EC2 instances from AWS API...');
      const instances = [];
      let nextToken = null;
      let pageCount = 0;

      do {
        const requestFn = async () => {
          const params = {
            MaxResults: 100,
            ...(nextToken && { NextToken: nextToken })
          };
          return ec2.describeInstances(params).promise();
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
        console.log(`Processed page ${pageCount}, total instances so far: ${instances.length}`);

        // Safety limit to prevent infinite loops
        if (instances.length >= this.maxInstances) {
          console.log(`Reached maximum instance limit of ${this.maxInstances}`);
          break;
        }

      } while (nextToken && pageCount < 50); // Max 50 pages as safety

      // Sort instances by name for consistent ordering
      instances.sort((a, b) => a.Name.localeCompare(b.Name));

      console.log(`Total instances fetched: ${instances.length}`);
      this.instanceCache.set(cacheKey, instances);
      
      return instances;
    } catch (error) {
      console.error('Error fetching EC2 instances:', {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode
      });
      throw error;
    }
  }

  // Batch CloudWatch metrics fetching
  async getBatchCloudWatchMetrics(instanceIds, metricName, startTime, endTime) {
    const batches = [];
    for (let i = 0; i < instanceIds.length; i += this.batchSize) {
      batches.push(instanceIds.slice(i, i + this.batchSize));
    }

    const allResults = {};
    
    await Promise.all(batches.map(async (batch, batchIndex) => {
      console.log(`Processing metrics batch ${batchIndex + 1}/${batches.length} (${batch.length} instances)`);
      
      const batchPromises = batch.map(async (instanceId) => {
        const cacheKey = `metrics_${instanceId}_${metricName}_${startTime.getTime()}`;
        
        let cached = this.metricsCache.get(cacheKey);
        if (cached) {
          allResults[instanceId] = cached;
          return;
        }

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
            return cloudwatch.getMetricStatistics(params).promise();
          };

          const data = await this.executeWithRateLimit(requestFn);
          const sortedData = data.Datapoints.sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
          
          this.metricsCache.set(cacheKey, sortedData);
          allResults[instanceId] = sortedData;
        } catch (error) {
          console.error(`Error fetching metrics for ${instanceId}:`, error.message);
          allResults[instanceId] = [];
        }
      });

      await Promise.all(batchPromises);
    }));

    return allResults;
  }

  // Optimized instance metrics with parallel batch processing
  async getInstanceMetrics(instanceId) {
    const cacheKey = `instance_metrics_${instanceId}`;
    const cached = this.metricsCache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // Last hour

    try {
      const metrics = await this.getBatchCloudWatchMetrics(
        [instanceId], 
        'CPUUtilization', 
        startTime, 
        endTime
      );

      const [networkInData, networkOutData, diskReadData, diskWriteData] = await Promise.all([
        this.getBatchCloudWatchMetrics([instanceId], 'NetworkIn', startTime, endTime),
        this.getBatchCloudWatchMetrics([instanceId], 'NetworkOut', startTime, endTime),
        this.getBatchCloudWatchMetrics([instanceId], 'DiskReadBytes', startTime, endTime),
        this.getBatchCloudWatchMetrics([instanceId], 'DiskWriteBytes', startTime, endTime)
      ]);

      const result = {
        cpu: metrics[instanceId] || [],
        networkIn: networkInData[instanceId] || [],
        networkOut: networkOutData[instanceId] || [],
        diskRead: diskReadData[instanceId] || [],
        diskWrite: diskWriteData[instanceId] || []
      };

      this.metricsCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`Error getting instance metrics for ${instanceId}:`, error);
      return {};
    }
  }

  // Batch status checks for multiple instances
  async getBatchInstanceStatusChecks(instanceIds) {
    const batches = [];
    for (let i = 0; i < instanceIds.length; i += 20) { // AWS limit is 100, but we use 20 for better rate limiting
      batches.push(instanceIds.slice(i, i + 20));
    }

    const allResults = {};
    
    await Promise.all(batches.map(async (batch) => {
      try {
        const requestFn = async () => {
          const params = { InstanceIds: batch };
          return ec2.describeInstanceStatus(params).promise();
        };

        const data = await this.executeWithRateLimit(requestFn);
        
        if (data.InstanceStatuses && data.InstanceStatuses.length > 0) {
          data.InstanceStatuses.forEach(status => {
            allResults[status.InstanceId] = {
              instanceStatus: status.InstanceStatus.Status,
              systemStatus: status.SystemStatus.Status,
              instanceStatusDetails: status.InstanceStatus.Details,
              systemStatusDetails: status.SystemStatus.Details
            };
          });
        }

        // Mark instances not in response as not available
        batch.forEach(instanceId => {
          if (!allResults[instanceId]) {
            allResults[instanceId] = null;
          }
        });

      } catch (error) {
        console.error(`Error getting status checks for batch:`, error.message);
        batch.forEach(instanceId => {
          allResults[instanceId] = null;
        });
      }
    }));

    return allResults;
  }

  // Get paginated instances with sorting and filtering
  async getPaginatedInstances(page = 1, pageSize = 20, sortBy = 'name', sortOrder = 'asc', search = '') {
    const allInstances = await this.getEC2Instances();
    
    // Filter by search term
    let filteredInstances = allInstances;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredInstances = allInstances.filter(instance => 
        instance.Name.toLowerCase().includes(searchLower) ||
        instance.InstanceId.toLowerCase().includes(searchLower) ||
        instance.InstanceType.toLowerCase().includes(searchLower) ||
        (instance.PublicIpAddress && instance.PublicIpAddress.includes(searchLower)) ||
        (instance.PrivateIpAddress && instance.PrivateIpAddress.includes(searchLower))
      );
    }

    // Sort instances
    filteredInstances.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.Name;
          bValue = b.Name;
          break;
        case 'state':
          aValue = a.State.Name;
          bValue = b.State.Name;
          break;
        case 'type':
          aValue = a.InstanceType;
          bValue = b.InstanceType;
          break;
        case 'launchTime':
          aValue = new Date(a.LaunchTime);
          bValue = new Date(b.LaunchTime);
          break;
        default:
          aValue = a.Name;
          bValue = b.Name;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Paginate
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedInstances = filteredInstances.slice(startIndex, endIndex);

    return {
      instances: paginatedInstances,
      pagination: {
        currentPage: page,
        pageSize: pageSize,
        totalItems: filteredInstances.length,
        totalPages: Math.ceil(filteredInstances.length / pageSize),
        hasNextPage: endIndex < filteredInstances.length,
        hasPreviousPage: page > 1
      }
    };
  }

  // Cache management
  clearCache() {
    this.instanceCache.flushAll();
    this.metricsCache.flushAll();
    this.statusCache.flushAll();
    console.log('All caches cleared');
  }

  getCacheStats() {
    return {
      instances: this.instanceCache.getStats(),
      metrics: this.metricsCache.getStats(),
      status: this.statusCache.getStats()
    };
  }
}

module.exports = new OptimizedAWSService();