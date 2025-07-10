# AWS EC2 Monitor

A comprehensive multi-region AWS EC2 monitoring application with real-time dashboards, instance management, and alerting capabilities.

## Quick Start

### 1. Configure Environment
```bash
# Copy environment template
cp .env.template .env

# Edit with your AWS credentials
nano .env
```

### 2. Deploy
```bash
# Build and deploy
./build-images.sh

# Start the application
sudo docker-compose up -d

# Check status
sudo docker-compose ps
```

#### Access the Application
- **Dashboard**: http://localhost:3000
- **API**: http://localhost:3001
- **MongoDB**: localhost:27017

#### Container Management
```bash
# View logs
sudo docker-compose logs -f

# Stop the application
sudo docker-compose down

# Restart services
sudo docker-compose restart

# Update and rebuild
sudo docker-compose down
./build-images.sh
sudo docker-compose up -d
```

### Method 2: Traditional npm Development

This method runs the application directly with Node.js for development.

#### Setup
```bash
# Clone the repository
git clone git@github.com:cmkhetwal/augment-ai-aws.git
cd augment-ai-aws

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

#### Configuration
Create a `.env` file in the backend directory:
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
MONGODB_URI=mongodb://localhost:27017/aws-monitor
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12
NODE_ENV=development
```

#### Running the Application
```bash
# Terminal 1: Start MongoDB (if not using Docker)
mongod

# Terminal 2: Start backend server
cd backend
npm run dev

# Terminal 3: Start frontend development server
cd frontend
npm start
```

#### Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## 🔐 Authentication

### Default Login Credentials

- **Email**: admin@admin.com
- **Password**: admin

*You'll be prompted to change the password on first login.*

### SAML Authentication (SSO)

The application supports SAML authentication for enterprise SSO integration:

- **📖 Complete Setup Guide**: [SAML-AUTHENTIK-SETUP.md](./SAML-AUTHENTIK-SETUP.md)
- **⚡ Quick Setup**: [SAML-QUICK-SETUP.md](./SAML-QUICK-SETUP.md)

**Supported Identity Providers:**
- Authentik (Tested)
- Azure AD / Entra ID
- Okta
- ADFS
- Any SAML 2.0 compliant provider

**Key Features:**
- Automatic user provisioning
- Role-based access control
- Group mapping from IdP
- Single Sign-On (SSO)
- Single Logout (SLO)

## 🏗️ Architecture

### Services Overview
- **Frontend**: React.js application with nginx (Port 3000)
- **Backend**: Node.js Express API server (Port 3001)
- **Database**: MongoDB 7.0 (Port 27017)
- **WebSocket**: Real-time updates for live monitoring

### Docker Services
```yaml
services:
  mongodb:     # Database service
  backend:     # API and WebSocket server
  frontend:    # React app with nginx
```

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/change-password` - Change password

### EC2 Monitoring
- `GET /api/instances` - Get all EC2 instances
- `GET /api/instances/:region` - Get instances by region
- `GET /api/regions` - Get available AWS regions

### User Management
- `GET /api/users` - Get all users (admin only)
- `POST /api/users` - Create new user (admin only)
- `PUT /api/users/:id` - Update user (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

## 🔌 WebSocket Events

- `instanceUpdate` - Real-time instance status updates
- `connect` - Client connection established
- `disconnect` - Client disconnection
- `error` - Error notifications

## 🔧 Configuration

### AWS Permissions Required
Your AWS IAM user needs the following permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:DescribeInstanceStatus",
        "ec2:DescribeRegions",
        "ec2:DescribeAvailabilityZones"
      ],
      "Resource": "*"
    }
  ]
}
```

### Environment Variables
```env
# AWS Configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1

# Database
MONGODB_URI=mongodb://admin:password123@mongodb:27017/aws-monitor?authSource=admin

# Security
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12

# Application
NODE_ENV=production
MAX_INSTANCES=500
MAX_CONCURRENT_REQUESTS=25
REQUEST_DELAY=150
BATCH_SIZE=50
```

## 🚀 Deployment Scripts

### Available Scripts
- `build-images.sh` - Build Docker images for frontend and backend
- `deploy-stack.sh` - Deploy using Docker Swarm
- `manage-stack.sh` - Manage Docker Swarm stack
- `quick-deploy.sh` - Quick deployment script

### Production Deployment
```bash
# For production deployment with Docker Swarm
chmod +x deploy-stack.sh
./deploy-stack.sh
```

### 3. Access
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Default login: admin@admin.com / vmware@123

## Deployment Options

### Option 1: Direct Access
Access via server IP: http://YOUR_SERVER_IP:3000

### Option 2: Reverse Proxy (Recommended)
Configure nginx/apache to proxy requests to localhost:3000 and localhost:3001

### Option 3: Custom Domain with SSL
Use Let's Encrypt for HTTPS with custom domains

## Management
```bash
# View services
docker service ls

# Scale services  
docker service scale aws-monitor_backend=3

# View logs
docker service logs aws-monitor_backend

# Remove stack
docker stack rm aws-monitor
```

## Environment Variables
- AWS_REGION: Primary AWS region
- AWS_ACCESS_KEY_ID: Required
- AWS_SECRET_ACCESS_KEY: Required
- JWT_SECRET: Required for security

See .env.template for all options.
