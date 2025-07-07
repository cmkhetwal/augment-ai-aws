# AWS EC2 Monitoring Dashboard v1.0

A comprehensive monitoring solution for AWS EC2 instances with real-time updates, multi-region support, and user management.

## 🚀 Features

- **Real-time EC2 instance monitoring** with WebSocket updates
- **Multi-region support** for global AWS infrastructure
- **User authentication and management** with role-based access
- **Responsive dashboard interface** with modern UI
- **Ping monitoring and system metrics** for health checks
- **Port availability checking** for service monitoring
- **Containerized deployment** with Docker support
- **Auto-scaling capabilities** with Docker Swarm/Compose

## 📋 Prerequisites

- **Node.js 18+** and npm
- **Docker & Docker Compose** (for containerized deployment)
- **AWS account** with appropriate permissions
- **MongoDB** (automatically provided in containerized mode)

## 🛠️ Installation Methods

### Method 1: Containerized Deployment (Recommended)

This method uses Docker Compose for easy deployment with all dependencies included.

#### Quick Start
```bash
# Clone the repository
git clone git@github.com:cmkhetwal/augment-ai-aws.git
cd augment-ai-aws

# Build Docker images
chmod +x build-images.sh
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

## 🔐 Default Login Credentials

- **Email**: admin@admin.com
- **Password**: admin

*You'll be prompted to change the password on first login.*

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

# Check deployment status
docker stack services aws-monitor
```

## 🐛 Troubleshooting

### Common Issues

1. **Port 3000 connection refused**
   - Ensure Docker containers are running: `sudo docker-compose ps`
   - Check port mapping: `sudo docker port <container_name>`

2. **AWS credentials not working**
   - Verify credentials in `.env` file
   - Test with: `node test-aws-credentials.js`

3. **MongoDB connection issues**
   - Check MongoDB container: `sudo docker-compose logs mongodb`
   - Verify connection string in environment variables

### Logs and Debugging
```bash
# View all service logs
sudo docker-compose logs -f

# View specific service logs
sudo docker-compose logs -f frontend
sudo docker-compose logs -f backend
sudo docker-compose logs -f mongodb
```

## 📝 Version History

### v1.0 (Current)
- Initial release with full containerization support
- User authentication and management
- Real-time WebSocket monitoring
- Multi-region AWS support
- Docker Compose and Swarm deployment options

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and commit: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/new-feature`
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the logs using the debugging commands
3. Create an issue in the GitHub repository

---

**Made with ❤️ for AWS infrastructure monitoring**