#!/bin/bash

# AWS EC2 Monitor - Quick Deployment Script
# One-command deployment for the containerized AWS monitoring application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

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

log_header() {
    echo -e "${PURPLE}[DEPLOY]${NC} $1"
}

# Print banner
print_banner() {
    echo ""
    echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║                 AWS EC2 Monitor - Quick Deploy              ║${NC}"
    echo -e "${PURPLE}║              Containerized with Auto-Scaling                ║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Check prerequisites
check_prerequisites() {
    log_header "Checking Prerequisites"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    # Check required files
    local required_files=("docker-stack.yml" "build-images.sh" "deploy-stack.sh" "manage-stack.sh")
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "Required file not found: $file"
            exit 1
        fi
    done
    
    log_success "All prerequisites met"
}

# Build and deploy
build_and_deploy() {
    log_header "Building Images"
    ./build-images.sh
    
    log_header "Deploying Stack"
    ./deploy-stack.sh
}

# Show final status
show_final_status() {
    log_header "Deployment Complete!"
    
    echo ""
    echo -e "${GREEN}🎉 AWS EC2 Monitor is now running!${NC}"
    echo ""
    echo -e "${BLUE}📊 Application URLs:${NC}"
    echo "   Frontend:     http://localhost:80"
    echo "   Backend API:  http://localhost:3001"
    echo "   Health Check: http://localhost:80/health"
    echo ""
    echo -e "${BLUE}🔧 Management Commands:${NC}"
    echo "   Status:       ./manage-stack.sh status"
    echo "   Scale:        ./manage-stack.sh scale backend 3"
    echo "   Monitor:      ./manage-stack.sh monitor"
    echo "   Logs:         ./manage-stack.sh logs backend"
    echo "   Health:       ./manage-stack.sh health"
    echo ""
    echo -e "${BLUE}🔐 Default Login:${NC}"
    echo "   Username:     admin"
    echo "   Password:     admin"
    echo "   (You'll be prompted to change password on first login)"
    echo ""
    echo -e "${YELLOW}⚠️  Important Notes:${NC}"
    echo "   • AWS credentials are configured from .env file"
    echo "   • Auto-scaling is enabled (1-5 replicas based on CPU usage)"
    echo "   • Health checks monitor service availability"
    echo "   • WebSocket connections enable real-time monitoring"
    echo ""
    echo -e "${BLUE}🛠️  Troubleshooting:${NC}"
    echo "   • Check logs: ./manage-stack.sh logs <service>"
    echo "   • Restart:    docker stack rm aws-monitor && ./deploy-stack.sh"
    echo "   • Scale up:   ./manage-stack.sh scale backend 3"
    echo ""
}

# Test the deployment
test_deployment() {
    log_header "Testing Deployment"
    
    local max_attempts=20
    local attempt=1
    
    log_info "Waiting for services to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:80/health >/dev/null 2>&1 && curl -f http://localhost:3001/health >/dev/null 2>&1; then
            log_success "All services are healthy and responding!"
            break
        fi
        
        log_info "Attempt $attempt/$max_attempts: Waiting for services..."
        sleep 10
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        log_warning "Services may still be starting. Check status with: ./manage-stack.sh status"
    fi
}

# Main execution
main() {
    print_banner
    
    log_info "Starting quick deployment of AWS EC2 Monitor..."
    echo ""
    
    check_prerequisites
    build_and_deploy
    test_deployment
    show_final_status
    
    # Ask if user wants to open the application
    echo ""
    read -p "Would you like to open the application in your browser? (y/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if command -v xdg-open &> /dev/null; then
            xdg-open http://localhost:80
        elif command -v open &> /dev/null; then
            open http://localhost:80
        else
            log_info "Please open http://localhost:80 in your browser"
        fi
    fi
    
    echo ""
    log_success "Quick deployment completed successfully! 🚀"
}

# Help function
show_help() {
    echo "AWS EC2 Monitor - Quick Deployment"
    echo ""
    echo "This script performs a complete deployment of the AWS monitoring application"
    echo "including building Docker images, deploying the stack, and testing the deployment."
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help    Show this help message"
    echo ""
    echo "What this script does:"
    echo "  1. Checks prerequisites (Docker, required files)"
    echo "  2. Builds optimized Docker images"
    echo "  3. Deploys the stack with auto-scaling"
    echo "  4. Tests the deployment"
    echo "  5. Shows management commands"
    echo ""
    echo "Requirements:"
    echo "  • Docker installed and running"
    echo "  • AWS credentials configured in .env file"
    echo "  • All deployment scripts present"
    echo ""
}

# Parse command line arguments
case "${1:-deploy}" in
    -h|--help|help)
        show_help
        exit 0
        ;;
    deploy|"")
        main
        ;;
    *)
        log_error "Unknown option: $1"
        show_help
        exit 1
        ;;
esac
