# PulseStack - Production Deployment Guide

## Overview
PulseStack is a comprehensive AWS EC2 infrastructure monitoring application built with React frontend, Node.js backend, and MongoDB database. It supports both single-account and multi-account AWS infrastructure monitoring.

## Docker Images
The application images are available on Docker Hub:

### Single Account Version
- **Backend**: `cmkh/pulsestack-single-account:backend-latest`
- **Frontend**: `cmkh/pulsestack-single-account:frontend-latest`

### Multi-Account Version
- **Backend**: `cmkh/pulsestack-multi-account:backend-latest`
- **Frontend**: `cmkh/pulsestack-multi-account:frontend-latest`

## Quick Start (Production)

### Prerequisites
- Docker & Docker Compose installed
- AWS credentials configured
- Port 3000 (frontend) and 3001 (backend) available

### 1. Download Production Configuration
```bash
curl -O https://raw.githubusercontent.com/your-repo/pulsestack/main/docker-compose.prod.yml
```

### 2. Configure Environment Variables
Create a `.env` file:
```bash
# AWS Credentials (Required)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1

# Security (Recommended to change)
JWT_SECRET=your-strong-jwt-secret-here

# MongoDB (Optional - defaults provided)
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=password123
```

### 3. Deploy Application
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 4. Verify Deployment
```bash
# Check container status
docker-compose -f docker-compose.prod.yml ps

# Check application health
curl http://localhost:3001/api/health
curl http://localhost:3000
```

### 5. Access Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Default Login**: admin@admin.com / vmware@123

## Configuration Options

### Environment Variables

#### Required
- `AWS_ACCESS_KEY_ID`: AWS access key for EC2 monitoring
- `AWS_SECRET_ACCESS_KEY`: AWS secret key for EC2 monitoring

#### Optional
- `AWS_REGION`: AWS region (default: us-east-1)
- `JWT_SECRET`: JWT signing secret (change in production)
- `JWT_EXPIRES_IN`: Token expiration (default: 24h)
- `MONGODB_URI`: MongoDB connection string
- `NODE_ENV`: Environment (production/development)

#### Performance Tuning
- `MAX_INSTANCES`: Maximum instances to monitor (default: 500)
- `MAX_CONCURRENT_REQUESTS`: API request concurrency (default: 25)
- `REQUEST_DELAY`: Delay between requests in ms (default: 150)
- `BATCH_SIZE`: Batch processing size (default: 50)

### Port Configuration
- Frontend: 3000
- Backend: 3001
- MongoDB: 27017

### Health Checks
Both frontend and backend include health checks:
- **Backend**: `GET /api/health`
- **Frontend**: HTTP 200 response on port 3000

## Features
- ✅ Real-time AWS EC2 instance monitoring
- ✅ Multi-region support
- ✅ Website monitoring with SSL certificate tracking
- ✅ Port scanning capabilities
- ✅ System metrics and performance monitoring
- ✅ JWT-based authentication
- ✅ Responsive dashboard with real-time updates

## Security Considerations

### Production Checklist
- [ ] Change default JWT_SECRET
- [ ] Change default MongoDB credentials
- [ ] Configure proper AWS IAM permissions
- [ ] Use HTTPS in production (reverse proxy)
- [ ] Implement proper firewall rules
- [ ] Regular security updates

### AWS IAM Permissions
Minimum required permissions:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ec2:DescribeInstances",
                "ec2:DescribeInstanceStatus",
                "ec2:DescribeRegions"
            ],
            "Resource": "*"
        }
    ]
}
```

## Scaling & Performance

### Resource Requirements
- **Memory**: 2GB+ recommended
- **CPU**: 2 cores recommended
- **Storage**: 10GB+ for MongoDB data
- **Network**: Stable internet connection for AWS API calls

### Scaling Options
- Use Docker Swarm or Kubernetes for container orchestration
- MongoDB replica sets for database redundancy
- Load balancer for multiple frontend instances
- Redis for session management in cluster setups

## Troubleshooting

### Common Issues

#### Connection Errors
```bash
# Check container logs
docker-compose -f docker-compose.prod.yml logs backend
docker-compose -f docker-compose.prod.yml logs frontend

# Verify network connectivity
docker network ls
docker network inspect augment-ai-aws_monitoring-network
```

#### AWS API Errors
- Verify AWS credentials are correct
- Check IAM permissions
- Ensure regions are accessible
- Monitor API rate limits

#### Database Issues
```bash
# Check MongoDB logs
docker-compose -f docker-compose.prod.yml logs mongodb

# Access MongoDB shell
docker exec -it pulsestack-mongodb mongosh -u admin -p password123 --authenticationDatabase admin
```

### Performance Optimization
- Adjust `MAX_CONCURRENT_REQUESTS` based on AWS rate limits
- Tune `REQUEST_DELAY` for optimal API usage
- Monitor container resource usage
- Implement caching strategies

## Monitoring & Maintenance

### Log Management
```bash
# View real-time logs
docker-compose -f docker-compose.prod.yml logs -f

# Rotate logs to prevent disk space issues
docker system prune -f
```

### Updates
```bash
# Pull latest images
docker pull cmkh/pulsestack:backend
docker pull cmkh/pulsestack:frontend

# Restart with new images
docker-compose -f docker-compose.prod.yml up -d
```

### Backup
```bash
# Backup MongoDB data
docker exec pulsestack-mongodb mongodump --authenticationDatabase admin -u admin -p password123 --out /backup

# Copy backup from container
docker cp pulsestack-mongodb:/backup ./mongodb-backup
```

## Support
For issues and feature requests, please visit the project repository or contact the development team.

---
**PulseStack v1.0** - AWS Infrastructure Monitoring Made Simple