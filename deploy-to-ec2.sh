#!/bin/bash

# Deployment script for AWS EC2 Monitor
# This script will connect to the EC2 instance and deploy the latest changes

set -e

# Configuration
EC2_HOST="54.172.68.115"
EC2_USER="ubuntu"
PEM_FILE="devsecops.pem"
REPO_URL="https://github.com/cmkhetwal/augment-ai-aws.git"
APP_DIR="/home/ubuntu/augment-ai-aws"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Create PEM file if it doesn't exist
create_pem_file() {
    if [ ! -f "$PEM_FILE" ]; then
        print_info "Creating PEM file..."
        cat > "$PEM_FILE" << 'EOF'
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA5wRsKSJ+wQW9H/XZ+nA8vJfooj50d+8tvQ4S+Gj2bhUyqmr8
LVVG8AjCIihs3jZoncmYQleGisLfkT1ZrZdBykJEFtiShguZmSjisN5raHgU6+dp
PPLtZ4r/kdKJ2MvIW308DGlwGEhjmv3QBpT8JXXBXOT0xJHpMqjRzVPoNdSy0sGS
TpWv2szLqBfSgwlLCdMq4ZoDuY8YpvjZkvok+7XLAf0fFYv6tKgb3k1J+1/9B66/
IhTJsF5sLTZdnOmqEbGc0oilqPt8qisy1SEdIu/G00DITOAal7ymc8PkLDrGZyBR
TdIGPg/X+PLJKfEEUANp3W1gjS4SmeuKCCrPZQIDAQABAoIBAAJ8MLGsllJ7PlKW
sXaZOH4K4EzGgTg9EW/kM94KOwRqI/ZjWj0emrnATl5RswIc8bkozwN/r4nUmNUW
JN3SL7n+Rn88ay8X9toH75BZhCxGhmsXPTGTp2wiuacW7bawUoJxcXDsvXD1bmTf
cBpyBdhdUOwv5lYq/6g02rTrvya9EscZxQGagCTjf6KnnI2IbukG7WDOx1vnE/2K
fdwKm6oGRwa8gth327vSie2OIwuDhZahaGR+XRrXOvHRAZnJuWzWR+KmpCf0ApF9
o3i7CZZUjg88KJg0EnMhBGnjd8EJtWOi4SsevJ099hPy5AqjZ6hrB9JeNH8jXsD6
Af4ZZiECgYEA/AfS0SUSxVrEu0ZlDTJy1/bz7X2xghFTygAjN69nCqldA5pR0+LD
EJVH9IqvJKwQo4n14RLQN4AQqrDtEUDX/ETf6e3AU/7hLnhWICxKfqfphDYs4X7/
zt0lHxoSoxZmkyr0lb5PI/5TYVVwKVSmnRw90eqCLBt3iDJzuHSB/q0CgYEA6qff
0+ixH7zNaUpec49pn+77aoNxV6ae11LHU0Ln0RrPgDpyb4SYLt5HMF7Z17qWe+6n
beQlIBg3Uf2TOTBgZg+9dwDqKMd0iHmnskxrvwcjKxZH48SOW0UiaCf86cCw0oUP
euzeH5/BEVxZmGDuEB4ZBjFdoxJCvpFQP+01QpkCgYEA0fmOqZLSnbwu1bwjaqhS
SB3GQmILJsta3Jvau4UWOyq5hMvoSrjNPZ6x0UpN+yajwiypvrgW43Z97Ef1av90
MwgK6XGcYB6k6zt0vd9IvVcV1YHxSHmvlGBokg394wRBt3D9T1i7xMgaHai6BqUx
HwotcxuHEkpb/wvRn6bpuw0CgYB88gZsf2pQy+dUORUx0xsa3dVhUbv4P/A0Fw+r
deSZovz5+iUU3DVsP08Ioni8Nc4LD3h3OxPJkxthvPO3b9rkfV0VEJeePxX91UlF
1wtIHDTNrH96+B4U2ysG6sPwc3mznsYvXhCoJhhXdiT+zh301xHcCk0hl4eSkS15
3ISPgQKBgQD5lKQ8EQryHeiySgBQ8vUtYY2Gcef1gChTHBEA4kJIoM+mmCy5VzTh
dw2p3rt5I99dJPeLH8T6Qcegvrr6wekThiMJXxnKJXJ/zqyvLBwqio03M15UOJoy
EnbWe3jqubFuDz+jw7aEvN1uTxCQTTOKLB/5Gg0Qo5LMLd1OgYn86Q==
-----END RSA PRIVATE KEY-----
EOF
        chmod 600 "$PEM_FILE"
        print_status "PEM file created and permissions set"
    fi
}

