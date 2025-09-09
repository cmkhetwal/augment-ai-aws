const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class User {
  constructor() {
    this.users = new Map(); // In-memory storage for users
    this.resetTokens = new Map(); // Store password reset tokens
    this.initializeDefaultAdmin();
  }

  // Initialize default admin user
  async initializeDefaultAdmin() {
    try {
      const adminEmail = 'admin@admin.com';
      if (!this.users.has(adminEmail)) {
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash('vmware@123', saltRounds);

        const adminUser = {
          id: crypto.randomUUID(),
          email: adminEmail,
          username: 'admin',
          password: hashedPassword,
          firstName: 'Administrator',
          lastName: 'User',
          role: 'admin',
          permissions: ['read', 'write', 'admin', 'delete', 'manage_users', 'manage_notifications', 'manage_settings'],
          isActive: true,
          mustChangePassword: true, // Force password change on first login
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: null,
          emailVerified: true
        };

        this.users.set(adminEmail, adminUser);
        console.log('Default admin user created: admin@admin.com / vmware@123 (must change password on first login)');
      } else {
        // Update existing admin user permissions if they're missing new permissions
        this.updateAdminPermissions();
      }
    } catch (error) {
      console.error('Error creating default admin user:', error);
    }
  }

  // Update admin user permissions (migration function)
  updateAdminPermissions() {
    try {
      const adminEmail = 'admin@admin.com';
      const adminUser = this.users.get(adminEmail);

      if (adminUser && adminUser.role === 'admin') {
        const requiredAdminPermissions = ['read', 'write', 'admin', 'delete', 'manage_users', 'manage_notifications', 'manage_settings'];
        let updated = false;

        // Check if admin user is missing any required permissions
        for (const permission of requiredAdminPermissions) {
          if (!adminUser.permissions.includes(permission)) {
            adminUser.permissions.push(permission);
            updated = true;
          }
        }

        if (updated) {
          adminUser.updatedAt = new Date();
          this.users.set(adminEmail, adminUser);
          console.log('Admin user permissions updated with missing permissions');
        }
      }
    } catch (error) {
      console.error('Error updating admin permissions:', error);
    }
  }

  // Create a new user
  async create(userData) {
    const { email, username, password, firstName, lastName, role = 'user', permissions = ['read'] } = userData;
    
    // Check if user already exists
    if (this.users.has(email.toLowerCase())) {
      throw new Error('User already exists with this email');
    }

    // Check if username already exists
    for (const user of this.users.values()) {
      if (user.username === username) {
        throw new Error('Username already exists');
      }
    }

    // Validate permissions based on role
    const validPermissions = this.getValidPermissions(role);
    const userPermissions = permissions.filter(p => validPermissions.includes(p));

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user object
    const user = {
      id: crypto.randomUUID(),
      email: email.toLowerCase(),
      username,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      permissions: userPermissions,
      isActive: true,
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
      emailVerified: true
    };

    // Store user
    this.users.set(email.toLowerCase(), user);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Get valid permissions for role
  getValidPermissions(role) {
    const rolePermissions = {
      'admin': ['read', 'write', 'admin', 'delete', 'manage_users', 'manage_notifications', 'manage_settings'],
      'manager': ['read', 'write', 'manage_notifications'],
      'operator': ['read', 'write'],
      'viewer': ['read'],
      'user': ['read']
    };

    return rolePermissions[role] || ['read'];
  }

  // Find user by email or username
  async findByEmailOrUsername(identifier) {
    // Try email first
    let user = this.users.get(identifier.toLowerCase());
    
    // If not found by email, try username
    if (!user) {
      for (const u of this.users.values()) {
        if (u.username === identifier) {
          user = u;
          break;
        }
      }
    }

    if (!user) {
      return null;
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Find user by email
  async findByEmail(email) {
    const user = this.users.get(email.toLowerCase());
    if (!user) {
      return null;
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Find user by ID
  async findById(id) {
    for (const user of this.users.values()) {
      if (user.id === id) {
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }
    }
    return null;
  }

  // Validate user password
  async validatePassword(identifier, password) {
    let user = this.users.get(identifier.toLowerCase());

    // If not found by email, try username
    if (!user) {
      for (const u of this.users.values()) {
        if (u.username === identifier) {
          user = u;
          break;
        }
      }
    }

    if (!user) {
      return { isValid: false, user: null };
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (isValid) {
      // Update last login
      user.lastLoginAt = new Date();
      user.updatedAt = new Date();
    }

    const { password: _, ...userWithoutPassword } = user;
    return { isValid, user: isValid ? userWithoutPassword : null };
  }

  // Update user password
  async updatePassword(identifier, newPassword) {
    let user = this.users.get(identifier.toLowerCase());
    
    // If not found by email, try username
    if (!user) {
      for (const u of this.users.values()) {
        if (u.username === identifier) {
          user = u;
          break;
        }
      }
    }

    if (!user) {
      throw new Error('User not found');
    }

    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    user.password = hashedPassword;
    user.mustChangePassword = false; // Clear force password change flag
    user.updatedAt = new Date();

    return true;
  }

  // Generate password reset token
  generateResetToken(email) {
    const user = this.users.get(email.toLowerCase());
    if (!user) {
      throw new Error('User not found');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    this.resetTokens.set(token, {
      email: email.toLowerCase(),
      expiresAt
    });

    return token;
  }

  // Validate reset token
  validateResetToken(token) {
    const tokenData = this.resetTokens.get(token);
    if (!tokenData) {
      return null;
    }

    if (new Date() > tokenData.expiresAt) {
      this.resetTokens.delete(token);
      return null;
    }

    return tokenData;
  }

  // Use reset token (consume it)
  useResetToken(token) {
    const tokenData = this.validateResetToken(token);
    if (tokenData) {
      this.resetTokens.delete(token);
    }
    return tokenData;
  }

  // Update user profile
  async updateProfile(email, updateData) {
    const user = this.users.get(email.toLowerCase());
    if (!user) {
      throw new Error('User not found');
    }

    // Only allow certain fields to be updated
    const allowedFields = ['firstName', 'lastName', 'role', 'permissions', 'isActive'];
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'permissions') {
          // Validate permissions based on role
          const validPermissions = this.getValidPermissions(user.role);
          user[field] = updateData[field].filter(p => validPermissions.includes(p));
        } else {
          user[field] = updateData[field];
        }
      }
    }

    user.updatedAt = new Date();

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Check user permission
  hasPermission(user, permission) {
    return user.permissions && user.permissions.includes(permission);
  }

  // Check if user is admin
  isAdmin(user) {
    return user.role === 'admin' || this.hasPermission(user, 'admin');
  }

  // Get all users (admin function)
  async getAllUsers() {
    const users = Array.from(this.users.values()).map(user => {
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    return users;
  }

  // Delete user
  async deleteUser(email) {
    return this.users.delete(email.toLowerCase());
  }

  // Get user count
  getUserCount() {
    return this.users.size;
  }

  // Check if any users exist (for initial admin setup)
  hasUsers() {
    return this.users.size > 0;
  }

  // Get user roles
  getUserRoles() {
    return [
      { value: 'admin', label: 'Administrator', permissions: this.getValidPermissions('admin') },
      { value: 'manager', label: 'Manager', permissions: this.getValidPermissions('manager') },
      { value: 'operator', label: 'Operator', permissions: this.getValidPermissions('operator') },
      { value: 'viewer', label: 'Viewer', permissions: this.getValidPermissions('viewer') },
      { value: 'user', label: 'User', permissions: this.getValidPermissions('user') }
    ];
  }

  // Get available permissions
  getAvailablePermissions() {
    return [
      { value: 'read', label: 'Read/View', description: 'View dashboard and metrics' },
      { value: 'write', label: 'Write/Modify', description: 'Modify settings and configurations' },
      { value: 'admin', label: 'Admin Access', description: 'Full administrative access' },
      { value: 'delete', label: 'Delete', description: 'Delete resources and data' },
      { value: 'manage_users', label: 'Manage Users', description: 'Create, edit, and delete users' },
      { value: 'manage_notifications', label: 'Manage Notifications', description: 'Configure notification settings' },
      { value: 'manage_settings', label: 'Manage Settings', description: 'Configure application settings' }
    ];
  }
}

module.exports = new User();