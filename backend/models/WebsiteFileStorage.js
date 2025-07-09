const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class WebsiteFileStorage {
  constructor() {
    this.dataFile = '/tmp/websites.json';
    this.ensureDataFile();
  }

  ensureDataFile() {
    if (\!fs.existsSync(this.dataFile)) {
      fs.writeFileSync(this.dataFile, JSON.stringify({}));
    }
  }

  readData() {
    try {
      const data = fs.readFileSync(this.dataFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading website data:', error);
      return {};
    }
  }

  writeData(data) {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error writing website data:', error);
    }
  }

  async create(websiteData) {
    const { url, name, checkInterval = 300000, alertThreshold = 5000, userId } = websiteData;
    
    if (\!url || \!name) {
      throw new Error('URL and name are required');
    }

    try {
      new URL(url);
    } catch (error) {
      throw new Error('Invalid URL format');
    }

    const data = this.readData();
    
    // Check if website already exists
    const existingWebsite = Object.values(data).find(site => site.url === url);
    if (existingWebsite) {
      throw new Error('Website with this URL already exists');
    }

    const website = {
      id: crypto.randomUUID(),
      url,
      name,
      checkInterval: parseInt(checkInterval) || 300000,
      alertThreshold: parseInt(alertThreshold) || 5000,
      userId: userId || null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
      notifications: {
        email: false,
        slack: false,
        webhook: null
      }
    };

    data[website.id] = website;
    this.writeData(data);

    return website;
  }

  async findById(websiteId) {
    const data = this.readData();
    return data[websiteId] || null;
  }

  async findByUrl(url) {
    const data = this.readData();
    return Object.values(data).find(site => site.url === url) || null;
  }

  async findAll(filters = {}) {
    const data = this.readData();
    let websites = Object.values(data);

    if (filters.userId) {
      websites = websites.filter(site => site.userId === filters.userId);
    }

    if (filters.isActive \!== undefined) {
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

  async update(websiteId, updateData) {
    const data = this.readData();
    const website = data[websiteId];
    
    if (\!website) {
      throw new Error('Website not found');
    }

    if (updateData.url) {
      try {
        new URL(updateData.url);
      } catch (error) {
        throw new Error('Invalid URL format');
      }

      const existingWebsite = Object.values(data)
        .find(site => site.url === updateData.url && site.id \!== websiteId);
      
      if (existingWebsite) {
        throw new Error('Website with this URL already exists');
      }
    }

    const allowedFields = [
      'name', 'url', 'checkInterval', 'alertThreshold', 
      'isActive', 'tags', 'notifications'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] \!== undefined) {
        if (field === 'checkInterval' || field === 'alertThreshold') {
          website[field] = parseInt(updateData[field]);
        } else {
          website[field] = updateData[field];
        }
      }
    });

    website.updatedAt = new Date().toISOString();
    data[websiteId] = website;
    this.writeData(data);

    return website;
  }

  async delete(websiteId) {
    const data = this.readData();
    
    if (\!data[websiteId]) {
      throw new Error('Website not found');
    }

    delete data[websiteId];
    this.writeData(data);
    return true;
  }

  async findActive() {
    const data = this.readData();
    return Object.values(data).filter(site => site.isActive);
  }

  async getStats() {
    const data = this.readData();
    const websites = Object.values(data);
    
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return {
      total: websites.length,
      active: websites.filter(site => site.isActive).length,
      inactive: websites.filter(site => \!site.isActive).length,
      recentlyAdded: websites.filter(site => {
        return new Date(site.createdAt) > dayAgo;
      }).length
    };
  }

  validateWebsiteData(data) {
    const errors = [];

    if (\!data.url) {
      errors.push('URL is required');
    } else {
      try {
        new URL(data.url);
      } catch (error) {
        errors.push('Invalid URL format');
      }
    }

    if (\!data.name || data.name.trim().length === 0) {
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

module.exports = new WebsiteFileStorage();
