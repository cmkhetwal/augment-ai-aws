#!/bin/bash

echo "🚀 AWS EC2 Monitor - Deployment with Existing AWS Credentials"
echo "=============================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_status "Starting deployment with existing AWS credentials..."

# Step 1: Extract the application
print_status "Step 1: Extracting application files..."
if [ -f "aws-ec2-monitor-production-backup.tar.gz" ]; then
    tar -xzf aws-ec2-monitor-production-backup.tar.gz
    print_status "Application extracted successfully"
else
    print_error "aws-ec2-monitor-production-backup.tar.gz not found!"
    exit 1
fi

# Step 2: Read AWS credentials from ~/.aws/credentials
print_status "Step 2: Reading AWS credentials from ~/.aws/credentials..."

if [ ! -f ~/.aws/credentials ]; then
    print_error "AWS credentials file not found at ~/.aws/credentials"
    exit 1
fi

# Extract credentials from AWS credentials file
AWS_ACCESS_KEY_ID=$(grep -A2 "\[default\]" ~/.aws/credentials | grep "aws_access_key_id" | cut -d'=' -f2 | xargs)
AWS_SECRET_ACCESS_KEY=$(grep -A2 "\[default\]" ~/.aws/credentials | grep "aws_secret_access_key" | cut -d'=' -f2 | xargs)
AWS_REGION=$(grep -A3 "\[default\]" ~/.aws/credentials | grep "region" | cut -d'=' -f2 | xargs)

# Check if region is in config file if not in credentials
if [ -z "$AWS_REGION" ] && [ -f ~/.aws/config ]; then
    AWS_REGION=$(grep -A1 "\[default\]" ~/.aws/config | grep "region" | cut -d'=' -f2 | xargs)
fi

# Default region if not found
AWS_REGION=${AWS_REGION:-us-east-1}

# Validate credentials
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    print_error "Could not read AWS credentials from ~/.aws/credentials"
    print_error "Please ensure the file exists and contains [default] profile with access key and secret key"
    exit 1
fi

print_status "AWS credentials loaded successfully"
echo "   Region: $AWS_REGION"
echo "   Access Key: ${AWS_ACCESS_KEY_ID:0:10}..."

# Step 3: Create .env file with existing credentials
print_status "Step 3: Creating configuration file..."

cat > .env << EOF
# AWS Configuration
AWS_REGION=$AWS_REGION
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY

# Application Configuration
MAX_INSTANCES=500
MAX_CONCURRENT_REQUESTS=25
REQUEST_DELAY=150
BATCH_SIZE=50

# Email Notifications (Optional)
EMAIL_NOTIFICATIONS_ENABLED=false
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=
TO_EMAILS=

# Slack Notifications (Optional)
SLACK_NOTIFICATIONS_ENABLED=false
SLACK_WEBHOOK_URL=
SLACK_CHANNEL=
SLACK_USERNAME=aws-monitor

# Google Chat Notifications (Optional)
GOOGLE_CHAT_NOTIFICATIONS_ENABLED=false
GOOGLE_CHAT_WEBHOOK_URL=
EOF

print_status "Configuration file created with existing AWS credentials"

# Step 4: Install Docker if not present
print_status "Step 4: Checking Docker installation..."

if ! command -v docker &> /dev/null; then
    print_warning "Docker not found. Installing Docker..."
    
    # Update package index
    sudo apt-get update
    
    # Install Docker
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    
    print_status "Docker installed successfully"
    print_warning "Please log out and log back in for Docker group changes to take effect"
    print_warning "Then run this script again to complete the deployment"
    exit 0
else
    print_status "Docker is already installed"
fi

# Step 5: Test AWS credentials
print_status "Step 5: Testing AWS credentials..."

# Quick test using AWS CLI if available
if command -v aws &> /dev/null; then
    if AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION=$AWS_REGION aws sts get-caller-identity > /dev/null 2>&1; then
        print_status "AWS credentials verified successfully"
    else
        print_warning "AWS credential verification failed, but continuing with deployment"
    fi
else
    print_warning "AWS CLI not found. Credentials will be tested during application startup"
fi

# Step 6: Build Docker images
print_status "Step 6: Building Docker images..."

# Build backend
print_status "Building backend image..."
docker build -t aws-monitor-backend:latest ./backend
if [ $? -ne 0 ]; then
    print_error "Backend build failed!"
    exit 1
fi

# Build frontend
print_status "Building frontend image..."
docker build -t aws-monitor-frontend:latest ./frontend
if [ $? -ne 0 ]; then
    print_error "Frontend build failed!"
    exit 1
