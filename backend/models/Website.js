const crypto = require('crypto');

class Website {
  constructor() {
    this.websites = new Map(); // In-memory storage for websites
  }

  // Create a new website
  async create(websiteData) {
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

    // Check if website already exists
    const existingWebsite = Array.from(this.websites.values())
      .find(site => site.url === url);
    
    if (existingWebsite) {
      throw new Error('Website with this URL already exists');
    }

    // Create website object
    const website = {
      id: crypto.randomUUID(),
      url,
      name,
      checkInterval: parseInt(checkInterval) || 300000, // Default 5 minutes
      alertThreshold: parseInt(alertThreshold) || 5000, // Default 5 seconds
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

    // Store website
    this.websites.set(website.id, website);

    return website;
  }

  // Find website by ID
  async findById(websiteId) {
    return this.websites.get(websiteId) || null;
  }

  // Find website by URL
  async findByUrl(url) {
    return Array.from(this.websites.values())
      .find(site => site.url === url) || null;
  }

  // Get all websites
  async findAll(filters = {}) {
    let websites = Array.from(this.websites.values());

    // Apply filters
    if (filters.userId) {
      websites = websites.filter(site => site.userId === filters.userId);
    }

    if (filters.isActive !== undefined) {
      websites = websites.filter(site => site.isActive === filters.isActive);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      websites = websites.filter(site => 
        site.name.toLowerCase().includes(searchLower) ||
        site.url.toLowerCase().includes(searchLower)
      );
    }

    return websites;
  }

  // Update website
  async update(websiteId, updateData) {
    const website = this.websites.get(websiteId);
    if (!website) {
      throw new Error('Website not found');
    }

    // Validate URL if being updated
    if (updateData.url) {
      try {
        new URL(updateData.url);
      } catch (error) {
        throw new Error('Invalid URL format');
      }

      // Check if new URL conflicts with existing website
      const existingWebsite = Array.from(this.websites.values())
        .find(site => site.url === updateData.url && site.id !== websiteId);
      
      if (existingWebsite) {
        throw new Error('Website with this URL already exists');
      }
    }

    // Update allowed fields
    const allowedFields = [
      'name', 'url', 'checkInterval', 'alertThreshold', 
      'isActive', 'tags', 'notifications'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === 'checkInterval' || field === 'alertThreshold') {
          website[field] = parseInt(updateData[field]);
        } else {
          website[field] = updateData[field];
        }
      }
    });

    website.updatedAt = new Date();

    return website;
  }

  // Delete website
  async delete(websiteId) {
    const website = this.websites.get(websiteId);
    if (!website) {
      throw new Error('Website not found');
    }

    return this.websites.delete(websiteId);
  }

  // Get websites by user
  async findByUser(userId) {
    return Array.from(this.websites.values())
      .filter(site => site.userId === userId);
  }

  // Get active websites
  async findActive() {
    return Array.from(this.websites.values())
      .filter(site => site.isActive);
  }

  // Add tag to website
  async addTag(websiteId, tag) {
    const website = this.websites.get(websiteId);
    if (!website) {
      throw new Error('Website not found');
    }

    if (!website.tags.includes(tag)) {
      website.tags.push(tag);
      website.updatedAt = new Date();
    }

    return website;
  }

  // Remove tag from website
  async removeTag(websiteId, tag) {
    const website = this.websites.get(websiteId);
    if (!website) {
      throw new Error('Website not found');
    }

    website.tags = website.tags.filter(t => t !== tag);
    website.updatedAt = new Date();

    return website;
  }

  // Update notification settings
  async updateNotifications(websiteId, notifications) {
    const website = this.websites.get(websiteId);
    if (!website) {
      throw new Error('Website not found');
    }

    website.notifications = {
      ...website.notifications,
      ...notifications
    };
    website.updatedAt = new Date();

    return website;
  }

  // Get website statistics
  async getStats() {
    const websites = Array.from(this.websites.values());
    
    return {
      total: websites.length,
      active: websites.filter(site => site.isActive).length,
      inactive: websites.filter(site => !site.isActive).length,
      byInterval: this.groupByInterval(websites),
      recentlyAdded: websites
        .filter(site => {
          const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return site.createdAt > dayAgo;
        }).length
    };
  }

  // Group websites by check interval
  groupByInterval(websites) {
    const intervals = {};
    
    websites.forEach(site => {
      const interval = site.checkInterval;
      if (!intervals[interval]) {
        intervals[interval] = 0;
      }
      intervals[interval]++;
    });

    return intervals;
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

  // Bulk operations
  async bulkUpdate(websiteIds, updateData) {
    const results = [];
    
    for (const websiteId of websiteIds) {
      try {
        const updated = await this.update(websiteId, updateData);
        results.push({ websiteId, success: true, website: updated });
      } catch (error) {
        results.push({ websiteId, success: false, error: error.message });
      }
    }

    return results;
  }

  async bulkDelete(websiteIds) {
    const results = [];
    
    for (const websiteId of websiteIds) {
      try {
        const deleted = await this.delete(websiteId);
        results.push({ websiteId, success: deleted });
      } catch (error) {
        results.push({ websiteId, success: false, error: error.message });
      }
    }

    return results;
  }
}

module.exports = new Website();
