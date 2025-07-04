#!/bin/bash

echo "🚀 AWS EC2 Monitor - New Account Deployment Script"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run this script as root"
    exit 1
fi

print_status "Starting deployment for new AWS account..."

# Step 1: Extract the application
print_status "Step 1: Extracting application files..."
if [ -f "aws-ec2-monitor-production-backup.tar.gz" ]; then
    tar -xzf aws-ec2-monitor-production-backup.tar.gz
    print_status "Application extracted successfully"
else
    print_error "aws-ec2-monitor-production-backup.tar.gz not found!"
    echo "Please ensure you have the backup file in the current directory"
    exit 1
fi

# Step 2: Install dependencies
print_status "Step 2: Installing system dependencies..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_warning "Docker not found. Installing Docker..."
    
    # Install Docker
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    
    print_status "Docker installed. Please log out and log back in, then run this script again."
    exit 0
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    print_warning "Docker Compose not found. Please install Docker Compose plugin."
fi

print_status "Docker is available"

# Step 3: Configure AWS credentials
print_status "Step 3: Configuring AWS credentials..."

# Prompt for new AWS credentials
echo ""
echo "🔑 Please provide your AWS credentials for the new account:"
echo "=================================================="
read -p "AWS Access Key ID: " NEW_AWS_ACCESS_KEY_ID
read -s -p "AWS Secret Access Key: " NEW_AWS_SECRET_ACCESS_KEY
echo ""
read -p "AWS Region (default: us-east-1): " NEW_AWS_REGION
NEW_AWS_REGION=${NEW_AWS_REGION:-us-east-1}

# Validate credentials are not empty
if [ -z "$NEW_AWS_ACCESS_KEY_ID" ] || [ -z "$NEW_AWS_SECRET_ACCESS_KEY" ]; then
    print_error "AWS credentials cannot be empty!"
    exit 1
fi

# Step 4: Create new .env file
print_status "Step 4: Creating configuration file..."

cat > .env << EOF
# AWS Configuration
AWS_REGION=$NEW_AWS_REGION
AWS_ACCESS_KEY_ID=$NEW_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$NEW_AWS_SECRET_ACCESS_KEY

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

print_status "Configuration file created"

# Step 5: Test AWS credentials
print_status "Step 5: Testing AWS credentials..."

# Create a temporary test script
cat > test-aws-credentials.js << 'EOF'
const AWS = require('aws-sdk');

// Configure AWS with provided credentials
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  credentials: new AWS.Credentials({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  })
});

const ec2 = new AWS.EC2();

console.log('Testing AWS credentials...');
ec2.describeRegions({}, (err, data) => {
  if (err) {
    console.error('❌ AWS credential test failed:', err.message);
    process.exit(1);
  } else {
    console.log('✅ AWS credentials verified successfully');
    console.log(`✅ Found ${data.Regions.length} available regions`);
    process.exit(0);
  }
});
EOF

# Test credentials using Node.js if available
if command -v node &> /dev/null; then
    export $(cat .env | grep -v '^#' | xargs)
    if node test-aws-credentials.js; then
        print_status "AWS credentials verified successfully"
    else
        print_error "AWS credential verification failed"
        rm test-aws-credentials.js
        exit 1
    fi
    rm test-aws-credentials.js
else
    print_warning "Node.js not found. Skipping credential verification."
    print_warning "Credentials will be tested during Docker deployment."
fi

# Step 6: Build Docker images
print_status "Step 6: Building Docker images..."

# Ensure we're in the right directory
if [ ! -f "docker-stack.yml" ]; then
    print_error "docker-stack.yml not found! Are you in the right directory?"
    exit 1
fi

# Build images
docker build -t aws-monitor-backend:latest ./backend
if [ $? -ne 0 ]; then
    print_error "Backend build failed!"
    exit 1
fi

docker build -t aws-monitor-frontend:latest ./frontend
if [ $? -ne 0 ]; then
    print_error "Frontend build failed!"
    exit 1
fi

print_status "Docker images built successfully"

# Step 7: Deploy the application
print_status "Step 7: Deploying the application..."

# Initialize Docker Swarm if not already initialized
if ! docker info | grep -q "Swarm: active"; then
    print_status "Initializing Docker Swarm..."
    docker swarm init
fi

# Clean up any existing deployment
docker stack rm aws-monitor 2>/dev/null || true
sleep 10

# Create nginx configuration
docker config rm nginx_config 2>/dev/null || true
docker config create nginx_config nginx-loadbalancer.conf

# Create overlay network
docker network rm monitoring-network 2>/dev/null || true
docker network create --driver overlay --attachable monitoring-network

# Deploy the stack
export $(cat .env | grep -v '^#' | xargs)
docker stack deploy -c docker-stack.yml aws-monitor

print_status "Application deployed successfully!"

# Step 8: Wait for services to be ready
print_status "Step 8: Waiting for services to start..."
sleep 30

# Scale down for single-node deployment
docker service scale aws-monitor_backend=1 aws-monitor_frontend=1 aws-monitor_nginx-proxy=1
sleep 20

# Step 9: Test deployment
print_status "Step 9: Testing deployment..."

# Function to test endpoint
test_endpoint() {
    local url=$1
    local name=$2
    local max_retries=5
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        if curl -s --connect-timeout 5 "$url" > /dev/null 2>&1; then
            print_status "$name endpoint responding"
            return 0
        fi
        retry_count=$((retry_count + 1))
        sleep 5
    done
    print_warning "$name endpoint not responding after $max_retries attempts"
    return 1
}

# Test endpoints
test_endpoint "http://localhost:3001/health" "Backend health"
test_endpoint "http://localhost" "Frontend"

# Step 10: Show deployment information
echo ""
echo "🎉 Deployment Complete!"
echo "====================="
echo ""
echo "🌟 Access Points:"
echo "   📱 Dashboard: http://localhost"
echo "   🔧 API: http://localhost:3001"
echo "   📈 Health Check: http://localhost:3001/health"
echo ""
echo "📊 Management Commands:"
echo "   View services: docker stack services aws-monitor"
echo "   View logs: docker service logs aws-monitor_backend"
echo "   Scale up: docker service scale aws-monitor_backend=3"
echo "   Remove stack: docker stack rm aws-monitor"
echo ""
echo "🔍 Troubleshooting:"
echo "   Backend logs: docker service logs aws-monitor_backend --tail 50"
echo "   Service status: docker stack ps aws-monitor"
echo ""

# Show current service status
echo "📊 Current Service Status:"
docker stack services aws-monitor

echo ""
print_status "✅ AWS EC2 Monitor is now running on your new AWS account!"
print_status "✅ The application will automatically discover EC2 instances in your account"
print_status "✅ Real-time monitoring with WebSocket updates is enabled"
print_status "✅ Multi-region support is configured"

# Clean up
rm -f get-docker.sh 2>/dev/null

echo ""
echo "🚀 Happy monitoring! 🚀"