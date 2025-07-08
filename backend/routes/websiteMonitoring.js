const express = require('express');
const router = express.Router();
const websiteMonitoringService = require('../services/websiteMonitoringService');
const authService = require('../services/authService');

// Get all monitored websites
router.get('/websites', authService.authenticateToken.bind(authService), async (req, res) => {
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
});

// Add a new website to monitor
router.post('/websites', authService.authenticateToken.bind(authService), async (req, res) => {
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
});

// Update a website
router.put('/websites/:websiteId', authService.authenticateToken.bind(authService), async (req, res) => {
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
});

// Remove a website from monitoring
router.delete('/websites/:websiteId', authService.authenticateToken.bind(authService), async (req, res) => {
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
});

// Get monitoring results for all websites
router.get('/results', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const results = websiteMonitoringService.getAllResults();
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
});

// Get monitoring results for a specific website
router.get('/results/:websiteId', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const { websiteId } = req.params;
    const results = websiteMonitoringService.getWebsiteResults(websiteId);
    
    if (!results) {
      return res.status(404).json({
        success: false,
        error: 'Website not found'
      });
    }

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
});

// Manually trigger a check for a specific website
router.post('/check/:websiteId', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const { websiteId } = req.params;
    const checkResult = await websiteMonitoringService.checkWebsite(websiteId);
    
    if (!checkResult) {
      return res.status(404).json({
        success: false,
        error: 'Website not found or inactive'
      });
    }

    res.json({
      success: true,
      checkResult,
      message: 'Website check completed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get monitoring statistics
router.get('/stats', authService.authenticateToken.bind(authService), async (req, res) => {
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
});

// Start monitoring service
router.post('/start', authService.authenticateToken.bind(authService), authService.requireAdmin(), async (req, res) => {
  try {
    websiteMonitoringService.startMonitoring();
    res.json({
      success: true,
      message: 'Website monitoring started'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stop monitoring service
router.post('/stop', authService.authenticateToken.bind(authService), authService.requireAdmin(), async (req, res) => {
  try {
    websiteMonitoringService.stopMonitoring();
    res.json({
      success: true,
      message: 'Website monitoring stopped'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Bulk check all websites
router.post('/check-all', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const websites = websiteMonitoringService.getMonitoredWebsites();
    const checkPromises = websites.map(website => 
      websiteMonitoringService.checkWebsite(website.id)
    );
    
    const results = await Promise.allSettled(checkPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    res.json({
      success: true,
      message: `Bulk check completed: ${successful} successful, ${failed} failed`,
      results: {
        total: websites.length,
        successful,
        failed
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
