# AWS EC2 Monitor - Production Deployment Guide

## 🚀 Production Setup on AWS Server

This package contains everything needed to deploy the AWS EC2 Multi-Region Monitor on your production AWS server.

## 📋 Prerequisites

### 1. AWS Server Requirements
- **OS**: Ubuntu 20.04+ or Amazon Linux 2
- **RAM**: Minimum 4GB (8GB+ recommended for 500+ instances)
- **CPU**: 2+ cores (4+ cores recommended)
- **Disk**: 20GB+ free space
- **Docker**: Installed and running
- **Network**: Security groups allow inbound ports 80, 443, 3001

### 2. AWS Permissions Required
Your AWS credentials need these permissions:
- `ec2:DescribeInstances`
- `ec2:DescribeInstanceStatus`
- `ec2:DescribeRegions`
- `cloudwatch:GetMetricStatistics`

### 3. Security Group Configuration
**IMPORTANT:** Your EC2 instances must allow ICMP (ping) traffic:
- **Type**: All ICMP - IPv4
- **Source**: Your monitoring server's IP or security group
- **Port Range**: All

## 🛠️ Installation Steps

### Step 1: Upload Files to AWS Server
```bash
# Upload this entire folder to your AWS server
scp -r aws-ec2-monitor-production/ user@your-aws-server:~/

# Or if already on the server, clone/copy the files
```

### Step 2: Verify Docker Installation
```bash
# Check Docker is installed and running
docker --version
docker info

# If Docker Swarm is not initialized
docker swarm init
```

### Step 3: Configure Environment
```bash
cd aws-ec2-monitor-production

# Copy environment template
cp .env.example .env

# Edit with your settings
nano .env
```

### Step 4: Configure Environment Variables
Edit `.env` file with your production settings:

```bash
# AWS Configuration (REQUIRED)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_production_access_key
AWS_SECRET_ACCESS_KEY=your_production_secret_key

# Multi-Region Settings
MAX_INSTANCES=500
MAX_CONCURRENT_REQUESTS=15
REQUEST_DELAY=200
BATCH_SIZE=30

# Database Configuration
MONGODB_URI=mongodb://admin:password123@mongodb:27017/aws-monitor?authSource=admin

# Email Notifications (Optional)
EMAIL_NOTIFICATIONS_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@company.com
SMTP_PASS=your-app-password
FROM_EMAIL=aws-monitor@company.com
TO_EMAILS=admin@company.com,devops@company.com

# Slack Notifications (Optional)
SLACK_NOTIFICATIONS_ENABLED=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
SLACK_CHANNEL=#aws-monitoring
SLACK_USERNAME=AWS Monitor Bot

# Google Chat Notifications (Optional)
GOOGLE_CHAT_NOTIFICATIONS_ENABLED=true
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/YOUR/COMPLETE/WEBHOOK/URL

# Production Settings
NODE_ENV=production
PORT=3001
```

### Step 5: Deploy the Stack
```bash
# Make deployment script executable
chmod +x deploy-stack-fixed.sh

# Deploy the production stack
./deploy-stack-fixed.sh
```

### Step 6: Verify Deployment
```bash
# Check all services are running
docker stack services aws-monitor

# Test API endpoints
curl http://localhost/api/health
curl http://localhost/api/regions
curl http://localhost/api/instances

# Access dashboard
# Open: http://your-server-ip/
```

## 🔧 Production Configuration

### For High-Volume Monitoring (500+ instances)
```bash
# Scale services for production load
docker service scale aws-monitor_backend=5
docker service scale aws-monitor_frontend=3
docker service scale aws-monitor_nginx-proxy=2
```

### Environment Variables for Scale
```bash
# For 1000+ instances, update .env:
MAX_INSTANCES=1000
MAX_CONCURRENT_REQUESTS=25
BATCH_SIZE=50
REQUEST_DELAY=150

# Restart stack after changes
docker stack rm aws-monitor && sleep 15 && ./deploy-stack-fixed.sh
```

## 🌐 External Access Configuration

### Option 1: Direct IP Access
```bash
# Access via server IP
http://your-aws-server-ip/
```

### Option 2: Domain Setup (Recommended)
```bash
# Point your domain to the server IP
# Update nginx configuration if needed
```

### Option 3: Load Balancer Integration
```bash
# Configure AWS ALB/ELB to point to port 80
# Target: your-server-ip:80
```

## 🔒 Security Hardening

### 1. Firewall Configuration
```bash
# Allow only necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS (if using SSL)
sudo ufw enable
```

### 2. SSL/TLS Setup (Recommended)
```bash
# Install certbot for Let's Encrypt
sudo apt install certbot

# Get SSL certificate
sudo certbot certonly --standalone -d your-domain.com

# Update nginx configuration for SSL
# (See SSL section below)
```

