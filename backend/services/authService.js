const jwt = require('jsonwebtoken');
const User = require('../models/UserMongoModel');
const nodemailer = require('nodemailer');

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-default-secret-key';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.setupEmailTransporter();
  }

  // Setup email transporter for password reset
  setupEmailTransporter() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      console.warn('Email configuration not found. Password reset emails will not work.');
    }
  }

  // Generate JWT token
  generateToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      permissions: user.permissions,
      mustChangePassword: user.mustChangePassword
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Login user
  async login(identifier, password) {
    const user = await User.verifyPassword(identifier, password);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    const token = this.generateToken(user);

    return {
      token,
      user,
      mustChangePassword: user.mustChangePassword
    };
  }

  // Register new user (admin only)
  async register(userData, adminUser) {
    // Check if admin has permission to manage users
    if (!adminUser.permissions.includes('manage_users')) {
      throw new Error('Insufficient permissions to create users');
    }

    // Validate required fields
    const { email, username, password, firstName, lastName, role, permissions } = userData;

    if (!email || !username || !password || !firstName || !lastName) {
      throw new Error('All required fields must be provided');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Validate password strength
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Create user
    const newUser = await User.create({
      email,
      username,
      password,
      firstName,
      lastName,
      role: role || 'user',
      permissions: permissions || ['read']
    });

    return newUser;
  }

  // Change password
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // For first-time password change (admin), skip current password validation
    if (!user.mustChangePassword) {
      const validUser = await User.verifyPassword(user.email, currentPassword);
      if (!validUser) {
        throw new Error('Current password is incorrect');
      }
    }

    // Validate new password strength
    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long');
    }

    await User.updatePassword(userId, newPassword);

    // Generate new token with updated user info
    const updatedUser = await User.findById(userId);
    const token = this.generateToken(updatedUser);

    return {
      token,
      user: updatedUser,
      message: 'Password changed successfully'
    };
  }

  // Request password reset
  async requestPasswordReset(email) {
    const user = await User.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists or not
      return { message: 'If an account with this email exists, a reset link has been sent.' };
    }

    const resetToken = User.generateResetToken(email);
    
    // Send reset email if transporter is configured
    if (this.emailTransporter) {
      try {
        const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
        
        await this.emailTransporter.sendMail({
          from: process.env.FROM_EMAIL,
          to: email,
          subject: 'AWS Monitor - Password Reset',
          html: `
            <h2>Password Reset Request</h2>
            <p>Hello ${user.firstName},</p>
            <p>You have requested to reset your password for AWS Monitor.</p>
            <p>Click the link below to reset your password:</p>
            <p><a href="${resetUrl}">Reset Password</a></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <br>
            <p>Best regards,<br>AWS Monitor Team</p>
          `
        });
      } catch (error) {
        console.error('Error sending password reset email:', error);
      }
    }

    return { message: 'If an account with this email exists, a reset link has been sent.' };
  }

  // Reset password with token
  async resetPassword(token, newPassword) {
    const tokenData = User.useResetToken(token);
    if (!tokenData) {
      throw new Error('Invalid or expired reset token');
    }

    // Validate new password strength
    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    await User.updatePassword(tokenData.email, newPassword);

    return { message: 'Password reset successfully' };
  }

  // Get current user info
  async getCurrentUser(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  // Update user profile
  async updateProfile(userId, updateData, requestingUser) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check permissions
    if (userId !== requestingUser.id && !User.hasPermission(requestingUser, 'manage_users')) {
      throw new Error('Insufficient permissions to update user profile');
    }

    // Only allow certain fields for non-admin users
    if (!User.hasPermission(requestingUser, 'manage_users')) {
      const allowedFields = { firstName: updateData.firstName, lastName: updateData.lastName };
      updateData = allowedFields;
    }

    const updatedUser = await User.updateProfile(user.email, updateData);
    return updatedUser;
  }

  // Get all users (admin only)
  async getAllUsers(requestingUser) {
    if (!requestingUser.permissions.includes('manage_users')) {
      throw new Error('Insufficient permissions to view users');
    }

    return await User.findAll();
  }

  // Delete user (admin only)
  async deleteUser(userId, requestingUser) {
    if (!requestingUser.permissions.includes('manage_users')) {
      throw new Error('Insufficient permissions to delete users');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Prevent deleting the requesting admin user
    if (userId === requestingUser.id) {
      throw new Error('Cannot delete your own account');
    }

    const deleted = await User.delete(userId);
    return { success: deleted, message: deleted ? 'User deleted successfully' : 'Failed to delete user' };
  }

  // Get user roles and permissions (admin only)
  async getUserRolesAndPermissions(requestingUser) {
    if (!User.hasPermission(requestingUser, 'manage_users')) {
      throw new Error('Insufficient permissions to view roles and permissions');
    }

    return {
      roles: User.getUserRoles(),
      permissions: User.getAvailablePermissions()
    };
  }

  // Check if user has specific permission
  checkPermission(user, permission) {
    return user.permissions && user.permissions.includes(permission);
  }

  // Middleware to check authentication
  authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    try {
      const decoded = this.verifyToken(token);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
  }

  // Middleware to check specific permission
  requirePermission(permission) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!req.user.permissions.includes(permission)) {
        return res.status(403).json({ error: `Insufficient permissions. Required: ${permission}` });
      }

      next();
    };
  }

  // Middleware to check admin access
  requireAdmin() {
    return this.requirePermission('admin');
  }
}

module.exports = new AuthService();