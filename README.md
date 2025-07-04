# AWS EC2 Monitor

A comprehensive AWS EC2 monitoring application with real-time metrics, autoscaling capabilities, and multi-region support.

## Features

- **Real-time EC2 Monitoring**: Monitor CPU, memory, disk, and network metrics across all AWS regions
- **System Metrics**: Display top 5 processes by CPU and memory usage
- **Multi-Region Support**: Automatically discovers and monitors EC2 instances across all accessible regions
- **WebSocket Updates**: Real-time dashboard updates with live metrics
- **Docker Swarm Deployment**: Production-ready deployment with autoscaling
- **Load Balancer**: Nginx-based load balancing for high availability
- **CloudWatch Integration**: Enhanced memory metrics via CloudWatch Agent
- **SSM Integration**: Real-time process monitoring via Systems Manager

## Architecture

- **Backend**: Node.js/Express with AWS SDK v2
- **Frontend**: React with Ant Design UI
- **Database**: In-memory caching with node-cache
- **Deployment**: Docker Swarm with overlay networking
- **Load Balancer**: Nginx reverse proxy
- **Monitoring**: CloudWatch + SSM Agent integration

## Quick Start

### Prerequisites

- Docker installed
- AWS credentials configured
- EC2 instances with CloudWatch Agent and SSM Agent (for enhanced metrics)

### Deployment Options

#### 1. Deploy with Existing AWS Credentials

```bash
# If you have AWS credentials in ~/.aws/credentials
chmod +x deploy-with-existing-credentials.sh
./deploy-with-existing-credentials.sh
```

#### 2. Deploy to New AWS Account

```bash
# For new AWS account with different credentials
chmod +x deploy-new-account.sh
./deploy-new-account.sh
```

#### 3. Comprehensive Deployment Fix

```bash
# Applies all fixes for common deployment issues
chmod +x final-deployment-fix.sh
./final-deployment-fix.sh
```

### Configuration

Create a `.env` file with your AWS credentials:

```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Application Configuration
MAX_INSTANCES=500
MAX_CONCURRENT_REQUESTS=25
REQUEST_DELAY=150
BATCH_SIZE=50
```

## Access Points

After deployment, access the application at:

- **Dashboard**: `http://your-server-ip`
- **API**: `http://your-server-ip:3001`
- **Health Check**: `http://your-server-ip:3001/health`

## Management Commands

```bash
# View service status
docker stack services aws-monitor

# View logs
docker service logs aws-monitor_backend --tail 50

# Scale services
docker service scale aws-monitor_backend=3

# Remove deployment
docker stack rm aws-monitor
```

## Monitoring Features

### Real-time Metrics
- CPU utilization
- Memory usage (via CloudWatch Agent)
- Disk usage
- Network I/O
- Top 5 processes by CPU/Memory

### Multi-Region Support
- Automatically scans all accessible AWS regions
- Unified dashboard for all regions
- Region-specific filtering

### WebSocket Updates
- Real-time dashboard updates
- Live metrics streaming
- Connection status monitoring

## Troubleshooting

### Common Issues

1. **WebSocket Disconnection**: Check if the application is using dynamic WebSocket URLs
2. **Memory Metrics Not Showing**: Ensure CloudWatch Agent is installed and configured
3. **Process Data Missing**: Verify SSM Agent is running on EC2 instances
4. **Deployment Stuck**: Use `final-deployment-fix.sh` for comprehensive fixes

### Debug Commands

```bash
# Check service health
curl http://localhost:3001/health

# View backend logs
docker service logs aws-monitor_backend --tail 50

# Check service status
docker stack ps aws-monitor

# Test WebSocket connection
curl -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost/ws
```

## Development

### Local Development

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm start
```

### Docker Development

```bash
# Build images
docker build -t aws-monitor-backend:latest ./backend
docker build -t aws-monitor-frontend:latest ./frontend

# Run with Docker Compose
docker-compose up -d
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.