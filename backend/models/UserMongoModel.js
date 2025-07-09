const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class UserMongoModel {
  constructor() {
    this.client = null;
    this.db = null;
    this.collection = null;
    this.isConnected = false;
    this.initializeConnection();
  }

  async initializeConnection() {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://admin:password123@mongodb:27017/aws-monitor?authSource=admin';
      this.client = new MongoClient(mongoUri);
      await this.client.connect();
      this.db = this.client.db('aws-monitor');
      this.collection = this.db.collection('users');
      this.isConnected = true;
      
      // Create indexes
      await this.collection.createIndex({ email: 1 }, { unique: true });
      await this.collection.createIndex({ username: 1 }, { unique: true });
      await this.collection.createIndex({ role: 1 });
      
      console.log('MongoDB User model connected successfully');
      
      // Initialize default admin user
      await this.initializeDefaultAdmin();
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      this.isConnected = false;
    }
  }

  async ensureConnection() {
    if (!this.isConnected) {
      await this.initializeConnection();
    }
  }

  // Initialize default admin user
  async initializeDefaultAdmin() {
    try {
      const adminEmail = 'admin@admin.com';
      const existingAdmin = await this.collection.findOne({ email: adminEmail });
      
      if (!existingAdmin) {
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
          mustChangePassword: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: null,
          emailVerified: true
        };

        await this.collection.insertOne(adminUser);
        console.log('Default admin user created successfully');
      }
    } catch (error) {
      console.error('Error initializing default admin user:', error);
    }
  }

  // Create a new user
  async create(userData) {
    await this.ensureConnection();
    
    const { email, username, password, firstName, lastName, role = 'user', permissions = [] } = userData;
    
    // Validate required fields
    if (!email || !username || !password) {
      throw new Error('Email, username, and password are required');
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

    try {
      await this.collection.insertOne(user);
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      if (error.code === 11000) {
        if (error.keyPattern.email) {
          throw new Error('User with this email already exists');
        }
        if (error.keyPattern.username) {
          throw new Error('User with this username already exists');
        }
      }
      throw error;
    }
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

  // Find user by email
  async findByEmail(email) {
    await this.ensureConnection();
    return await this.collection.findOne({ email: email.toLowerCase() });
  }

  // Find user by username
  async findByUsername(username) {
    await this.ensureConnection();
    return await this.collection.findOne({ username });
  }

  // Find user by ID
  async findById(userId) {
    await this.ensureConnection();
    return await this.collection.findOne({ id: userId });
  }

  // Get all users
  async findAll(filters = {}) {
    await this.ensureConnection();
    
    const query = {};
    
    if (filters.role) {
      query.role = filters.role;
    }
    
    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }
    
    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { email: searchRegex },
        { username: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex }
      ];
    }

    const users = await this.collection.find(query).toArray();
    
    // Remove passwords from results
    return users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }

  // Update user
  async update(userId, updateData) {
    await this.ensureConnection();
    
    // Update allowed fields
    const allowedFields = [
      'firstName', 'lastName', 'role', 'permissions', 
      'isActive', 'mustChangePassword', 'emailVerified'
    ];

    const updateDoc = { updatedAt: new Date() };
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updateDoc[field] = updateData[field];
      }
    });

    // Validate permissions if role is being updated
    if (updateData.role) {
      const validPermissions = this.getValidPermissions(updateData.role);
      if (updateData.permissions) {
        updateDoc.permissions = updateData.permissions.filter(p => validPermissions.includes(p));
      }
    }

    const result = await this.collection.updateOne(
      { id: userId },
      { $set: updateDoc }
    );
    
    if (result.matchedCount === 0) {
      throw new Error('User not found');
    }
    
    return await this.findById(userId);
  }

  // Update password
  async updatePassword(userId, newPassword) {
    await this.ensureConnection();
    
    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    const result = await this.collection.updateOne(
      { id: userId },
      { 
        $set: { 
          password: hashedPassword,
          mustChangePassword: false,
          updatedAt: new Date()
        }
      }
    );
    
    if (result.matchedCount === 0) {
      throw new Error('User not found');
    }
    
    return true;
  }

  // Verify password
  async verifyPassword(email, password) {
    await this.ensureConnection();
    
    const user = await this.findByEmail(email);
    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return null;
    }

    // Update last login
    await this.collection.updateOne(
      { id: user.id },
      { $set: { lastLoginAt: new Date() } }
    );

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Delete user
  async delete(userId) {
    await this.ensureConnection();
    
    const result = await this.collection.deleteOne({ id: userId });
    
    if (result.deletedCount === 0) {
      throw new Error('User not found');
    }
    
    return true;
  }

  // Get user statistics
  async getStats() {
    await this.ensureConnection();
    
    const total = await this.collection.countDocuments();
    const active = await this.collection.countDocuments({ isActive: true });
    const inactive = await this.collection.countDocuments({ isActive: false });
    
    const roleStats = await this.collection.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]).toArray();
    
    return {
      total,
      active,
      inactive,
      byRole: roleStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {})
    };
  }
}

module.exports = new UserMongoModel();
