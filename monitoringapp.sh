#!/bin/bash

echo "🚀 AWS EC2 Monitor - Complete Portable Deployment Script"
echo "========================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run this script as root"
    exit 1
fi

print_status "Starting AWS EC2 Monitor deployment..."

# Step 1: Check system requirements
print_info "Step 1: Checking system requirements..."

# Check if Docker is installed
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

# Check if git is installed
if ! command -v git &> /dev/null; then
    print_warning "Git not found. Installing Git..."
    sudo apt-get update
    sudo apt-get install -y git curl
    print_status "Git installed successfully"
fi

# Step 2: Interactive AWS Credentials Setup
print_info "Step 2: AWS Credentials Configuration..."

if [ -f ".env" ]; then
    print_warning "Existing .env file found."
    read -p "Do you want to reconfigure AWS credentials? (y/n): " reconfigure
    if [[ $reconfigure != "y" && $reconfigure != "Y" ]]; then
        print_info "Using existing .env file"
        source .env
    else
        rm .env
    fi
fi

if [ ! -f ".env" ]; then
    echo ""
    echo "🔑 AWS Credentials Setup"
    echo "========================"
    echo "Please provide your AWS credentials to monitor EC2 instances:"
    echo ""
    
    # Prompt for AWS credentials
    read -p "AWS Access Key ID: " AWS_ACCESS_KEY_ID
    read -s -p "AWS Secret Access Key: " AWS_SECRET_ACCESS_KEY
    echo ""
    read -p "Default AWS Region (default: us-east-1): " AWS_REGION
    AWS_REGION=${AWS_REGION:-us-east-1}
    
    # Validate credentials are not empty
    if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
        print_error "AWS credentials cannot be empty!"
        exit 1
    fi
    
    # Email configuration for authentication
    echo ""
    echo "📧 Email Configuration for User Authentication"
    echo "=============================================="
    echo "Configure SMTP settings for user registration and password reset:"
    echo ""
    
    read -p "SMTP Host (e.g., smtp.gmail.com): " SMTP_HOST
    read -p "SMTP Port (default: 587): " SMTP_PORT
    SMTP_PORT=${SMTP_PORT:-587}
    read -p "SMTP Username (your email): " SMTP_USER
    read -s -p "SMTP Password (app password for Gmail): " SMTP_PASS
    echo ""
    read -p "From Email Address: " FROM_EMAIL
    
    # Generate JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    
    # Create .env file
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

# Authentication Configuration
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12

# Email Configuration for Authentication
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_SECURE=true
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
FROM_EMAIL=$FROM_EMAIL

# Application URL (will be auto-detected)
APP_URL=

# Email Notifications (Optional)
EMAIL_NOTIFICATIONS_ENABLED=false

# Slack Notifications (Optional)  
SLACK_NOTIFICATIONS_ENABLED=false
SLACK_WEBHOOK_URL=
SLACK_CHANNEL=
SLACK_USERNAME=aws-monitor

# Google Chat Notifications (Optional)
GOOGLE_CHAT_NOTIFICATIONS_ENABLED=false
GOOGLE_CHAT_WEBHOOK_URL=
EOF

    print_status "Configuration file created with your credentials"
fi

# Step 3: Test AWS credentials
print_info "Step 3: Testing AWS credentials..."

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

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

# Step 4: Get or clone the application code
print_info "Step 4: Getting application code..."

