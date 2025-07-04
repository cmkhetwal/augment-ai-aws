# AWS EC2 Monitor - Complete Deployment Guide

This guide covers the complete deployment process for the AWS EC2 Monitor application with authentication, dynamic IP handling, and portable deployment.

## 🚀 Quick Deployment

### One-Command Deployment
```bash
# Make the script executable
chmod +x monitoringapp.sh

# Run the complete deployment script
./monitoringapp.sh
```

The script will:
- ✅ Check and install system requirements (Docker, Git)
- ✅ Interactively prompt for AWS credentials and email configuration
- ✅ Test AWS connectivity
- ✅ Download/update application code from GitHub
- ✅ Apply all portability fixes for dynamic IP support
- ✅ Build and deploy Docker containers
- ✅ Set up IP change monitoring service
- ✅ Configure authentication with default admin account
- ✅ Perform health checks and verification

## 📋 Prerequisites

### System Requirements
- **Operating System**: Ubuntu/Debian Linux (recommended)
- **Memory**: Minimum 2GB RAM, 4GB+ recommended
- **Storage**: Minimum 10GB free space
- **Network**: Internet access for Docker pulls and AWS API calls

### AWS Requirements
- **AWS Account** with active EC2 instances
- **IAM User** with following permissions:
  - `ec2:DescribeInstances`
  - `ec2:DescribeRegions`
  - `cloudwatch:GetMetricStatistics`
  - `ssm:SendCommand` (optional, for enhanced metrics)
  - `ssm:DescribeInstanceInformation`

### Email Configuration (Optional)
- **SMTP Server** access for password reset emails
- **Gmail App Password** if using Gmail SMTP

## 🛠️ Step-by-Step Manual Deployment

### Step 1: System Preparation
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y git curl docker.io

# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
```

### Step 2: Download Application
```bash
# Clone the repository
git clone https://github.com/cmkhetwal/aws-monitoring-app.git
cd aws-monitoring-app

# Or if already cloned, update
git pull origin main
```

### Step 3: Configure Environment
```bash
# Run the automated deployment script
./monitoringapp.sh
```

**During deployment, you'll be prompted for:**

#### AWS Credentials
- AWS Access Key ID
- AWS Secret Access Key  
- Default AWS Region (e.g., us-east-1)

#### Email Configuration
- SMTP Host (e.g., smtp.gmail.com)
- SMTP Port (default: 587)
- SMTP Username (your email)
- SMTP Password (app password for Gmail)
- From Email Address

## 🌐 Portability Features

### Dynamic IP Handling
The application automatically handles IP changes through:

#### 1. Dynamic WebSocket URLs
- WebSocket connections use `window.location.host` instead of hardcoded IPs
- Automatically adapts to current server IP
- Works with domain names and IP addresses

#### 2. Automatic IP Detection
- Multiple fallback methods for IP detection:
  - AWS EC2 metadata service (for EC2 instances)
  - External IP detection services
  - Local network interface detection

#### 3. IP Change Monitoring Service
- Runs every 5 minutes via systemd timer
- Automatically detects IP changes
- Updates application configuration
- Restarts services when needed

#### 4. Manual IP Check
```bash
# Check current IP manually
./ip-monitor.sh

# View IP monitoring service status
sudo systemctl status aws-monitor-ip.timer
```

### Deployment Scenarios

#### Scenario 1: EC2 Instance without Elastic IP
- ✅ **Automatic handling**: IP changes detected via metadata service
- ✅ **Zero downtime**: Services updated automatically
- ✅ **WebSocket reconnection**: Dashboard reconnects seamlessly

#### Scenario 2: On-Premises Server
- ✅ **External IP detection**: Uses multiple IP detection services
- ✅ **Network change handling**: Adapts to network configuration changes
- ✅ **Manual override**: Can manually update IP if needed

#### Scenario 3: Docker Container Migration
- ✅ **Container portability**: Application adapts to new host environment
- ✅ **Configuration persistence**: Settings maintained across migrations
- ✅ **Service discovery**: Components find each other automatically

## 🔐 Authentication Setup

### Default Admin Account
- **Email**: `admin@admin.com`
- **Username**: `admin`  
- **Password**: `admin`
- **⚠️ IMPORTANT**: Must change password on first login

### First Login Process
1. Access dashboard at `http://your-server-ip`
2. Click "Login" and use admin credentials
3. System will prompt for password change
4. Set a strong new password
5. Login with new credentials

### Creating Additional Users
1. Login as admin
2. Navigate to "User Management" (admin menu)
3. Click "Add New User"
4. Configure user details and permissions:
   - **Admin**: Full access, can manage users
   - **Manager**: Management access, can configure notifications
   - **Operator**: Read-write access to monitoring
   - **Viewer**: Read-only access to dashboard
   - **User**: Basic read access

## 📊 Access Points

After successful deployment:

### Dashboard Access
- **URL**: `http://your-server-ip`
- **Login Required**: Yes (admin/admin initially)

### API Access
- **Base URL**: `http://your-server-ip:3001`
- **Health Check**: `http://your-server-ip:3001/health`
- **Authentication**: JWT token required for most endpoints

