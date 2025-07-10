#\!/bin/bash

# AWS EC2 Monitor - Docker Stack Deployment Script
# This script deploys the AWS monitoring application using Docker Swarm

set -e

# Colors for output
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
BLUE="\033[0;34m"
NC="\033[0m" # No Color

# Configuration
STACK_NAME=${STACK_NAME:-"aws-monitor"}
ENV_FILE=${ENV_FILE:-".env"}
COMPOSE_FILE=${COMPOSE_FILE:-"docker-stack.yml"}

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker Swarm is initialized
check_swarm() {
    if \! docker info --format "{{.Swarm.LocalNodeState}}" | grep -q "active"; then
        log_warning "Docker Swarm is not initialized. Initializing now..."
        docker swarm init
        log_success "Docker Swarm initialized"
    else
        log_success "Docker Swarm is active"
    fi
}

# Check if environment file exists
check_env_file() {
    if [ \! -f "$ENV_FILE" ]; then
        log_warning "Environment file $ENV_FILE not found."
        if [ -f ".env.template" ]; then
            log_info "Creating $ENV_FILE from template..."
            cp .env.template "$ENV_FILE"
            log_warning "Please edit $ENV_FILE with your AWS credentials and configuration"
            log_warning "Required variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION"
            read -p "Press Enter after updating the environment file..."
        else
            log_error "No .env.template file found. Please create $ENV_FILE manually."
            exit 1
        fi
    fi
    log_success "Environment file found: $ENV_FILE"
}

# Load environment variables
load_env() {
    log_info "Loading environment variables from $ENV_FILE"
    export $(grep -v "^#" "$ENV_FILE" | xargs)
    
    # Validate required variables
    if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
        log_error "AWS credentials not found in environment file"
        log_error "Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in $ENV_FILE"
        exit 1
    fi
    
    log_success "Environment variables loaded"
}

# Build images if they do not exist
build_images() {
    log_info "Checking if images exist..."
    
    if \! docker image inspect aws-monitor-backend:latest >/dev/null 2>&1; then
        log_warning "Backend image not found. Building..."
        ./build-images.sh
    fi
    
    if \! docker image inspect aws-monitor-frontend:latest >/dev/null 2>&1; then
        log_warning "Frontend image not found. Building..."
        ./build-images.sh
    fi
    
    log_success "Images are ready"
}

# Deploy the stack
deploy_stack() {
    log_info "Deploying stack: $STACK_NAME"

    # Export environment variables properly
    set -a
    source "$ENV_FILE"
    set +a

    # Deploy with environment variables
    docker stack deploy \
        --compose-file "$COMPOSE_FILE" \
        --with-registry-auth \
        "$STACK_NAME"

    log_success "Stack deployed: $STACK_NAME"
}

# Wait for services to be ready
wait_for_services() {
    log_info "Waiting for services to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        local ready_services=$(docker service ls --filter "label=com.docker.stack.namespace=$STACK_NAME" --format "{{.Replicas}}" | grep -c "1/1\|2/2\|3/3" || true)
        local total_services=$(docker service ls --filter "label=com.docker.stack.namespace=$STACK_NAME" --quiet | wc -l)
        
        if [ "$ready_services" -eq "$total_services" ] && [ "$total_services" -gt 0 ]; then
            log_success "All services are ready\!"
            break
        fi
        
        log_info "Attempt $attempt/$max_attempts: $ready_services/$total_services services ready"
        sleep 10
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        log_warning "Some services may not be ready yet. Check with: docker service ls"
    fi
}

# Show deployment status
show_status() {
    log_info "Deployment Status:"
    echo ""
    
    echo "Services:"
    docker service ls --filter "label=com.docker.stack.namespace=$STACK_NAME"
    echo ""
    
    echo "Stack Info:"
    docker stack ps "$STACK_NAME"
    echo ""
    
    log_info "Application Access:"
    echo "  Frontend: http://localhost:3000 (or via reverse proxy)"
    echo "  Backend API: http://localhost:3001"
    echo "  MongoDB: localhost:27017"
    echo ""
    
    log_info "Note: If using a reverse proxy (nginx/apache), configure it to:"
    echo "  - Route / to http://localhost:3000 (frontend)"
    echo "  - Route /api/* to http://localhost:3001 (backend API)"
    echo "  - Route /ws to http://localhost:3001 (WebSocket)"
}

# Test deployment
test_deployment() {
    log_info "Testing deployment..."
    
    # Test health endpoints
    local max_attempts=10
    local attempt=1
    
    # Test frontend
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000 >/dev/null 2>&1; then
            log_success "Frontend is responding"
            break
        fi
        
        log_info "Attempt $attempt/$max_attempts: Waiting for frontend..."
        sleep 5
        attempt=$((attempt + 1))
    done
    
    # Test backend
    attempt=1
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3001/api/health >/dev/null 2>&1; then
            log_success "Backend API is responding"
            break
        fi
        
        log_info "Attempt $attempt/$max_attempts: Waiting for backend..."
        sleep 5
        attempt=$((attempt + 1))
    done
    
    log_success "Deployment test completed"
}

# Main execution
main() {
    log_info "Starting AWS EC2 Monitor deployment..."
    log_info "Stack: $STACK_NAME"
    log_info "Environment: $ENV_FILE"
    log_info "Compose file: $COMPOSE_FILE"
    echo ""
    
    check_swarm
    check_env_file
    load_env
    build_images
    deploy_stack
    wait_for_services
    show_status
    test_deployment
    
    log_success "Deployment completed successfully\!"
    echo ""
    log_info "Management Commands:"
    log_info "  Scale services: docker service scale ${STACK_NAME}_backend=3"
    log_info "  Update stack: docker stack deploy -c $COMPOSE_FILE $STACK_NAME"
    log_info "  Remove stack: docker stack rm $STACK_NAME"
    log_info "  View logs: docker service logs ${STACK_NAME}_backend"
}

# Help function
show_help() {
    echo "AWS EC2 Monitor - Docker Stack Deployment"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -s, --stack-name NAME     Stack name (default: aws-monitor)"
    echo "  -e, --env-file FILE       Environment file (default: .env)"
    echo "  -f, --compose-file FILE   Compose file (default: docker-stack.yml)"
    echo "  -h, --help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                        Deploy with defaults"
    echo "  $0 -s my-monitor         Deploy with custom stack name"
    echo "  $0 -e production.env     Deploy with production environment"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        -e|--env-file)
            ENV_FILE="$2"
            shift 2
            ;;
        -f|--compose-file)
            COMPOSE_FILE="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main
