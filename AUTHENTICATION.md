# Authentication & User Management

This document describes the authentication and user management system implemented in the AWS EC2 Monitor application.

## Features

### 🔐 Authentication System
- **JWT-based authentication** with configurable expiration
- **Default admin account**: `admin@admin.com` / `admin`
- **Forced password change** on first admin login
- **Password reset** via email with secure tokens
- **Session management** with token validation

### 👥 User Management
- **Role-based access control** with granular permissions
- **Multiple user roles**: Admin, Manager, Operator, Viewer, User
- **Email-based registration** by administrators
- **User profile management**
- **Account activation/deactivation**

### 🛡️ Security Features
- **Bcrypt password hashing** with configurable rounds
- **JWT token verification** for all protected endpoints
- **Permission-based route protection**
- **Secure password reset** with time-limited tokens
- **Input validation** and sanitization

## User Roles & Permissions

### Admin (`admin`)
- **Full access** to all application features
- **Permissions**: `read`, `write`, `admin`, `delete`, `manage_users`, `manage_notifications`, `manage_settings`
- Can create, edit, and delete users
- Can access all monitoring data and settings

### Manager (`manager`)
- **Management access** with notification control
- **Permissions**: `read`, `write`, `manage_notifications`
- Can configure notification settings
- Can view and modify monitoring configurations

### Operator (`operator`)
- **Read-write access** to monitoring features
- **Permissions**: `read`, `write`
- Can view and modify basic settings
- Cannot manage users or advanced configurations

### Viewer (`viewer`)
- **Read-only access** to dashboard and metrics
- **Permissions**: `read`
- Can view all monitoring data
- Cannot modify any settings

### User (`user`)
- **Basic read access**
- **Permissions**: `read`
- Limited to viewing basic dashboard information

## Default Credentials

### Initial Admin Account
- **Email**: `admin@admin.com`
- **Username**: `admin`
- **Password**: `admin`
- **Must change password** on first login

## API Endpoints

### Authentication Endpoints

#### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "identifier": "admin@admin.com",  # Email or username
  "password": "admin"
}
```

**Response:**
```json
{
  "token": "jwt-token-here",
  "user": {
    "id": "user-id",
    "email": "admin@admin.com",
    "username": "admin",
    "firstName": "Administrator",
    "lastName": "User",
    "role": "admin",
    "permissions": ["read", "write", "admin", "delete", "manage_users"],
    "isActive": true,
    "mustChangePassword": true
  },
  "mustChangePassword": true
}
```

#### Register User (Admin Only)
```bash
POST /api/auth/register
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "newuser",
  "password": "secure-password",
  "firstName": "John",
  "lastName": "Doe",
  "role": "operator",
  "permissions": ["read", "write"]
}
```

#### Change Password
```bash
POST /api/auth/change-password
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "currentPassword": "old-password",  # Not required for forced changes
  "newPassword": "new-secure-password"
}
```

#### Forgot Password
```bash
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

#### Reset Password
```bash
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "reset-token-from-email",
  "newPassword": "new-secure-password"
}
```

#### Get Current User
```bash
GET /api/auth/me
Authorization: Bearer <jwt-token>
```

#### Get All Users (Admin Only)
```bash
GET /api/auth/users
Authorization: Bearer <jwt-token>
```

#### Delete User (Admin Only)
```bash
DELETE /api/auth/users/<user-id>
Authorization: Bearer <jwt-token>
```

## Protected API Routes

All monitoring API endpoints now require authentication:

### Read Access Required
- `GET /api/instances` - View EC2 instances
- `GET /api/dashboard` - View dashboard data
- `GET /api/search` - Search instances
- `GET /api/regions` - View region information
- `GET /api/ping/:instanceId` - View ping results
- `GET /api/metrics/:instanceId` - View metrics
- `GET /api/ports/:instanceId` - View port scan results
- `GET /api/notifications/config` - View notification config

### Write Access Required
- `POST /api/regions/refresh` - Refresh region data

### Manage Notifications Permission Required
- `POST /api/notifications/config` - Update notification settings
- `POST /api/notifications/test` - Send test notifications

### Admin Access Required
- `POST /api/cache/clear` - Clear application cache
- `GET /api/cache/stats` - View cache statistics

## Frontend Integration

### Authentication Context
The frontend should implement an authentication context to:
- Store JWT tokens securely
- Handle token expiration
- Redirect to login when unauthorized
- Manage user state globally

### Protected Routes
Implement route protection based on user permissions:
- Redirect unauthenticated users to login
- Show/hide features based on user permissions
- Display appropriate error messages for insufficient permissions

### Login Flow
1. User enters credentials
2. Frontend sends login request
3. Store JWT token securely (localStorage/sessionStorage)
4. Check for `mustChangePassword` flag
5. Redirect to password change if required
6. Set up automatic token refresh

## Environment Variables

Required environment variables for authentication:

```env
# JWT Configuration
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12

# Email Configuration (for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=aws-monitor@yourcompany.com

# Application URL (for password reset links)
APP_URL=http://your-server-ip
```

## Security Best Practices

### Password Requirements
- Minimum 6 characters (configurable)
- Encourage strong passwords with:
  - Mix of uppercase and lowercase letters
  - Numbers and special characters
  - Avoid common passwords

### Token Management
- JWT tokens expire after 24 hours (configurable)
- No server-side token storage (stateless)
- Tokens include user permissions for quick validation

### Password Reset Security
- Reset tokens expire after 1 hour
- Tokens are cryptographically secure (32 bytes)
- One-time use tokens (consumed after use)
- Email verification before reset

### Permission Validation
- Server-side permission validation on all endpoints
- Role-based access control with granular permissions
- Fail-safe defaults (deny by default)

## Deployment Notes

1. **Change default admin password** immediately after first deployment
2. **Configure SMTP settings** for password reset functionality
3. **Use strong JWT secret** in production
4. **Enable HTTPS** for production deployments
5. **Regular security audits** of user accounts and permissions

## Troubleshooting

### Common Issues

#### "Invalid or expired token"
- Check if JWT_SECRET is consistent
- Verify token hasn't expired
- Ensure proper Authorization header format: `Bearer <token>`

#### "Insufficient permissions"
- Check user role and permissions
- Verify endpoint permission requirements
- Contact admin to update user permissions

#### Password reset emails not working
- Verify SMTP configuration in .env file
- Check email provider settings (app passwords for Gmail)
- Ensure FROM_EMAIL is properly configured

#### Cannot create users
- Only admin users can create new users
- Check if requesting user has `manage_users` permission
- Verify all required fields are provided

### Log Analysis
Check backend logs for authentication issues:
```bash
docker service logs aws-monitor_backend --tail 50 | grep -i auth
```