### WebSocket Connection
- **URL**: `ws://your-server-ip/ws` (automatic)
- **Authentication**: Token-based
- **Features**: Real-time updates, connection monitoring

## 🔧 Management Commands

### Service Management
```bash
# View all services
docker stack services aws-monitor

# View service details
docker stack ps aws-monitor

# View logs
docker service logs aws-monitor_backend --tail 50
docker service logs aws-monitor_frontend --tail 50
docker service logs aws-monitor_nginx-proxy --tail 50

# Scale services
docker service scale aws-monitor_backend=3
docker service scale aws-monitor_frontend=2

# Update services
docker service update --force aws-monitor_backend
```

### Application Management
```bash
# Stop application
docker stack rm aws-monitor

# Restart application
./monitoringapp.sh

# Clear cache (requires admin access)
curl -X POST http://localhost:3001/api/cache/clear \
  -H "Authorization: Bearer <your-jwt-token>"

# Check cache stats
curl http://localhost:3001/api/cache/stats \
  -H "Authorization: Bearer <your-jwt-token>"
```

### IP Monitoring Management
```bash
# Check IP monitoring status
sudo systemctl status aws-monitor-ip.timer

# View IP monitoring logs
sudo journalctl -u aws-monitor-ip.service -f

# Manually run IP check
./ip-monitor.sh

# Stop/start IP monitoring
sudo systemctl stop aws-monitor-ip.timer
sudo systemctl start aws-monitor-ip.timer
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Services Not Starting
```bash
# Check Docker Swarm status
docker info | grep Swarm

# Reinitialize if needed
docker swarm init --force

# Check resource usage
docker system df
docker system prune -f  # If space is low
```

#### 2. Authentication Issues
```bash
# Check if default admin was created
docker service logs aws-monitor_backend | grep -i admin

# Reset to defaults (removes all users)
docker service update --force aws-monitor_backend

# Check JWT configuration
docker service logs aws-monitor_backend | grep -i jwt
```

#### 3. WebSocket Connection Issues
```bash
# Check nginx configuration
docker service logs aws-monitor_nginx-proxy --tail 20

# Test WebSocket endpoint
curl -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost/ws

# Check frontend logs
docker service logs aws-monitor_frontend --tail 20
```

#### 4. IP Detection Issues
```bash
# Test IP detection methods
curl -s http://169.254.169.254/latest/meta-data/public-ipv4  # EC2
curl -s http://checkip.amazonaws.com  # External
curl -s https://ipinfo.io/ip  # External backup

# Check IP monitoring logs
sudo journalctl -u aws-monitor-ip.service --since "1 hour ago"
```

#### 5. Email Configuration Issues
```bash
# Test SMTP configuration
docker service logs aws-monitor_backend | grep -i smtp

# Check environment variables
docker service inspect aws-monitor_backend | grep -A 20 Env
```

### Health Checks

#### Backend Health
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-07-04T12:00:00.000Z",
  "uptime": 3600,
  "memory": {...},
  "aws": "connected"
}
```

#### Frontend Health
```bash
curl -I http://localhost
```

Expected: `HTTP/1.1 200 OK`

#### WebSocket Health
```bash
# Test WebSocket upgrade
curl -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost/ws
```

Expected: `HTTP/1.1 101 Switching Protocols`

## 🔄 Updates and Maintenance

### Updating the Application
```bash
# Pull latest changes
git pull origin main

# Rebuild and redeploy
./monitoringapp.sh
```

### Backup and Recovery
```bash
# Backup user data (manual process since using in-memory storage)
# Consider implementing persistent storage for production use

# Backup configuration
cp .env .env.backup
docker config ls  # List Docker configs
```

### Performance Monitoring
```bash
# Monitor resource usage
docker stats

# Monitor application metrics
curl http://localhost:3001/api/cache/stats \
  -H "Authorization: Bearer <admin-token>"

# Check system resources
htop
df -h
```

## 🚀 Production Deployment Recommendations

### Security Hardening
1. **Change default admin password** immediately
2. **Use HTTPS** with SSL certificates
3. **Configure firewall** to limit access
4. **Regular security updates**
5. **Monitor access logs**

### Performance Optimization
1. **Use Elastic IP** for stable addressing
2. **Configure auto-scaling** for high availability
3. **Set up monitoring alerts**
4. **Regular backup strategy**
5. **Load balancing** for multiple instances

### Monitoring and Alerts
1. **Set up CloudWatch alarms**
2. **Configure notification channels**
3. **Monitor application logs**
4. **Track resource usage**
5. **Set up uptime monitoring**

## 📞 Support

### Getting Help
- **Documentation**: Check README.md and AUTHENTICATION.md
- **Logs**: Always include relevant logs when reporting issues
- **GitHub Issues**: Report bugs and request features
- **Community**: Share deployment experiences

### Log Collection
```bash
# Collect all relevant logs
mkdir -p debug-logs
docker service logs aws-monitor_backend > debug-logs/backend.log
docker service logs aws-monitor_frontend > debug-logs/frontend.log
docker service logs aws-monitor_nginx-proxy > debug-logs/nginx.log
sudo journalctl -u aws-monitor-ip.service > debug-logs/ip-monitor.log
docker stack ps aws-monitor > debug-logs/services.log
```