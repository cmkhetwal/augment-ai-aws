# Quick Commands Reference Card

## 🚀 Essential Commands

### Start/Stop Stack
```bash
# Deploy
./deploy-stack-fixed.sh

# Stop
docker stack rm aws-monitor

# Restart
docker stack rm aws-monitor && sleep 15 && ./deploy-stack-fixed.sh
```

### Scale for High Load
```bash
# For 500+ instances
docker service scale aws-monitor_backend=5 aws-monitor_frontend=3

# For 1000+ instances  
docker service scale aws-monitor_backend=8 aws-monitor_frontend=4

# For 2000+ instances
docker service scale aws-monitor_backend=12 aws-monitor_frontend=6
```

### Check Status
```bash
# Stack status
docker stack services aws-monitor

# Health check
curl http://localhost/api/health

# Instance count
curl http://localhost/api/instances | jq '.instances | length'

# View logs
docker service logs aws-monitor_backend --tail 50
```

### Debug Issues
```bash
# Enable debug mode in dashboard (click "Debug Mode" button)

# Check all regions detected
curl http://localhost/api/regions

# Force refresh regions
curl -X POST http://localhost/api/regions/refresh

# Clear cache
curl -X POST http://localhost/api/cache/clear

# Test notifications
curl -X POST http://localhost/api/notifications/test
```

### Monitor Resources
```bash
# Container stats
docker stats

# Service status
docker service ls --filter name=aws-monitor

# Detailed task info
docker stack ps aws-monitor
```

---

## 🎯 Quick Troubleshooting

**Problem: Only 1 instance showing**
- Solution: Hard refresh browser (Ctrl+F5), check debug mode

**Problem: Instances showing offline**  
- Solution: Check security groups allow ICMP ping

**Problem: High load/slow performance**
- Solution: Scale backend: `docker service scale aws-monitor_backend=5`

**Problem: Services not starting**
- Solution: Check logs: `docker service logs aws-monitor_backend`