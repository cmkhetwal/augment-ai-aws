#!/bin/bash

# AWS EC2 Monitor - Production Image Builder
# This script builds optimized Docker images for production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGISTRY=${DOCKER_REGISTRY:-""}
TAG=${BUILD_TAG:-"latest"}
BACKEND_IMAGE="aws-monitor-backend"
FRONTEND_IMAGE="aws-monitor-frontend"

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

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    log_success "Docker is running"
}

# Build backend image
build_backend() {
    log_info "Building backend image..."
    
    cd backend
    
    # Build the image
    if [ -n "$REGISTRY" ]; then
        FULL_BACKEND_IMAGE="$REGISTRY/$BACKEND_IMAGE:$TAG"
    else
        FULL_BACKEND_IMAGE="$BACKEND_IMAGE:$TAG"
    fi
    
    docker build \
        --tag "$FULL_BACKEND_IMAGE" \
        --build-arg NODE_ENV=production \
        --no-cache \
        .
    
    log_success "Backend image built: $FULL_BACKEND_IMAGE"
    
    cd ..
}

# Build frontend image
build_frontend() {
    log_info "Building frontend image..."
    
    cd frontend
    
    # Build the image
    if [ -n "$REGISTRY" ]; then
        FULL_FRONTEND_IMAGE="$REGISTRY/$FRONTEND_IMAGE:$TAG"
    else
        FULL_FRONTEND_IMAGE="$FRONTEND_IMAGE:$TAG"
    fi
    
    docker build \
        --tag "$FULL_FRONTEND_IMAGE" \
        --build-arg NODE_ENV=production \
        --no-cache \
        .
    
    log_success "Frontend image built: $FULL_FRONTEND_IMAGE"
    
    cd ..
}

# Push images to registry
push_images() {
    if [ -n "$REGISTRY" ]; then
        log_info "Pushing images to registry..."
        
        docker push "$REGISTRY/$BACKEND_IMAGE:$TAG"
        docker push "$REGISTRY/$FRONTEND_IMAGE:$TAG"
        
        log_success "Images pushed to registry"
    else
        log_warning "No registry specified, skipping push"
    fi
}

# Clean up old images
cleanup() {
    log_info "Cleaning up old images..."
    
    # Remove dangling images
    docker image prune -f
    
    log_success "Cleanup completed"
}

# Show image information
show_images() {
    log_info "Built images:"
    echo ""
    
    if [ -n "$REGISTRY" ]; then
        docker images | grep "$REGISTRY/$BACKEND_IMAGE\|$REGISTRY/$FRONTEND_IMAGE"
    else
        docker images | grep "$BACKEND_IMAGE\|$FRONTEND_IMAGE"
    fi
    
    echo ""
}

# Main execution
main() {
    log_info "Starting AWS EC2 Monitor image build process..."
    log_info "Registry: ${REGISTRY:-'local'}"
    log_info "Tag: $TAG"
    echo ""
    
    check_docker
    build_backend
    build_frontend
    push_images
    cleanup
    show_images
    
    log_success "Build process completed successfully!"
    echo ""
    log_info "To deploy the stack, run: ./deploy-stack.sh"
}

# Help function
show_help() {
    echo "AWS EC2 Monitor - Production Image Builder"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -r, --registry REGISTRY    Docker registry URL (optional)"
    echo "  -t, --tag TAG             Image tag (default: latest)"
    echo "  -h, --help                Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  DOCKER_REGISTRY           Docker registry URL"
    echo "  BUILD_TAG                 Image tag"
    echo ""
    echo "Examples:"
    echo "  $0                        Build images locally"
    echo "  $0 -t v1.0.0             Build with specific tag"
    echo "  $0 -r myregistry.com -t v1.0.0"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        -t|--tag)
            TAG="$2"
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
