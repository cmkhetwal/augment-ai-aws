# Docker Stack Deployment Guide

## ✅ **Yes! Docker Stack is Much Better for Production Scaling**

Docker Stack provides:
- ✅ **Built-in load balancing** (no need for separate Nginx)
- ✅ **Rolling updates** with zero downtime
- ✅ **Automatic rollback** on failures
- ✅ **Resource limits** and constraints
- ✅ **Easy scaling** with single commands

## **Setup Docker Swarm (One-time)**

```bash
# Initialize Docker Swarm
docker swarm init

# Check swarm status
docker node ls
```

## **Multi-Account Production Deployment**

### 1. **Deploy Stack**
```bash
# Configure environment
cp backend/.env.example .env
nano .env  # Set your AWS credentials

# Deploy multi-account stack (starts with 2 replicas each)
docker stack deploy -c docker-stack.multi.yml pulsestack-multi
```

### 2. **Scale Services Dynamically**
```bash
# Scale backend to 4 replicas for high load
docker service scale pulsestack-multi_backend=4

# Scale frontend to 3 replicas
docker service scale pulsestack-multi_frontend=3

# Scale both together
docker service scale pulsestack-multi_backend=4 pulsestack-multi_frontend=3

# Scale down during low traffic
docker service scale pulsestack-multi_backend=1 pulsestack-multi_frontend=1
```

## **Single-Account Production Deployment**

```bash
# Deploy single-account stack
docker stack deploy -c docker-stack.single.yml pulsestack-single

# Scale as needed
docker service scale pulsestack-single_backend=3 pulsestack-single_frontend=2
```

## **Management Commands**

### **Monitor Services**
```bash
# List all services
docker service ls

# Check service details
docker service ps pulsestack-multi_backend

# View service logs
docker service logs pulsestack-multi_backend

# Real-time stats
docker stats $(docker ps --format {{.Names}})
```

### **Updates (Zero Downtime)**
```bash
# Update backend image
docker service update --image cmkh/pulsestack-multi-account:backend-v2 pulsestack-multi_backend

# Update frontend image  
docker service update --image cmkh/pulsestack-multi-account:frontend-v2 pulsestack-multi_frontend
```

### **Rolling Updates**
```bash
# Update with custom parameters
docker service update \
  --update-parallelism 1 \
  --update-delay 30s \
  --image cmkh/pulsestack-multi-account:backend-latest \
  pulsestack-multi_backend
```

### **Rollback**
```bash
# Rollback backend to previous version
docker service rollback pulsestack-multi_backend

# Rollback frontend
docker service rollback pulsestack-multi_frontend
```

## **Health Checks**

```bash
# Check service health
docker service inspect --pretty pulsestack-multi_backend

# Test load balancing
curl http://localhost:3001/api/health
curl http://localhost:3000/health
```

## **Stack Management**

```bash
# Remove entire stack
docker stack rm pulsestack-multi

# List all stacks
docker stack ls

# View stack services
docker stack services pulsestack-multi
```

## **Your Apache Config Still Works!**

✅ **No changes needed** - Docker Stack provides internal load balancing
✅ **Same ports**: 3000 (frontend) and 3001 (backend)
✅ **Built-in redundancy**: Multiple replicas automatically load balanced

## **Quick Start for Production**

```bash
# 1. Setup environment
cp backend/.env.example .env
# Edit .env with your AWS credentials

# 2. Initialize swarm (if not done)
docker swarm init

# 3. Deploy multi-account stack
docker stack deploy -c docker-stack.multi.yml pulsestack-multi

# 4. Scale for production load
docker service scale pulsestack-multi_backend=3 pulsestack-multi_frontend=2

# 5. Monitor
docker service ls
docker service logs pulsestack-multi_backend
```

**Docker Stack is the production-grade solution!** 🚀