# Test SSH connection
test_ssh_connection() {
    print_info "Testing SSH connection to EC2 instance..."
    if ssh -i "$PEM_FILE" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "echo 'SSH connection successful'" 2>/dev/null; then
        print_status "SSH connection successful"
        return 0
    else
        print_error "SSH connection failed"
        return 1
    fi
}

# Deploy to EC2
deploy_to_ec2() {
    print_info "Starting deployment to EC2 instance..."
    
    # Create deployment script
    cat > deploy_script.sh << 'DEPLOY_EOF'
#!/bin/bash
set -e

print_status() {
    echo -e "\033[0;32m[INFO]\033[0m $1"
}

print_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

print_info() {
    echo -e "\033[0;34m[INFO]\033[0m $1"
}

cd /home/ubuntu

# Check if directory exists
if [ ! -d "augment-ai-aws" ]; then
    print_info "Cloning repository..."
    git clone https://github.com/cmkhetwal/augment-ai-aws.git
    cd augment-ai-aws
else
    print_info "Updating existing repository..."
    cd augment-ai-aws
    git fetch origin
    git reset --hard origin/main
    git pull origin main
fi

# Create .env file with AWS credentials
print_info "Creating .env file..."
cat > .env << 'ENV_EOF'
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
MONGODB_URI=mongodb://admin:password123@mongodb:27017/aws-monitor?authSource=admin
JWT_SECRET=your-jwt-secret-key-change-in-production
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12
NODE_ENV=production
MAX_INSTANCES=500
MAX_CONCURRENT_REQUESTS=25
REQUEST_DELAY=150
BATCH_SIZE=50
EMAIL_NOTIFICATIONS_ENABLED=false
SLACK_NOTIFICATIONS_ENABLED=false
GOOGLE_CHAT_NOTIFICATIONS_ENABLED=false
FRONTEND_URL=http://54.172.68.115
ENV_EOF

# Stop existing services
print_info "Stopping existing services..."
sudo docker stack rm aws-monitor 2>/dev/null || true
sleep 10

# Build new images
print_info "Building Docker images..."
chmod +x build-images.sh
./build-images.sh

# Deploy stack
print_info "Deploying stack..."
chmod +x deploy-stack.sh
./deploy-stack.sh

# Wait for services to start
print_info "Waiting for services to start..."
sleep 30

# Check service status
print_status "Checking service status..."
sudo docker stack services aws-monitor

print_status "Deployment completed successfully!"
print_info "Application should be available at: http://54.172.68.115"
DEPLOY_EOF

    # Copy and execute deployment script
    scp -i "$PEM_FILE" -o StrictHostKeyChecking=no deploy_script.sh "$EC2_USER@$EC2_HOST:/tmp/"

    # Read AWS credentials from environment or prompt user
    if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
        print_info "AWS credentials not found in environment variables."
        print_info "Please provide AWS credentials:"
        read -p "AWS Access Key ID: " AWS_ACCESS_KEY_ID
        read -s -p "AWS Secret Access Key: " AWS_SECRET_ACCESS_KEY
        echo
    fi

    ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "chmod +x /tmp/deploy_script.sh && AWS_ACCESS_KEY_ID='$AWS_ACCESS_KEY_ID' AWS_SECRET_ACCESS_KEY='$AWS_SECRET_ACCESS_KEY' /tmp/deploy_script.sh"
    
    # Clean up
    rm deploy_script.sh
}

# Main execution
main() {
    print_info "Starting AWS EC2 Monitor deployment process..."
    
    # Create PEM file
    create_pem_file
    
    # Test SSH connection
    if ! test_ssh_connection; then
        print_error "Cannot connect to EC2 instance. Please check:"
        print_error "1. EC2 instance is running"
        print_error "2. Security group allows SSH (port 22)"
        print_error "3. PEM file permissions are correct"
        exit 1
    fi
    
    # Deploy to EC2
    deploy_to_ec2
    
    print_status "Deployment process completed!"
    print_info "You can access the application at: http://$EC2_HOST"
    print_info "API health check: http://$EC2_HOST:3001/health"
}

# Run main function
main "$@"
