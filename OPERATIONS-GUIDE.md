# AWS EC2 Monitor - Operations & Troubleshooting Guide

## 🚀 Stack Management Commands

### Start/Deploy the Stack
```bash
# Deploy the complete stack
./deploy-stack-fixed.sh

# Or deploy manually
docker stack deploy -c docker-stack.yml aws-monitor
```

### Stop the Stack
```bash
# Remove the entire stack
docker stack rm aws-monitor

# Wait for cleanup (takes 10-15 seconds)
sleep 15

# Verify stack is removed
docker stack ls
```

### Restart the Stack
```bash
# Quick restart
docker stack rm aws-monitor && sleep 15 && docker stack deploy -c docker-stack.yml aws-monitor

# Or full rebuild restart
./deploy-stack-fixed.sh
```

## 📈 Scaling Commands

### Scale Backend Services (for high load)
```bash
# Scale backend to handle more instances
docker service scale aws-monitor_backend=5

# Scale frontend for more users
docker service scale aws-monitor_frontend=3

# Scale load balancer
docker service scale aws-monitor_nginx-proxy=3

# Scale multiple services at once
docker service scale aws-monitor_backend=5 aws-monitor_frontend=3 aws-monitor_nginx-proxy=3
```

### Auto-scaling Based on Load
```bash
# For 500+ instances, recommended scaling:
docker service scale aws-monitor_backend=5 aws-monitor_frontend=3

# For 1000+ instances:
docker service scale aws-monitor_backend=8 aws-monitor_frontend=4

# For 2000+ instances:
docker service scale aws-monitor_backend=12 aws-monitor_frontend=6
```

### Check Current Scaling
```bash
# View current service replicas
docker service ls

# View detailed service info
docker service ps aws-monitor_backend
docker service ps aws-monitor_frontend
```

## 🔍 Monitoring & Health Checks

### Check Stack Status
```bash
# Overall stack status
docker stack services aws-monitor

# Detailed task status
docker stack ps aws-monitor

# Check if all services are running
docker service ls --filter name=aws-monitor
```

### Health Check Endpoints
```bash
# Backend health
curl http://localhost:3001/health

# Through load balancer
curl http://localhost/api/health

# Check region detection
curl http://localhost/api/regions

# Check instance count
curl http://localhost/api/instances | jq '.instances | length'
```

### Resource Usage Monitoring
```bash
# Monitor container resource usage
docker stats

# Monitor specific services
docker stats $(docker ps --filter name=aws-monitor --format "{{.ID}}")

# Check container logs for memory/CPU issues
docker service logs aws-monitor_backend --tail 50
```

## 🐛 Troubleshooting Commands

### View Service Logs
```bash
# Backend logs (most important for debugging)
docker service logs aws-monitor_backend --tail 100

# Frontend logs
docker service logs aws-monitor_frontend --tail 50

# Database logs
docker service logs aws-monitor_mongodb --tail 50

# Load balancer logs
docker service logs aws-monitor_nginx-proxy --tail 50

# Follow logs in real-time
docker service logs aws-monitor_backend --follow
```

### Debug Instance Detection Issues
```bash
# Check if regions are being detected
curl http://localhost/api/regions

# Force refresh regions
curl -X POST http://localhost/api/regions/refresh

# Check total instances across all regions
curl http://localhost/api/instances | jq '.instances | group_by(.Region) | map({region: .[0].Region, count: length})'

# Check specific region instances
curl http://localhost/api/instances?region=us-east-1

# Check dashboard data
curl http://localhost/api/dashboard | jq '.stats'
```

### Debug Connectivity Issues
```bash
# Test ping connectivity from backend
docker exec $(docker ps --filter "name=aws-monitor_backend" --format "{{.ID}}" | head -1) ping -c 3 8.8.8.8

# Check AWS credentials in container
docker exec $(docker ps --filter "name=aws-monitor_backend" --format "{{.ID}}" | head -1) env | grep AWS

# Test AWS API connectivity
docker exec $(docker ps --filter "name=aws-monitor_backend" --format "{{.ID}}" | head -1) curl -s https://ec2.us-east-1.amazonaws.com/
```

### Debug WebSocket Issues
```bash
# Check WebSocket connection
# Open browser console and look for WebSocket errors

# Test WebSocket endpoint
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" http://localhost/ws
```

### Debug Notification Issues
```bash
# Check notification configuration
curl http://localhost/api/notifications/config

# Send test notification
curl -X POST http://localhost/api/notifications/test

# Check notification service logs
docker service logs aws-monitor_backend | grep -i notification
```

## 🔧 Configuration Management

### Update Environment Variables
```bash
# Edit environment file
nano .env

# Restart stack to apply changes
docker stack rm aws-monitor && sleep 15 && ./deploy-stack-fixed.sh
```

### Update Configuration Without Downtime
```bash
# Update backend service only
docker service update --env-add NEW_VAR=value aws-monitor_backend

# Update image without downtime
docker service update --image aws-monitor-backend:latest aws-monitor_backend
```

### Cache Management
```bash
# Clear application cache
curl -X POST http://localhost/api/cache/clear

# Check cache statistics
curl http://localhost/api/cache/stats
```

## 📊 Performance Tuning