fi

print_status "Docker images built successfully"

# Step 7: Initialize Docker Swarm and deploy
print_status "Step 7: Deploying the application..."

# Initialize Docker Swarm if not already initialized
if ! docker info | grep -q "Swarm: active"; then
    print_status "Initializing Docker Swarm..."
    docker swarm init
fi

# Clean up any existing deployment
print_status "Cleaning up existing deployment..."
docker stack rm aws-monitor 2>/dev/null || true
sleep 10

# Create nginx configuration
docker config rm nginx_config 2>/dev/null || true
docker config create nginx_config nginx-loadbalancer.conf

# Create overlay network
docker network rm monitoring-network 2>/dev/null || true
docker network create --driver overlay --attachable monitoring-network

# Deploy the stack with environment variables
print_status "Deploying Docker stack..."
export $(cat .env | grep -v '^#' | xargs)
docker stack deploy -c docker-stack.yml aws-monitor

print_status "Docker stack deployed successfully"

# Step 8: Wait for services and scale appropriately
print_status "Step 8: Configuring services..."
sleep 30

# Scale down for single-node deployment (better for smaller instances)
print_status "Scaling services for optimal performance..."
docker service scale aws-monitor_backend=1 aws-monitor_frontend=1 aws-monitor_nginx-proxy=1
sleep 20

# Step 9: Test deployment
print_status "Step 9: Testing deployment..."

# Function to test endpoint with retries
test_endpoint() {
    local url=$1
    local name=$2
    local max_retries=10
    local retry_count=0
    
    echo "Testing $name endpoint..."
    while [ $retry_count -lt $max_retries ]; do
        if timeout 10 curl -s --connect-timeout 5 "$url" > /dev/null 2>&1; then
            print_status "$name endpoint is responding"
            return 0
        fi
        retry_count=$((retry_count + 1))
        echo "   Attempt $retry_count/$max_retries..."
        sleep 5
    done
    print_warning "$name endpoint not responding after $max_retries attempts"
    return 1
}

# Wait a bit more for services to fully start
sleep 20

# Test endpoints
test_endpoint "http://localhost:3001/health" "Backend health"
test_endpoint "http://localhost" "Frontend dashboard"

# Step 10: Show deployment results
echo ""
echo "🎉 Deployment Complete!"
echo "====================="

# Get server IP for external access
SERVER_IP=$(curl -s http://checkip.amazonaws.com/ 2>/dev/null || echo "localhost")

echo ""
echo "🌟 Access Points:"
echo "   📱 Dashboard: http://$SERVER_IP"
echo "   🔧 API: http://$SERVER_IP:3001"
echo "   📈 Health Check: http://$SERVER_IP:3001/health"
echo ""
echo "📊 Management Commands:"
echo "   View services: docker stack services aws-monitor"
echo "   View backend logs: docker service logs aws-monitor_backend"
echo "   View frontend logs: docker service logs aws-monitor_frontend"
echo "   Scale up backend: docker service scale aws-monitor_backend=3"
echo "   Remove deployment: docker stack rm aws-monitor"
echo ""
echo "🔍 Troubleshooting:"
echo "   Backend logs: docker service logs aws-monitor_backend --tail 50"
echo "   Service status: docker stack ps aws-monitor"
echo "   Container status: docker ps"
echo ""

# Show current service status
echo "📊 Current Service Status:"
docker stack services aws-monitor

# Check if services are healthy
echo ""
echo "🔍 Service Health Check:"
if curl -s "http://localhost:3001/health" | grep -q "healthy"; then
    print_status "Backend service is healthy"
else
    print_warning "Backend service may not be fully ready yet"
fi

if curl -s "http://localhost" | grep -q "AWS EC2 Monitor"; then
    print_status "Frontend service is healthy"
else
    print_warning "Frontend service may not be fully ready yet"
fi

# Show some useful information
echo ""
echo "📈 Expected Behavior:"
echo "   • The application will automatically discover EC2 instances in your AWS account"
echo "   • Real-time metrics collection starts within 2-3 minutes"
echo "   • WebSocket connection provides live updates to the dashboard"
echo "   • Multi-region support is enabled (scans all accessible regions)"
echo ""

print_status "✅ AWS EC2 Monitor is now running with your existing AWS credentials!"

# Clean up
rm -f get-docker.sh 2>/dev/null

echo ""
echo "🚀 Your monitoring dashboard is ready! 🚀"
echo "Visit http://$SERVER_IP to start monitoring your EC2 instances."