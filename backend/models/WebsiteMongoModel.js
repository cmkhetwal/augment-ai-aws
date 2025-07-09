const { MongoClient } = require('mongodb');
const crypto = require('crypto');

class WebsiteMongoModel {
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
      this.collection = this.db.collection('websites');
      this.isConnected = true;
      
      // Create indexes
      await this.collection.createIndex({ url: 1 }, { unique: true });
      await this.collection.createIndex({ userId: 1 });
      await this.collection.createIndex({ isActive: 1 });
      
      console.log('MongoDB Website model connected successfully');
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

  // Create a new website
  async create(websiteData) {
    await this.ensureConnection();
    
    const { url, name, checkInterval = 300000, alertThreshold = 5000, userId } = websiteData;
    
    // Validate required fields
    if (!url || !name) {
      throw new Error('URL and name are required');
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      throw new Error('Invalid URL format');
    }

    // Create website object
    const website = {
      id: crypto.randomUUID(),
      url,
      name,
      checkInterval: parseInt(checkInterval) || 300000,
      alertThreshold: parseInt(alertThreshold) || 5000,
      userId: userId || null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
      notifications: {
        email: false,
        slack: false,
        webhook: null
      }
    };

    try {
      await this.collection.insertOne(website);
      return website;
    } catch (error) {
      if (error.code === 11000) {
        throw new Error('Website with this URL already exists');
      }
      throw error;
    }
  }

  // Find website by ID
  async findById(websiteId) {
    await this.ensureConnection();
    return await this.collection.findOne({ id: websiteId });
  }

  // Find website by URL
  async findByUrl(url) {
    await this.ensureConnection();
    return await this.collection.findOne({ url });
  }

  // Get all websites
  async findAll(filters = {}) {
    await this.ensureConnection();
    
    const query = {};
    
    if (filters.userId) {
      query.userId = filters.userId;
    }
    
    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }
    
    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { name: searchRegex },
        { url: searchRegex }
      ];
    }

    return await this.collection.find(query).toArray();
  }

  // Update website
  async update(websiteId, updateData) {
    await this.ensureConnection();
    
    // Validate URL if being updated
    if (updateData.url) {
      try {
        new URL(updateData.url);
      } catch (error) {
        throw new Error('Invalid URL format');
      }
    }

    // Update allowed fields
    const allowedFields = [
      'name', 'url', 'checkInterval', 'alertThreshold', 
      'isActive', 'tags', 'notifications'
    ];

    const updateDoc = { updatedAt: new Date() };
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === 'checkInterval' || field === 'alertThreshold') {
          updateDoc[field] = parseInt(updateData[field]);
        } else {
          updateDoc[field] = updateData[field];
        }
      }
    });

    try {
      const result = await this.collection.updateOne(
        { id: websiteId },
        { $set: updateDoc }
      );
      
      if (result.matchedCount === 0) {
        throw new Error('Website not found');
      }
      
      return await this.findById(websiteId);
    } catch (error) {
      if (error.code === 11000) {
        throw new Error('Website with this URL already exists');
      }
      throw error;
    }
  }

  // Delete website
  async delete(websiteId) {
    await this.ensureConnection();
    
    const result = await this.collection.deleteOne({ id: websiteId });
    
    if (result.deletedCount === 0) {
      throw new Error('Website not found');
    }
    
    return true;
  }

  // Get active websites
  async findActive() {
    await this.ensureConnection();
    return await this.collection.find({ isActive: true }).toArray();
  }

  // Get website statistics
  async getStats() {
    await this.ensureConnection();
    
    const total = await this.collection.countDocuments();
    const active = await this.collection.countDocuments({ isActive: true });
    const inactive = await this.collection.countDocuments({ isActive: false });
    
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentlyAdded = await this.collection.countDocuments({
      createdAt: { $gte: dayAgo }
    });
    
    return {
      total,
      active,
      inactive,
      recentlyAdded
    };
  }

  // Validate website data
  validateWebsiteData(data) {
    const errors = [];

    if (!data.url) {
      errors.push('URL is required');
    } else {
      try {
        new URL(data.url);
      } catch (error) {
        errors.push('Invalid URL format');
      }
    }

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Name is required');
    }

    if (data.checkInterval && (data.checkInterval < 60000 || data.checkInterval > 3600000)) {
      errors.push('Check interval must be between 1 minute and 1 hour');
    }

    if (data.alertThreshold && (data.alertThreshold < 1000 || data.alertThreshold > 60000)) {
      errors.push('Alert threshold must be between 1 second and 60 seconds');
    }

    return errors;
  }
}

module.exports = new WebsiteMongoModel();