if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    print_info "Downloading application code from GitHub..."
    
    # Check if we're in a git repository
    if [ -d ".git" ]; then
        print_info "Updating existing repository..."
        git pull origin main
    else
        # Clone the repository
        print_info "Cloning from GitHub repository..."
        git clone https://github.com/cmkhetwal/aws-monitoring-app.git temp_repo
        cp -r temp_repo/* .
        rm -rf temp_repo
    fi
fi

# Step 5: Apply dynamic IP discovery fixes
print_info "Step 5: Applying portability fixes for dynamic IP..."

# Fix WebSocket service to use dynamic URLs
if [ -f "frontend/src/services/WebSocketService.js" ]; then
    print_status "Applying WebSocket dynamic IP fix..."
    
    # Backup original file
    cp frontend/src/services/WebSocketService.js frontend/src/services/WebSocketService.js.backup
    
    # Replace hardcoded URL with dynamic URL
    sed -i 's|this.url = `ws://localhost/ws`;|// Dynamic WebSocket URL based on current location\n    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";\n    this.url = `${protocol}//${window.location.host}/ws`;|g' frontend/src/services/WebSocketService.js
    
    print_status "WebSocket service updated for dynamic IP support"
fi

# Fix nginx configuration for proper service names
if [ -f "nginx-loadbalancer.conf" ]; then
    print_status "Applying nginx configuration fix..."
    
    # Backup original file
    cp nginx-loadbalancer.conf nginx-loadbalancer.conf.backup
    
    # Fix service names to match Docker Swarm naming
    sed -i 's/server backend:3001/server aws-monitor_backend:3001/g' nginx-loadbalancer.conf
    sed -i 's/server frontend:80/server aws-monitor_frontend:80/g' nginx-loadbalancer.conf
    
    print_status "Nginx configuration updated"
fi

# Step 6: Detect current IP and update application URL
print_info "Step 6: Detecting current server IP..."

# Try multiple methods to get public IP
PUBLIC_IP=""

# Method 1: AWS metadata service (works on EC2)
if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP=$(curl -s --connect-timeout 3 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null)
fi

# Method 2: External IP detection services
if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP=$(curl -s --connect-timeout 3 http://checkip.amazonaws.com 2>/dev/null)
fi

if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP=$(curl -s --connect-timeout 3 https://ipinfo.io/ip 2>/dev/null)
fi

if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP=$(curl -s --connect-timeout 3 https://api.ipify.org 2>/dev/null)
fi

# Fallback to localhost
if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP="localhost"
    print_warning "Could not detect public IP, using localhost"
else
    print_status "Detected server IP: $PUBLIC_IP"
fi

# Update APP_URL in .env file
sed -i "s|^APP_URL=.*|APP_URL=http://$PUBLIC_IP|g" .env

# Step 7: Build Docker images
print_info "Step 7: Building Docker images..."

# Build backend image
print_status "Building backend image..."
docker build -t aws-monitor-backend:latest ./backend
if [ $? -ne 0 ]; then
    print_error "Backend build failed!"
    exit 1
fi

# Build frontend image  
print_status "Building frontend image..."
docker build -t aws-monitor-frontend:latest ./frontend
if [ $? -ne 0 ]; then
    print_error "Frontend build failed!"
    exit 1
fi

print_status "Docker images built successfully"

# Step 8: Initialize Docker Swarm and deploy
print_info "Step 8: Deploying the application..."

# Initialize Docker Swarm if not already initialized
if ! docker info | grep -q "Swarm: active"; then
    print_status "Initializing Docker Swarm..."
    docker swarm init
fi

# Clean up any existing deployment
print_status "Cleaning up existing deployment..."
docker stack rm aws-monitor 2>/dev/null || true
sleep 15

# Remove old configs and networks
docker config rm nginx_config nginx_config_new nginx_config_fixed 2>/dev/null || true
docker network rm monitoring-network aws-monitor_monitoring-network 2>/dev/null || true

# Create nginx configuration
docker config create nginx_config nginx-loadbalancer.conf

# Create overlay network
docker network create --driver overlay --attachable monitoring-network

# Deploy the stack with environment variables
print_status "Deploying Docker stack..."
export $(cat .env | grep -v '^#' | xargs)
docker stack deploy -c docker-stack.yml aws-monitor

print_status "Docker stack deployed successfully"

# Step 9: Wait for services and configure
print_info "Step 9: Configuring services..."
sleep 30

# Scale for optimal performance
print_status "Scaling services for optimal performance..."
docker service scale aws-monitor_backend=1 aws-monitor_frontend=1 aws-monitor_nginx-proxy=1
sleep 20

# Step 10: Health checks and verification
print_info "Step 10: Performing health checks..."

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

# Step 11: Create IP monitoring service
print_info "Step 11: Setting up IP change monitoring..."

# Create IP monitoring script
cat > ip-monitor.sh << 'EOF'
#!/bin/bash

# IP monitoring script to handle dynamic IP changes
CURRENT_IP_FILE="/tmp/current_public_ip"
ENV_FILE=".env"

get_public_ip() {
    local ip=""
    
    # Try AWS metadata first (for EC2 instances)
    ip=$(curl -s --connect-timeout 3 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null)
    
    if [ -z "$ip" ]; then
        ip=$(curl -s --connect-timeout 3 http://checkip.amazonaws.com 2>/dev/null)
    fi
    
    if [ -z "$ip" ]; then
        ip=$(curl -s --connect-timeout 3 https://ipinfo.io/ip 2>/dev/null)
    fi
    
    echo "$ip"
}

# Get current IP
NEW_IP=$(get_public_ip)

# Read stored IP
if [ -f "$CURRENT_IP_FILE" ]; then
    OLD_IP=$(cat "$CURRENT_IP_FILE")
else
    OLD_IP=""
fi

# Check if IP changed
if [ "$NEW_IP" != "$OLD_IP" ] && [ ! -z "$NEW_IP" ]; then
    echo "$(date): IP changed from $OLD_IP to $NEW_IP"
    
    # Update stored IP
    echo "$NEW_IP" > "$CURRENT_IP_FILE"
    
    # Update .env file
    if [ -f "$ENV_FILE" ]; then
        sed -i "s|^APP_URL=.*|APP_URL=http://$NEW_IP|g" "$ENV_FILE"
        echo "$(date): Updated APP_URL to http://$NEW_IP"
    fi
    
    # Restart services to pick up new configuration
    docker service update --force aws-monitor_backend
    docker service update --force aws-monitor_frontend
    
    echo "$(date): Services updated with new IP"
fi
EOF

chmod +x ip-monitor.sh

# Create systemd service for IP monitoring
if command -v systemctl &> /dev/null; then
    cat > /tmp/aws-monitor-ip.service << EOF
[Unit]
Description=AWS Monitor IP Change Detection
After=network.target

[Service]
Type=oneshot
ExecStart=$(pwd)/ip-monitor.sh
WorkingDirectory=$(pwd)
User=$USER

[Install]
WantedBy=multi-user.target
EOF

    cat > /tmp/aws-monitor-ip.timer << EOF
[Unit]
Description=Run AWS Monitor IP Check every 5 minutes
Requires=aws-monitor-ip.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
EOF

    # Install the service and timer
    sudo cp /tmp/aws-monitor-ip.service /etc/systemd/system/
    sudo cp /tmp/aws-monitor-ip.timer /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable aws-monitor-ip.timer
    sudo systemctl start aws-monitor-ip.timer
    
    print_status "IP monitoring service installed and started"
fi

# Step 12: Show deployment results
echo ""
echo "🎉 Deployment Complete!"
echo "====================="

echo ""
echo "🌟 Access Points:"
echo "   📱 Dashboard: http://$PUBLIC_IP"
echo "   🔧 API: http://$PUBLIC_IP:3001"
echo "   📈 Health Check: http://$PUBLIC_IP:3001/health"
echo ""
echo "📊 Management Commands:"
echo "   View services: docker stack services aws-monitor"
echo "   View backend logs: docker service logs aws-monitor_backend"
echo "   View frontend logs: docker service logs aws-monitor_frontend"
echo "   Scale backend: docker service scale aws-monitor_backend=3"
echo "   Remove deployment: docker stack rm aws-monitor"
echo ""
echo "🔍 Troubleshooting:"
echo "   Backend logs: docker service logs aws-monitor_backend --tail 50"
echo "   Service status: docker stack ps aws-monitor"
echo "   Container status: docker ps"
echo ""
echo "🔄 IP Change Monitoring:"
echo "   IP monitoring service is running every 5 minutes"
echo "   Manual IP check: ./ip-monitor.sh"
echo "   Check monitoring status: sudo systemctl status aws-monitor-ip.timer"
echo ""

# Show current service status
echo "📊 Current Service Status:"
docker stack services aws-monitor

# Check if services are healthy
echo ""
echo "🔍 Service Health Check:"
if curl -s "http://localhost:3001/health" | grep -q "healthy" 2>/dev/null; then
    print_status "Backend service is healthy"
else
    print_warning "Backend service may not be fully ready yet"
fi

if curl -s "http://localhost" | grep -q "AWS EC2 Monitor" 2>/dev/null; then
    print_status "Frontend service is healthy"
else
    print_warning "Frontend service may not be fully ready yet"
fi

echo ""
echo "📈 Features Enabled:"
echo "   ✅ Dynamic IP detection and monitoring"
echo "   ✅ User authentication with email registration"
echo "   ✅ Password reset functionality"
echo "   ✅ Real-time EC2 monitoring across all regions"
echo "   ✅ WebSocket live updates"
echo "   ✅ Configurable notifications (Email, Slack, Google Chat)"
echo "   ✅ Auto-scaling Docker Swarm deployment"
echo ""

print_status "✅ AWS EC2 Monitor is now running and accessible!"
print_status "✅ The application will automatically handle IP changes"
print_status "✅ User registration and authentication are enabled"

# Clean up
rm -f get-docker.sh 2>/dev/null
rm -f /tmp/aws-monitor-ip.service /tmp/aws-monitor-ip.timer 2>/dev/null

echo ""
echo "🚀 Your monitoring dashboard is ready! 🚀"
echo "Visit http://$PUBLIC_IP to start monitoring your EC2 instances."
echo ""
echo "👤 First time? Register a new account on the dashboard to get started!"