# Scaling Guide for PulseStack AWS Monitor

## Apache Configuration
✅ **Your existing Apache config will work perfectly** - no changes needed!
The containers still expose ports 3000 (frontend) and 3001 (backend).

## Scaling Options

### Option 1: Simple Scaling (Quick & Easy)
Scale individual services without load balancers:

```bash
# Scale backend to 3 replicas
docker-compose up -d --scale backend=3

# Scale frontend to 2 replicas  
docker-compose up -d --scale frontend=2

# Scale both together
docker-compose up -d --scale backend=3 --scale frontend=2
```

**Note**: Remove `container_name` from docker-compose.yml when using `--scale`

### Option 2: Advanced Scaling with Load Balancers
Use the scalable docker-compose files with built-in Nginx load balancers:

#### For Multi-Account:
```bash
# Use scalable version (2 replicas each by default)
docker-compose -f docker-compose.multi.scalable.yml up -d

# Custom scaling
docker-compose -f docker-compose.multi.scalable.yml up -d --scale backend=4 --scale frontend=3
```

#### For Single-Account:
```bash
# Use scalable version (2 replicas each by default)
docker-compose -f docker-compose.single.scalable.yml up -d

# Custom scaling
docker-compose -f docker-compose.single.scalable.yml up -d --scale backend=4 --scale frontend=3
```

## Performance Monitoring

### Check Container Performance:
```bash
# Monitor resource usage
docker stats

# Check specific container logs
docker logs aws-monitor-backend-multi

# Health check backend load balancer
curl http://localhost:3001/health

# Health check frontend load balancer  
curl http://localhost:3000/health
```

### Scaling Recommendations:

**For High Load:**
- Backend: 3-4 replicas (CPU intensive AWS API calls)
- Frontend: 2-3 replicas (lighter React serving)

**For Medium Load:**
- Backend: 2 replicas
- Frontend: 2 replicas

**For Light Load:**
- Use regular docker-compose files (single container each)

## Resource Limits (Already Configured)

**Backend Containers:**
- Memory Limit: 512MB
- Memory Reservation: 256MB

**Frontend Containers:**
- Memory Limit: 256MB
- Memory Reservation: 128MB

## Load Balancing Features

✅ **Least Connection** algorithm
✅ **Health checks** on /health endpoints  
✅ **WebSocket support** for backend
✅ **Static asset caching** for frontend
✅ **Automatic failover** (max_fails=3, fail_timeout=30s)

## Quick Commands

```bash
# Scale up during peak hours
docker-compose -f docker-compose.multi.scalable.yml up -d --scale backend=4 --scale frontend=3

# Scale down during off-peak
docker-compose -f docker-compose.multi.scalable.yml up -d --scale backend=2 --scale frontend=2

# Monitor performance
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Check running replicas
docker-compose -f docker-compose.multi.scalable.yml ps
```

Your Apache reverse proxy configuration will continue to work exactly as before!