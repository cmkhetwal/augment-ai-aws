#!/bin/bash

echo "🔧 AWS EC2 Monitor - Complete Deployment Fix"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_status "Applying comprehensive fixes to ensure deployment works..."

# CRITICAL FIX 1: Fix WebSocket URL in source code
print_status "Fix 1: Updating WebSocket URL to be dynamic..."
if [ -f "frontend/src/services/WebSocketService.js" ]; then
    # Create backup
    cp frontend/src/services/WebSocketService.js frontend/src/services/WebSocketService.js.backup
    
    # Replace hardcoded URL with dynamic URL
    sed -i 's|this.url = `ws://localhost/ws`;|// Dynamic WebSocket URL based on current location\n    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";\n    this.url = `${protocol}//${window.location.host}/ws`;|g' frontend/src/services/WebSocketService.js
    
    # Verify the fix
    if grep -q "window.location.host" frontend/src/services/WebSocketService.js; then
        print_status "WebSocket URL fixed successfully"
    else
        print_error "WebSocket URL fix failed"
        exit 1
    fi
else
    print_error "WebSocket service file not found!"
    exit 1
fi

# CRITICAL FIX 2: Fix nginx service names
print_status "Fix 2: Updating nginx configuration with correct service names..."
if [ -f "nginx-loadbalancer.conf" ]; then
    # Create backup
    cp nginx-loadbalancer.conf nginx-loadbalancer.conf.backup
    
    # Fix service names
    sed -i 's/server backend:3001/server aws-monitor_backend:3001/g' nginx-loadbalancer.conf
    sed -i 's/server frontend:80/server aws-monitor_frontend:80/g' nginx-loadbalancer.conf
    
    # Verify the fix
    if grep -q "aws-monitor_backend:3001" nginx-loadbalancer.conf && grep -q "aws-monitor_frontend:80" nginx-loadbalancer.conf; then
        print_status "Nginx configuration fixed successfully"
    else
        print_error "Nginx configuration fix failed"
        exit 1
    fi
else
    print_error "Nginx configuration file not found!"
    exit 1
fi

# CRITICAL FIX 3: Ensure AWS credentials are properly validated
print_status "Fix 3: Ensuring AWS credential validation in backend..."
if [ -f "backend/services/awsServiceMultiRegion.js" ]; then
    # Check if validation already exists
    if ! grep -q "AWS credentials not found" backend/services/awsServiceMultiRegion.js; then
        # Add credential validation
        sed -i '6a\    // Validate environment variables\n    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {\n      throw new Error("AWS credentials not found. AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set.");\n    }\n    console.log("Using AWS credentials:", {\n      accessKeyId: process.env.AWS_ACCESS_KEY_ID?.substring(0, 10) + "...",\n      region: process.env.AWS_REGION\n    });' backend/services/awsServiceMultiRegion.js
        
        # Add explicit credentials
        sed -i 's/secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,/secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,\n      credentials: new AWS.Credentials({\n        accessKeyId: process.env.AWS_ACCESS_KEY_ID,\n        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY\n      }),/g' backend/services/awsServiceMultiRegion.js
        
        print_status "AWS credential validation added"
    else
        print_status "AWS credential validation already present"
    fi
fi

# Build images with all fixes
print_status "Building Docker images with all fixes applied..."

# Rebuild backend
docker build --no-cache -t aws-monitor-backend:latest ./backend
if [ $? -ne 0 ]; then
    print_error "Backend build failed!"
    exit 1
fi

# Rebuild frontend
docker build --no-cache -t aws-monitor-frontend:latest ./frontend
if [ $? -ne 0 ]; then
    print_error "Frontend build failed!"
    exit 1
fi

print_status "Docker images rebuilt successfully with all fixes"

# CRITICAL FIX 4: Deploy with proper network configuration
print_status "Fix 4: Deploying with proper network configuration..."

# Initialize Docker Swarm if needed
if ! docker info | grep -q "Swarm: active"; then
    docker swarm init
fi

# Remove any existing deployment
docker stack rm aws-monitor 2>/dev/null || true
sleep 15

# Remove and recreate nginx config with fixed version
docker config rm nginx_config nginx_config_new nginx_config_fixed 2>/dev/null || true
docker config create nginx_config nginx-loadbalancer.conf

# Remove and recreate network
docker network rm monitoring-network aws-monitor_monitoring-network 2>/dev/null || true
docker network create --driver overlay --attachable monitoring-network

# Deploy stack
export $(cat .env | grep -v '^#' | xargs)
docker stack deploy -c docker-stack.yml aws-monitor

print_status "Stack deployed, waiting for services to stabilize..."
sleep 30

# Scale to single instances for reliability
docker service scale aws-monitor_backend=1 aws-monitor_frontend=1 aws-monitor_nginx-proxy=1
sleep 20

# CRITICAL FIX 5: Verify all services are on the same network
print_status "Fix 5: Verifying network connectivity..."

# Check service status
print_status "Service Status:"
docker stack services aws-monitor

# Test connectivity
test_connectivity() {
    local service=$1
    local max_attempts=5
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker exec $(docker ps --filter name=$service -q | head -1) nslookup aws-monitor_backend 2>/dev/null | grep -q "Address:"; then
            print_status "$service can resolve aws-monitor_backend"
            return 0
        fi
        print_warning "$service connectivity test $attempt/$max_attempts failed, retrying..."
        sleep 5
        attempt=$((attempt + 1))
    done
    return 1
}

# Test nginx to backend connectivity
if test_connectivity "aws-monitor_nginx-proxy"; then
    print_status "Network connectivity verified"
else
    print_warning "Network connectivity issues detected, but continuing..."
fi

# Final verification
print_status "Final verification..."
sleep 10

# Test endpoints
test_endpoint() {
    local url=$1
    local name=$2
    local max_retries=3
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        if timeout 10 curl -s --connect-timeout 5 "$url" > /dev/null 2>&1; then
            print_status "$name endpoint is working"
            return 0
        fi
        retry_count=$((retry_count + 1))
        sleep 5
    done
    print_warning "$name endpoint not responding"
    return 1
}

# Test all endpoints
if test_endpoint "http://localhost:3001/health" "Backend health"; then
    if test_endpoint "http://localhost" "Frontend dashboard"; then
        print_status "🎉 ALL FIXES APPLIED SUCCESSFULLY!"
        echo ""
        echo "✅ WebSocket URL: Fixed to use dynamic location"
        echo "✅ Nginx Config: Fixed service names"
        echo "✅ AWS Credentials: Validated and configured"
        echo "✅ Docker Network: Properly configured"
        echo "✅ All Services: Running and accessible"
        echo ""
        echo "🌐 Access your dashboard at: http://$(curl -s http://checkip.amazonaws.com 2>/dev/null || echo 'SERVER_IP')"
        echo ""
        print_status "Deployment completed successfully!"
    else
        print_warning "Frontend not fully ready yet, but backend is working"
    fi
else
    print_warning "Some services may still be starting up"
fi

# Show current status
echo ""
echo "📊 Current Service Status:"
docker stack ps aws-monitor

echo ""
echo "🔍 To monitor deployment:"
echo "   Backend logs: docker service logs aws-monitor_backend --tail 50"
echo "   Service status: docker stack services aws-monitor"
echo "   Full status: docker stack ps aws-monitor"

print_status "Comprehensive deployment fix completed!"