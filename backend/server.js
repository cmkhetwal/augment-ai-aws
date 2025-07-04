const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const cron = require('node-cron');
const path = require('path');

// Load environment variables from parent directory
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

console.log('Environment variables loaded:');
console.log('AWS_REGION:', process.env.AWS_REGION);
console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET');
console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET');

const awsService = require('./services/awsService');
const pingService = require('./services/pingService');
const metricsService = require('./services/metricsService');
const portScanService = require('./services/portScanService');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let connectedClients = new Set();
let monitoringData = {
  instances: [],
  pingResults: {},
  systemMetrics: {},
  openPorts: {}
};

wss.on('connection', (ws) => {
  connectedClients.add(ws);
  
  ws.send(JSON.stringify({
    type: 'initial_data',
    data: monitoringData
  }));

  ws.on('close', () => {
    connectedClients.delete(ws);
  });
});

function broadcastToClients(data) {
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

app.get('/api/instances', async (req, res) => {
  try {
    console.log('Fetching EC2 instances...');
    const instances = await awsService.getEC2Instances();
    console.log(`Found ${instances.length} instances`);
    monitoringData.instances = instances;
    res.json({
      success: true,
      count: instances.length,
      instances: instances
    });
  } catch (error) {
    console.error('Error fetching instances:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

app.get('/api/ping/:instanceId', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const instance = monitoringData.instances.find(i => i.InstanceId === instanceId);
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    const pingResult = await pingService.pingInstance(instance.PublicIpAddress || instance.PrivateIpAddress);
    res.json(pingResult);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/metrics/:instanceId', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const metrics = monitoringData.systemMetrics[instanceId] || {};
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ports/:instanceId', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const ports = monitoringData.openPorts[instanceId] || [];
    res.json(ports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dashboard', (req, res) => {
  res.json(monitoringData);
});

async function updateInstances() {
  try {
    console.log('Updating instances...');
    const instances = await awsService.getEC2Instances();
    monitoringData.instances = instances;
    
    broadcastToClients({
      type: 'instances_update',
      data: {
        success: true,
        count: instances.length,
        instances: instances
      }
    });
    
    console.log(`Updated ${instances.length} instances`);
  } catch (error) {
    console.error('Error updating instances:', error);
    broadcastToClients({
      type: 'instances_update',
      data: {
        success: false,
        error: error.message,
        instances: []
      }
    });
  }
}

async function runPingChecks() {
  try {
    const pingPromises = monitoringData.instances.map(async (instance) => {
      const ip = instance.PublicIpAddress || instance.PrivateIpAddress;
      if (ip) {
        const result = await pingService.pingInstance(ip);
        monitoringData.pingResults[instance.InstanceId] = {
          ...result,
          timestamp: new Date(),
          instanceName: instance.Tags?.find(tag => tag.Key === 'Name')?.Value || instance.InstanceId
        };
      }
    });
    
    await Promise.all(pingPromises);
    
    broadcastToClients({
      type: 'ping_update',
      data: monitoringData.pingResults
    });
  } catch (error) {
    console.error('Error running ping checks:', error);
  }
}

async function collectSystemMetrics() {
  try {
    const metricsPromises = monitoringData.instances.map(async (instance) => {
      if (instance.State.Name === 'running') {
        try {
          const metrics = await metricsService.getSystemMetrics(instance.InstanceId);
          monitoringData.systemMetrics[instance.InstanceId] = {
            ...metrics,
            timestamp: new Date(),
            instanceName: instance.Tags?.find(tag => tag.Key === 'Name')?.Value || instance.InstanceId
          };
        } catch (error) {
          console.error(`Error collecting metrics for ${instance.InstanceId}:`, error.message);
        }
      }
    });
    
    await Promise.all(metricsPromises);
    
    broadcastToClients({
      type: 'metrics_update',
      data: monitoringData.systemMetrics
    });
  } catch (error) {
    console.error('Error collecting system metrics:', error);
  }
}

async function scanPorts() {
  try {
    const portScanPromises = monitoringData.instances.map(async (instance) => {
      const ip = instance.PublicIpAddress || instance.PrivateIpAddress;
      if (ip && instance.State.Name === 'running') {
        try {
          const openPorts = await portScanService.scanCommonPorts(ip);
          monitoringData.openPorts[instance.InstanceId] = {
            ports: openPorts,
            timestamp: new Date(),
            instanceName: instance.Tags?.find(tag => tag.Key === 'Name')?.Value || instance.InstanceId,
            ipAddress: ip
          };
        } catch (error) {
          console.error(`Error scanning ports for ${instance.InstanceId}:`, error.message);
        }
      }
    });
    
    await Promise.all(portScanPromises);
    
    broadcastToClients({
      type: 'ports_update',
      data: monitoringData.openPorts
    });
  } catch (error) {
    console.error('Error scanning ports:', error);
  }
}

cron.schedule('*/30 * * * * *', runPingChecks);
cron.schedule('*/1 * * * *', collectSystemMetrics);
cron.schedule('*/5 * * * *', scanPorts);
cron.schedule('*/2 * * * *', updateInstances);

server.listen(PORT, () => {
  console.log(`AWS EC2 Monitor Backend running on port ${PORT}`);
  
  updateInstances();
  setTimeout(runPingChecks, 5000);
  setTimeout(collectSystemMetrics, 10000);
  setTimeout(scanPorts, 15000);
});