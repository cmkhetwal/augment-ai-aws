#!/bin/bash

set -e

echo "🚀 Deploying AWS EC2 Monitor Stack with Multi-Region Support..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create .env file with your AWS credentials and notification settings"
    echo "Copy from .env.example and update with your values"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

echo "✅ Environment variables loaded"
echo "📊 Configuration:"
echo "   AWS Region: ${AWS_REGION}"
echo "   Max Instances: ${MAX_INSTANCES}"
echo "   Email Notifications: ${EMAIL_NOTIFICATIONS_ENABLED}"
echo "   Slack Notifications: ${SLACK_NOTIFICATIONS_ENABLED}"
echo "   Google Chat Notifications: ${GOOGLE_CHAT_NOTIFICATIONS_ENABLED}"

# Build images with latest changes
echo "📦 Building Docker images..."
docker build -t aws-monitor-backend:latest ./backend
docker build -t aws-monitor-frontend:latest ./frontend

# Initialize Docker Swarm if not already initialized
if ! docker info | grep -q "Swarm: active"; then
    echo "🔧 Initializing Docker Swarm..."
    docker swarm init
fi

# Remove existing stack if running
echo "🧹 Cleaning up existing deployment..."
docker stack rm aws-monitor 2>/dev/null || true
sleep 10

# Create nginx configuration as a Docker config
echo "⚙️ Creating nginx configuration..."
docker config rm nginx_config 2>/dev/null || true
docker config create nginx_config nginx-loadbalancer.conf

# Create monitoring network if it doesn't exist
echo "🌐 Creating overlay network..."
docker network rm monitoring-network 2>/dev/null || true
docker network create --driver overlay --attachable monitoring-network

# Deploy the stack with environment variables
echo "🚀 Deploying the stack..."
docker stack deploy -c docker-stack.yml aws-monitor

echo "📊 Stack deployment initiated. Waiting for services to be ready..."

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check service status
echo "🔍 Checking service status..."
docker stack services aws-monitor

# Scale down for single-node deployment to avoid resource issues
echo "⚙️ Scaling services for single-node deployment..."
docker service scale aws-monitor_backend=1
docker service scale aws-monitor_frontend=1  
docker service scale aws-monitor_nginx-proxy=1

# Wait for scaling to complete
echo "⏳ Waiting for scaling to complete..."
sleep 20

# Check service status after scaling
echo "🔍 Checking service status after scaling..."
docker stack services aws-monitor

# Test the API endpoints with proper timeouts and retries
echo "🧪 Testing API endpoints..."

# Function to test endpoint with retries
test_endpoint() {
    local url=$1
    local name=$2
    local max_retries=5
    local retry_count=0
    
    echo "Testing $name endpoint..."
    while [ $retry_count -lt $max_retries ]; do
        if timeout 10 curl -s --connect-timeout 5 "$url" > /dev/null 2>&1; then
            echo "✅ $name endpoint responding"
            return 0
        fi
        retry_count=$((retry_count + 1))
        echo "⏳ Attempt $retry_count/$max_retries failed, retrying in 5 seconds..."
        sleep 5
    done
    echo "❌ $name endpoint failed after $max_retries attempts"
    return 1
}

# Wait for backend to be fully ready
echo "⏳ Waiting for backend to initialize..."
sleep 30

# Test health endpoint with retries
test_endpoint "http://localhost:3001/health" "Backend health"

# Test alternative health endpoint
if ! test_endpoint "http://localhost:3001/health" "Backend health"; then
    echo "🔄 Trying alternative health endpoint..."
    test_endpoint "http://localhost:3001/api/health" "Backend API health"
fi

# Test region detection
test_endpoint "http://localhost:3001/api/regions" "Region detection"

# Show region info if available
echo "📊 Fetching region information..."
if timeout 10 curl -s http://localhost:3001/api/regions 2>/dev/null | head -3; then
    echo ""
else
    echo "ℹ️ Region info not yet available"
fi

# Test frontend
test_endpoint "http://localhost" "Frontend"

# Show service logs and debug info
echo ""
echo "📋 Recent backend logs:"
docker service logs aws-monitor_backend --since 2m | tail -10

echo ""
echo "🔍 Debug Information:"
echo "Backend containers:"
docker ps --filter name=aws-monitor_backend --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "Network connectivity test:"
echo "Port 3001 listening: $(netstat -tln | grep :3001 || echo 'Not listening')"

echo ""
echo "Container health check:"
if docker ps --filter name=aws-monitor_backend --filter status=running -q | head -1 > /dev/null; then
    CONTAINER_ID=$(docker ps --filter name=aws-monitor_backend -q | head -1)
    echo "Backend container running: $CONTAINER_ID"
    echo "Testing internal health endpoint:"
    docker exec $CONTAINER_ID wget -qO- http://localhost:3001/health 2>/dev/null || echo "Internal health check failed"
else
    echo "❌ No running backend containers found"
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌟 Access Points:"
echo "   📱 Dashboard: http://localhost"
echo "   🔧 API: http://localhost:3001"
echo "   🔔 Notifications: http://localhost/notifications"
echo "   📈 Health Check: http://localhost:3001/health"
echo "   🌍 Regions: http://localhost:3001/api/regions"
echo ""
echo "📊 Scaling Commands:"
echo "   Backend: docker service scale aws-monitor_backend=5"
echo "   Frontend: docker service scale aws-monitor_frontend=3"
echo ""
echo "🔍 Monitoring Commands:"
echo "   Logs: docker service logs aws-monitor_backend"
echo "   Stats: docker stats"
echo "   Inspect: docker stack ps aws-monitor"
echo ""
echo "🌍 Multi-Region Features:"
echo "   - Automatic region detection is enabled"
echo "   - All AWS regions will be scanned for EC2 instances"
echo "   - Notifications configured for high CPU/RAM alerts"
echo ""
echo "📋 Next Steps:"
echo "   1. Open http://localhost to see the dashboard"
echo "   2. Check region detection: curl http://localhost:3001/api/regions"
echo "   3. Configure notifications: http://localhost/notifications"
echo "   4. Test notifications: curl -X POST http://localhost:3001/api/notifications/test"

# Show current stack status
echo ""
echo "📊 Current Stack Status:"
docker stack ps aws-monitor