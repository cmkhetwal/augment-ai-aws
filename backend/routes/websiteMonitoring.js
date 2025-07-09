const express = require('express');
const router = express.Router();
const websiteMonitoringService = require('../services/websiteMonitoringService');
const authService = require('../services/authService');

// Get all monitored websites (READ permission required)
router.get('/websites', 
  authService.authenticateToken.bind(authService), 
  authService.requirePermission('read'),
  async (req, res) => {
    try {
      const websites = websiteMonitoringService.getMonitoredWebsites();
      res.json({
        success: true,
        websites
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Add a new website to monitor (WRITE permission required)
router.post('/websites', 
  authService.authenticateToken.bind(authService), 
  authService.requirePermission('write'),
  async (req, res) => {
    try {
      const { url, name, checkInterval, alertThreshold } = req.body;
      
      if (!url || !name) {
        return res.status(400).json({
          success: false,
          error: 'URL and name are required'
        });
      }

      const website = await websiteMonitoringService.addWebsite({
        url,
        name,
        checkInterval,
        alertThreshold
      });

      res.status(201).json({
        success: true,
        website,
        message: 'Website added successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Update a website (WRITE permission required)
router.put('/websites/:websiteId', 
  authService.authenticateToken.bind(authService), 
  authService.requirePermission('write'),
  async (req, res) => {
    try {
      const { websiteId } = req.params;
      const { url, name, checkInterval, alertThreshold } = req.body;
      
      if (!url || !name) {
        return res.status(400).json({
          success: false,
          error: 'URL and name are required'
        });
      }

      const website = await websiteMonitoringService.updateWebsite(websiteId, {
        url,
        name,
        checkInterval,
        alertThreshold
      });

      res.json({
        success: true,
        website,
        message: 'Website updated successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Remove a website from monitoring (DELETE permission required)
router.delete('/websites/:websiteId', 
  authService.authenticateToken.bind(authService), 
  authService.requirePermission('delete'),
  async (req, res) => {
    try {
      const { websiteId } = req.params;
      const removed = websiteMonitoringService.removeWebsite(websiteId);
      
      if (!removed) {
        return res.status(404).json({
          success: false,
          error: 'Website not found'
        });
      }

      res.json({
        success: true,
        message: 'Website removed successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get monitoring results for all websites (READ permission required)
router.get('/results', 
  authService.authenticateToken.bind(authService), 
  authService.requirePermission('read'),
  async (req, res) => {
    try {
      const results = websiteMonitoringService.getMonitoringResults();
      res.json({
        success: true,
        results
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get monitoring result for a specific website (READ permission required)
router.get('/results/:websiteId', 
  authService.authenticateToken.bind(authService), 
  authService.requirePermission('read'),
  async (req, res) => {
    try {
      const { websiteId } = req.params;
      const result = websiteMonitoringService.getWebsiteResult(websiteId);
      
      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Website monitoring result not found'
        });
      }

      res.json({
        success: true,
        result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Manually check a specific website (WRITE permission required)
router.post('/check/:websiteId', 
  authService.authenticateToken.bind(authService), 
  authService.requirePermission('write'),
  async (req, res) => {
    try {
      const { websiteId } = req.params;
      const result = await websiteMonitoringService.checkWebsite(websiteId);
      
      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Website not found or inactive'
        });
      }

      res.json({
        success: true,
        result,
        message: 'Website check completed'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get monitoring statistics (READ permission required)
router.get('/stats', 
  authService.authenticateToken.bind(authService), 
  authService.requirePermission('read'),
  async (req, res) => {
    try {
      const stats = websiteMonitoringService.getMonitoringStats();
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

module.exports = router;
