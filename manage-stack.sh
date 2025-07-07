#!/bin/bash

# AWS EC2 Monitor - Stack Management Script
# This script provides management utilities for the Docker stack including auto-scaling

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STACK_NAME=${STACK_NAME:-"aws-monitor"}
ENV_FILE=${ENV_FILE:-".env"}

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

# Load environment variables
load_env() {
    if [ -f "$ENV_FILE" ]; then
        export $(grep -v '^#' "$ENV_FILE" | xargs)
    fi
}

# Show stack status
show_status() {
    log_info "Stack Status: $STACK_NAME"
    echo ""
    
    echo "Services:"
    docker service ls --filter "label=com.docker.stack.namespace=$STACK_NAME" --format "table {{.Name}}\t{{.Mode}}\t{{.Replicas}}\t{{.Image}}\t{{.Ports}}"
    echo ""
    
    echo "Tasks:"
    docker stack ps "$STACK_NAME" --format "table {{.Name}}\t{{.Node}}\t{{.DesiredState}}\t{{.CurrentState}}\t{{.Error}}"
    echo ""
    
    echo "Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}" $(docker ps --filter "label=com.docker.stack.namespace=$STACK_NAME" -q) 2>/dev/null || echo "No running containers found"
}

# Scale services
scale_service() {
    local service_name="$1"
    local replicas="$2"
    
    if [ -z "$service_name" ] || [ -z "$replicas" ]; then
        log_error "Usage: scale_service <service_name> <replicas>"
        return 1
    fi
    
    local full_service_name="${STACK_NAME}_${service_name}"
    
    log_info "Scaling $full_service_name to $replicas replicas..."
    docker service scale "$full_service_name=$replicas"
    log_success "Service scaled successfully"
}

# Auto-scale based on CPU usage
auto_scale() {
    load_env
    
    local cpu_threshold=${AUTO_SCALE_CPU_THRESHOLD:-70}
    local min_replicas=${AUTO_SCALE_MIN_REPLICAS:-1}
    local max_replicas=${AUTO_SCALE_MAX_REPLICAS:-5}
    
    log_info "Auto-scaling check (CPU threshold: ${cpu_threshold}%, Min: $min_replicas, Max: $max_replicas)"
    
    # Check backend service
    local backend_service="${STACK_NAME}_backend"
    local backend_cpu=$(docker stats --no-stream --format "{{.CPUPerc}}" $(docker ps --filter "label=com.docker.swarm.service.name=$backend_service" -q) 2>/dev/null | sed 's/%//' | awk '{sum+=$1} END {print sum/NR}' || echo "0")
    local current_replicas=$(docker service ls --filter "name=$backend_service" --format "{{.Replicas}}" | cut -d'/' -f1)
    
    if [ -z "$backend_cpu" ] || [ "$backend_cpu" = "0" ]; then
        log_warning "Could not get CPU usage for backend service"
        return
    fi
    
    log_info "Backend CPU usage: ${backend_cpu}%, Current replicas: $current_replicas"
    
    # Scale up if CPU is high and we're below max replicas
    if (( $(echo "$backend_cpu > $cpu_threshold" | bc -l) )) && [ "$current_replicas" -lt "$max_replicas" ]; then
        local new_replicas=$((current_replicas + 1))
        log_warning "High CPU usage detected. Scaling up to $new_replicas replicas"
        scale_service "backend" "$new_replicas"
    # Scale down if CPU is low and we're above min replicas
    elif (( $(echo "$backend_cpu < $(($cpu_threshold - 20))" | bc -l) )) && [ "$current_replicas" -gt "$min_replicas" ]; then
        local new_replicas=$((current_replicas - 1))
        log_info "Low CPU usage detected. Scaling down to $new_replicas replicas"
        scale_service "backend" "$new_replicas"
    else
        log_info "No scaling action needed"
    fi
}