### 3. Restrict Dashboard Access
Edit `nginx-loadbalancer.conf` to add IP restrictions:
```nginx
location / {
    allow 10.0.0.0/8;     # Your office IP range
    allow 172.16.0.0/12;  # VPC range
    deny all;
    
    proxy_pass http://frontend_pool;
    # ... rest of config
}
```

## 📊 Monitoring the Monitor

### Resource Monitoring
```bash
# Check system resources
htop
df -h
docker stats

# Monitor application logs
docker service logs aws-monitor_backend --follow
```

### Log Management
```bash
# Set up log rotation
sudo nano /etc/logrotate.d/docker

# Content:
/var/lib/docker/containers/*/*.log {
  rotate 7
  daily
  compress
  size=1M
  missingok
  delaycompress
  copytruncate
}
```

## 🚨 Backup & Recovery

### Backup Configuration
```bash
# Backup script
#!/bin/bash
BACKUP_DIR="/home/backup/aws-monitor"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup configuration
cp .env $BACKUP_DIR/env_$DATE
cp docker-stack.yml $BACKUP_DIR/stack_$DATE.yml

# Backup database
docker exec $(docker ps --filter name=aws-monitor_mongodb --format "{{.ID}}") \
  mongodump --host localhost --port 27017 -u admin -p password123 \
  --authenticationDatabase admin --out $BACKUP_DIR/db_$DATE
```

### Recovery Procedure
```bash
# Restore configuration
cp backup/env_YYYYMMDD_HHMMSS .env

# Restore database (if needed)
docker exec -i $(docker ps --filter name=aws-monitor_mongodb --format "{{.ID}}") \
  mongorestore --host localhost --port 27017 -u admin -p password123 \
  --authenticationDatabase admin backup/db_YYYYMMDD_HHMMSS
```

## 🔧 Troubleshooting Production Issues

### Common Production Issues

#### 1. High Memory Usage
```bash
# Scale up backend
docker service scale aws-monitor_backend=5

# Check memory usage
docker stats
free -h
```

#### 2. Slow Response Times
```bash
# Increase batch processing
# Edit .env: BATCH_SIZE=20, REQUEST_DELAY=300

# Scale services
docker service scale aws-monitor_backend=5
```

#### 3. Database Connection Issues
```bash
# Check MongoDB
docker service logs aws-monitor_mongodb

# Restart database if needed
docker service update --force aws-monitor_mongodb
```

#### 4. AWS API Rate Limiting
```bash
# Reduce request frequency
# Edit .env: MAX_CONCURRENT_REQUESTS=10, REQUEST_DELAY=500
```

### Health Check Scripts
```bash
# Create health check script
cat > health-check.sh << 'EOF'
#!/bin/bash
echo "=== AWS EC2 Monitor Health Check ==="
echo "Time: $(date)"

# Check services
echo "Services:"
docker service ls --filter name=aws-monitor

# Check API
echo "API Health:"
curl -s http://localhost/api/health | jq .

# Check instance count
echo "Monitored Instances:"
curl -s http://localhost/api/instances | jq '.instances | length'

# Check regions
echo "Active Regions:"
curl -s http://localhost/api/regions | jq '.enabledRegions'
EOF

chmod +x health-check.sh
```

## 📋 Maintenance Schedule

### Daily
- Check service status: `docker service ls`
- Check resource usage: `docker stats --no-stream`
- Review error logs: `docker service logs aws-monitor_backend --since 24h | grep -i error`

### Weekly
- Update system packages: `sudo apt update && sudo apt upgrade`
- Clean Docker resources: `docker system prune -f`
- Check disk usage: `df -h`

### Monthly
- Review and rotate logs
- Update application if needed
- Review notification configurations
- Performance optimization review

## 🎯 Success Metrics

Your production deployment is successful when:
- ✅ All services show 1/1 replicas in `docker service ls`
- ✅ Health endpoint returns 200: `curl http://localhost/api/health`
- ✅ Dashboard loads without errors
- ✅ All your AWS regions are detected
- ✅ All EC2 instances are visible and monitored
- ✅ Notifications are working (test with `/api/notifications/test`)

## 📞 Support

For production issues:
1. Check `OPERATIONS-GUIDE.md` for troubleshooting
2. Review logs: `docker service logs aws-monitor_backend`
3. Generate debug report (see OPERATIONS-GUIDE.md)
4. Check AWS permissions and security groups

---

## 🎉 You're Ready for Production!

This setup will monitor **500+ EC2 instances** across **all AWS regions** with **real-time alerts** and **auto-scaling capabilities**.