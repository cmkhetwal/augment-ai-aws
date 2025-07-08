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
