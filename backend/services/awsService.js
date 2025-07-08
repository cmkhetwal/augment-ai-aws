const AWS = require('aws-sdk');

// Validate required AWS credentials
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('ERROR: AWS credentials not found in environment variables!');
  console.error('Please ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set in .env file');
  process.exit(1);
}

// Disable all AWS credential providers except explicit credentials
AWS.config.credentials = null;
AWS.config.credentialProvider = null;

// Configure AWS with ONLY explicit credentials from .env file
const awsCredentials = new AWS.Credentials({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: awsCredentials,
  // Disable metadata service and IAM role fallback
  httpOptions: {
    timeout: 30000
  },
  maxRetries: 3,
  // Explicitly disable credential providers
  credentialProvider: new AWS.CredentialProviderChain([
    function() { return awsCredentials; }
  ])
});

console.log('AWS Configuration:');
console.log('- Region:', process.env.AWS_REGION || 'us-east-1');
console.log('- Access Key ID:', process.env.AWS_ACCESS_KEY_ID ? process.env.AWS_ACCESS_KEY_ID.substring(0, 10) + '...' : 'NOT SET');
console.log('- Secret Key:', process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET');

const ec2 = new AWS.EC2();
const cloudwatch = new AWS.CloudWatch();

class AWSService {
  async getEC2Instances() {
    try {
      console.log('Making EC2 DescribeInstances API call...');
      
      // First try without filters to get all instances
      const data = await ec2.describeInstances().promise();
      console.log('Raw EC2 response:', JSON.stringify(data, null, 2));
      
      const instances = [];

      if (data.Reservations && data.Reservations.length > 0) {
        data.Reservations.forEach(reservation => {
          console.log(`Processing reservation: ${reservation.ReservationId}`);
          reservation.Instances.forEach(instance => {
            console.log(`Found instance: ${instance.InstanceId} - ${instance.State.Name}`);
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
              Architecture: instance.Architecture
            });
          });
        });
      } else {
        console.log('No reservations found in the response');
      }

      console.log(`Total instances found: ${instances.length}`);
      return instances;
    } catch (error) {
      console.error('Detailed error fetching EC2 instances:', {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        region: AWS.config.region
      });
      throw error;
    }
  }

  async getCloudWatchMetrics(instanceId, metricName, startTime, endTime) {
    try {
      const params = {
        EndTime: endTime,
        MetricName: metricName,
        Namespace: 'AWS/EC2',
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
      return data.Datapoints.sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
    } catch (error) {
      console.error(`Error fetching CloudWatch metrics for ${instanceId}:`, error);
      return [];
    }
  }

  async getInstanceMetrics(instanceId) {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // Last hour

    try {
      const [cpuData, networkInData, networkOutData, diskReadData, diskWriteData] = await Promise.all([
        this.getCloudWatchMetrics(instanceId, 'CPUUtilization', startTime, endTime),
        this.getCloudWatchMetrics(instanceId, 'NetworkIn', startTime, endTime),
        this.getCloudWatchMetrics(instanceId, 'NetworkOut', startTime, endTime),
        this.getCloudWatchMetrics(instanceId, 'DiskReadBytes', startTime, endTime),
        this.getCloudWatchMetrics(instanceId, 'DiskWriteBytes', startTime, endTime)
      ]);

      return {
        cpu: cpuData,
        networkIn: networkInData,
        networkOut: networkOutData,
        diskRead: diskReadData,
        diskWrite: diskWriteData
      };
    } catch (error) {
      console.error(`Error getting instance metrics for ${instanceId}:`, error);
      return {};
    }
  }

  async getInstanceStatusChecks(instanceId) {
    try {
      const params = {
        InstanceIds: [instanceId]
      };

      const data = await ec2.describeInstanceStatus(params).promise();
      
      if (data.InstanceStatuses.length > 0) {
        const status = data.InstanceStatuses[0];
        return {
          instanceStatus: status.InstanceStatus.Status,
          systemStatus: status.SystemStatus.Status,
          instanceStatusDetails: status.InstanceStatus.Details,
          systemStatusDetails: status.SystemStatus.Details
        };
      }

      return null;
    } catch (error) {
      console.error(`Error getting status checks for ${instanceId}:`, error);
      return null;
    }
  }
}

module.exports = new AWSService();