### Optimize for High Instance Counts
```bash
# Update environment variables for better performance
export MAX_INSTANCES=1000
export MAX_CONCURRENT_REQUESTS=25
export BATCH_SIZE=50
export REQUEST_DELAY=150

# Redeploy with new settings
docker stack rm aws-monitor && sleep 15 && ./deploy-stack-fixed.sh
```

### Database Optimization
```bash
# Connect to MongoDB for optimization
docker exec -it $(docker ps --filter name=aws-monitor_mongodb --format "{{.ID}}") mongo -u admin -p password123 --authenticationDatabase admin

# Check database size
docker exec $(docker ps --filter name=aws-monitor_mongodb --format "{{.ID}}") du -sh /data/db
```

## 🚨 Emergency Procedures

### Quick Service Restart
```bash
# Restart specific service that's having issues
docker service update --force aws-monitor_backend

# Restart all services
docker service update --force aws-monitor_backend aws-monitor_frontend aws-monitor_nginx-proxy
```

### Emergency Stop
```bash
# Immediate stop (force)
docker service rm aws-monitor_backend aws-monitor_frontend aws-monitor_nginx-proxy aws-monitor_mongodb

# Nuclear option - stop all containers
docker stop $(docker ps -q)
```

### Recover from Failed Deployment
```bash
# Rollback to previous version
docker service rollback aws-monitor_backend
docker service rollback aws-monitor_frontend

# Or completely remove and redeploy
docker stack rm aws-monitor
docker system prune -f
./deploy-stack-fixed.sh
```

## 📋 Regular Maintenance

### Daily Checks
```bash
# Check service health
docker service ls --filter name=aws-monitor

# Check resource usage
docker stats --no-stream

# Check recent logs for errors
docker service logs aws-monitor_backend --since 24h | grep -i error
```

### Weekly Maintenance
```bash
# Clean up unused resources
docker system prune -f

# Check disk usage
df -h
docker system df

# Backup important data if needed
docker exec $(docker ps --filter name=aws-monitor_mongodb --format "{{.ID}}") mongodump --host localhost --port 27017 -u admin -p password123 --authenticationDatabase admin
```

### Update/Upgrade Procedure
```bash
# 1. Backup current configuration
cp .env .env.backup
cp docker-stack.yml docker-stack.yml.backup

# 2. Pull latest code
git pull origin main  # if using git

# 3. Rebuild images
docker build -t aws-monitor-backend:latest ./backend
docker build -t aws-monitor-frontend:latest ./frontend

# 4. Update services one by one (zero downtime)
docker service update --image aws-monitor-backend:latest aws-monitor_backend
docker service update --image aws-monitor-frontend:latest aws-monitor_frontend

# 5. Verify everything works
curl http://localhost/api/health
```

## 🎯 Common Issues & Solutions

### Issue: Only showing 1 instance instead of all
```bash
# Solution 1: Clear browser cache (Ctrl+F5)
# Solution 2: Check debug mode in dashboard
# Solution 3: Check API directly
curl http://localhost/api/instances | jq '.instances | length'
```

### Issue: Instances showing offline
```bash
# Check security groups allow ICMP (ping)
# Check instance network connectivity
# Check if instances have public IPs
curl http://localhost/api/dashboard | jq '.pingResults'
```

### Issue: High CPU/Memory usage
```bash
# Scale up services
docker service scale aws-monitor_backend=5

# Check container resources
docker stats

# Adjust batch sizes
# Edit .env and set BATCH_SIZE=30, MAX_CONCURRENT_REQUESTS=10
```

### Issue: Services not starting
```bash
# Check Docker Swarm is active
docker info | grep Swarm

# Check logs for errors
docker service logs aws-monitor_backend

# Check resource availability
docker node ls
docker system df
```

## 📞 Support Commands

### Generate Debug Report
```bash
#!/bin/bash
echo "=== AWS EC2 Monitor Debug Report ===" > debug-report.txt
echo "Generated: $(date)" >> debug-report.txt
echo "" >> debug-report.txt

echo "=== Stack Services ===" >> debug-report.txt
docker stack services aws-monitor >> debug-report.txt
echo "" >> debug-report.txt

echo "=== Service Status ===" >> debug-report.txt
docker service ls --filter name=aws-monitor >> debug-report.txt
echo "" >> debug-report.txt

echo "=== API Health ===" >> debug-report.txt
curl -s http://localhost/api/health >> debug-report.txt
echo "" >> debug-report.txt

echo "=== Regions ===" >> debug-report.txt
curl -s http://localhost/api/regions >> debug-report.txt
echo "" >> debug-report.txt

echo "=== Instance Count ===" >> debug-report.txt
curl -s http://localhost/api/instances | jq '.instances | length' >> debug-report.txt
echo "" >> debug-report.txt

echo "=== Recent Backend Logs ===" >> debug-report.txt
docker service logs aws-monitor_backend --tail 50 >> debug-report.txt

echo "Debug report saved to debug-report.txt"
```

---

## 🎉 Success! Your Multi-Region AWS EC2 Monitor is Now Fully Operational

**Features Working:**
- ✅ Multi-region detection (Virginia, Ohio, Oregon)
- ✅ All 3 instances visible in dashboard  
- ✅ Real-time monitoring and alerts
- ✅ Auto-scaling with Docker Stack
- ✅ Notification integrations ready
- ✅ Search and filtering capabilities

**Remember:** Always test changes in a development environment first!