#\!/bin/bash

# Universal AWS EC2 Monitor Deployment Script
# Works on any server with any IP address

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to detect public IP
detect_public_ip() {
    local ip
    # Try multiple methods to get public IP
    ip=$(curl -s ifconfig.me 2>/dev/null) ||     ip=$(curl -s ipinfo.io/ip 2>/dev/null) ||     ip=$(curl -s icanhazip.com 2>/dev/null) ||     ip=$(curl -s checkip.amazonaws.com 2>/dev/null)
    
    if [ -z "$ip" ]; then
        print_warning "Could not detect public IP automatically"
        read -p "Please enter your server's public IP address: " ip
    fi
    
    echo $ip
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Docker
    if \! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if \! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi
    
    # Check if Docker daemon is running
    if \! docker info &> /dev/null; then
        print_error "Docker daemon is not running. Please start Docker."
        exit 1
    fi
    
    print_success "All prerequisites met"
}

# Function to initialize Docker Swarm
init_swarm() {
    print_status "Checking Docker Swarm status..."
    
    if \! docker node ls &> /dev/null; then
        print_status "Initializing Docker Swarm..."
        docker swarm init
        print_success "Docker Swarm initialized"
    else
        print_success "Docker Swarm already initialized"
    fi
}

# Function to create environment file
create_env_file() {
    print_status "Creating environment configuration..."
    
    if [ \! -f .env ]; then
        print_status "Creating .env file..."
        cat > .env << 'ENVEOF'
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key

# Application Configuration
NODE_ENV=production
JWT_SECRET=change-this-secret-in-production-b59d6b344025fc2285ef2b3d9473a06f9abe057ed7483322a39df5505f261ca5
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12

# Database Configuration
MONGODB_URI=mongodb://admin:password123@mongodb:27017/aws-monitor?authSource=admin
MONGODB_USERNAME=admin
MONGODB_PASSWORD=password123

# Performance Configuration
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
ENVEOF
        print_success ".env file created"
        print_warning "Please update .env file with your AWS credentials before deployment"
    else
        print_success ".env file already exists"
    fi
}

# Function to build images
build_images() {
    print_status "Building Docker images..."
    
    if [ -f "build-images.sh" ]; then
        chmod +x build-images.sh
        ./build-images.sh
    else
        # Fallback build
        print_status "Building backend image..."
        docker build -t aws-monitor-backend:latest backend/
        
        print_status "Building frontend image..."
        docker build -t aws-monitor-frontend:latest frontend/
    fi
    
    print_success "Docker images built successfully"
}

# Function to deploy stack
deploy_stack() {
    print_status "Deploying AWS EC2 Monitor stack..."
    
    # Use the existing deploy script if available
    if [ -f "deploy-stack.sh" ]; then
        chmod +x deploy-stack.sh
        ./deploy-stack.sh
    else
        # Fallback deployment
        docker stack deploy -c docker-stack.yml aws-monitor
    fi
    
    print_success "Stack deployment initiated"
}

# Function to wait for services
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        local ready_services=$(docker stack services aws-monitor --format "table {{.Replicas}}" | grep -c "/" | grep -v "0/" || echo 0)
        local total_services=$(docker stack services aws-monitor --format "table {{.Name}}" | wc -l)
        total_services=$((total_services - 1)) # Subtract header line
        
        if [ $ready_services -eq $total_services ]; then
            print_success "All services are ready"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts: $ready_services/$total_services services ready"
        sleep 10
        attempt=$((attempt + 1))
    done
    
    print_warning "Some services may still be starting. Check with: docker stack services aws-monitor"
}

# Function to display access information
show_access_info() {
    local public_ip=$1
    
    print_success "=== AWS EC2 Monitor Deployment Complete ==="
    echo
    print_status "Access Information:"
    echo -e "  📊 Dashboard: ${GREEN}http://${public_ip}:3000${NC}"
    echo -e "  🔌 API:       ${GREEN}http://${public_ip}:3001${NC}"
    echo -e "  ❤️  Health:    ${GREEN}http://${public_ip}:3001/health${NC}"
    echo
    print_status "Default Login Credentials:"
    echo -e "  👤 Username: ${YELLOW}admin${NC}"
    echo -e "  🔑 Password: ${YELLOW}admin${NC}"
    echo -e "  ⚠️  You'll be prompted to change the password on first login"
    echo
    print_status "Management Commands:"
    echo -e "  📋 Check services: ${BLUE}docker stack services aws-monitor${NC}"
    echo -e "  📊 View logs:      ${BLUE}docker service logs aws-monitor_backend${NC}"
    echo -e "  🔄 Scale service:  ${BLUE}docker service scale aws-monitor_backend=3${NC}"
    echo -e "  🗑️  Remove stack:   ${BLUE}docker stack rm aws-monitor${NC}"
    echo
}

# Main deployment function
main() {
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║              AWS EC2 Monitor Universal Deployer             ║"
    echo "║                     Docker Stack Edition                    ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Detect public IP
    local public_ip=$(detect_public_ip)
    print_success "Detected public IP: $public_ip"
    
    # Run deployment steps
    check_prerequisites
    init_swarm
    create_env_file
    build_images
    deploy_stack
    wait_for_services
    
    # Show access information
    show_access_info $public_ip
    
    print_success "Deployment completed successfully\!"
    print_status "The application is now running with autoscaling capabilities"
}

# Run main function
main "$@"
