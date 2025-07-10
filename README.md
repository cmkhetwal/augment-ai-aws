# AWS EC2 Monitor

A comprehensive multi-region AWS EC2 monitoring application with real-time dashboards, instance management, and alerting capabilities.

## Quick Start

### 1. Configure Environment
```bash
# Copy environment template
cp .env.template .env

# Edit with your AWS credentials
nano .env
```

### 2. Deploy
```bash
# Build and deploy
./build-images.sh
./deploy-stack.sh
```

### 3. Access
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Default login: admin@admin.com / vmware@123

## Deployment Options

### Option 1: Direct Access
Access via server IP: http://YOUR_SERVER_IP:3000

### Option 2: Reverse Proxy (Recommended)
Configure nginx/apache to proxy requests to localhost:3000 and localhost:3001

### Option 3: Custom Domain with SSL
Use Let's Encrypt for HTTPS with custom domains

## Management
```bash
# View services
docker service ls

# Scale services  
docker service scale aws-monitor_backend=3

# View logs
docker service logs aws-monitor_backend

# Remove stack
docker stack rm aws-monitor
```

## Environment Variables
- AWS_REGION: Primary AWS region
- AWS_ACCESS_KEY_ID: Required
- AWS_SECRET_ACCESS_KEY: Required
- JWT_SECRET: Required for security

See .env.template for all options.