# Monitor and auto-scale continuously
monitor() {
    local interval=${1:-60}
    
    log_info "Starting continuous monitoring (interval: ${interval}s)"
    log_info "Press Ctrl+C to stop"
    
    while true; do
        echo ""
        echo "=== $(date) ==="
        auto_scale
        sleep "$interval"
    done
}

# Update stack
update_stack() {
    log_info "Updating stack: $STACK_NAME"
    
    load_env
    env $(cat "$ENV_FILE" | grep -v '^#' | xargs) \
        docker stack deploy \
        --compose-file "docker-stack.yml" \
        --with-registry-auth \
        "$STACK_NAME"
    
    log_success "Stack updated"
}

# Remove stack
remove_stack() {
    log_warning "This will remove the entire stack: $STACK_NAME"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Removing stack: $STACK_NAME"
        docker stack rm "$STACK_NAME"
        log_success "Stack removed"
    else
        log_info "Operation cancelled"
    fi
}

# Show logs
show_logs() {
    local service_name="$1"
    local lines="${2:-100}"
    
    if [ -z "$service_name" ]; then
        log_error "Usage: show_logs <service_name> [lines]"
        log_info "Available services:"
        docker service ls --filter "label=com.docker.stack.namespace=$STACK_NAME" --format "  {{.Name}}"
        return 1
    fi
    
    local full_service_name="${STACK_NAME}_${service_name}"
    
    log_info "Showing logs for $full_service_name (last $lines lines)"
    docker service logs --tail "$lines" --follow "$full_service_name"
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    local frontend_health=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80/health 2>/dev/null || echo "000")
    local backend_health=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null || echo "000")
    
    if [ "$frontend_health" = "200" ]; then
        log_success "Frontend health check: OK"
    else
        log_error "Frontend health check: FAILED (HTTP $frontend_health)"
    fi
    
    if [ "$backend_health" = "200" ]; then
        log_success "Backend health check: OK"
    else
        log_error "Backend health check: FAILED (HTTP $backend_health)"
    fi
    
    # Check service health
    echo ""
    log_info "Service Health:"
    docker service ls --filter "label=com.docker.stack.namespace=$STACK_NAME" --format "{{.Name}}: {{.Replicas}}"
}

# Show help
show_help() {
    echo "AWS EC2 Monitor - Stack Management"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  status                    Show stack status and resource usage"
    echo "  scale <service> <count>   Scale a service to specified replica count"
    echo "  auto-scale               Perform one-time auto-scaling check"
    echo "  monitor [interval]       Continuous monitoring and auto-scaling (default: 60s)"
    echo "  update                   Update the stack with latest configuration"
    echo "  remove                   Remove the entire stack"
    echo "  logs <service> [lines]   Show logs for a service (default: 100 lines)"
    echo "  health                   Perform health check"
    echo "  help                     Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 status                Show current status"
    echo "  $0 scale backend 3       Scale backend to 3 replicas"
    echo "  $0 monitor 30            Monitor with 30-second intervals"
    echo "  $0 logs backend 50       Show last 50 lines of backend logs"
    echo ""
    echo "Environment Variables:"
    echo "  STACK_NAME               Stack name (default: aws-monitor)"
    echo "  ENV_FILE                 Environment file (default: .env)"
    echo "  AUTO_SCALE_CPU_THRESHOLD CPU threshold for scaling (default: 70)"
    echo "  AUTO_SCALE_MIN_REPLICAS  Minimum replicas (default: 1)"
    echo "  AUTO_SCALE_MAX_REPLICAS  Maximum replicas (default: 5)"
}

# Main execution
case "${1:-help}" in
    status)
        show_status
        ;;
    scale)
        scale_service "$2" "$3"
        ;;
    auto-scale)
        auto_scale
        ;;
    monitor)
        monitor "$2"
        ;;
    update)
        update_stack
        ;;
    remove)
        remove_stack
        ;;
    logs)
        show_logs "$2" "$3"
        ;;
    health)
        health_check
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
