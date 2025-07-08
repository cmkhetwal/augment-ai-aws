const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const samlAuthService = require('../services/samlAuthService');
const authService = require('../services/authService');

const router = express.Router();

// SAML login initiation
router.get('/login', (req, res, next) => {
  if (!samlAuthService.isEnabled()) {
    return res.status(400).json({
      success: false,
      error: 'SAML authentication is not configured'
    });
  }

  passport.authenticate('saml', {
    successRedirect: '/',
    failureRedirect: '/login'
  })(req, res, next);
});

// SAML callback
router.post('/callback', (req, res, next) => {
  if (!samlAuthService.isEnabled()) {
    return res.status(400).json({
      success: false,
      error: 'SAML authentication is not configured'
    });
  }

  passport.authenticate('saml', (err, user, info) => {
    if (err) {
      console.error('SAML authentication error:', err);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=saml_error`);
    }

    if (!user) {
      console.error('SAML authentication failed:', info);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=saml_failed`);
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        permissions: user.permissions,
        mustChangePassword: user.mustChangePassword
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/saml-callback?token=${token}`);
  })(req, res, next);
});

// Get SAML metadata
router.get('/metadata', (req, res) => {
  try {
    if (!samlAuthService.isEnabled()) {
      return res.status(400).json({
        success: false,
        error: 'SAML authentication is not configured'
      });
    }

    const metadata = samlAuthService.getMetadata();
    res.set('Content-Type', 'text/xml');
    res.send(metadata);
  } catch (error) {
    console.error('Error generating SAML metadata:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate SAML metadata'
    });
  }
});

// Get SAML configuration (admin only)
router.get('/config', authService.authenticateToken.bind(authService), (req, res) => {
  if (!req.user.permissions.includes('admin')) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }

  try {
    const config = samlAuthService.getConfiguration();
    res.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('Error getting SAML config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get SAML configuration'
    });
  }
});

// Update SAML configuration (admin only)
router.post('/config', authService.authenticateToken.bind(authService), (req, res) => {
  if (!req.user.permissions.includes('admin')) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }

  try {
    const { entryPoint, issuer, callbackUrl, cert, identifierFormat } = req.body;
    
    const newConfig = {};
    if (entryPoint) newConfig.entryPoint = entryPoint;
    if (issuer) newConfig.issuer = issuer;
    if (callbackUrl) newConfig.callbackUrl = callbackUrl;
    if (cert) newConfig.cert = cert;
    if (identifierFormat) newConfig.identifierFormat = identifierFormat;

    samlAuthService.updateConfiguration(newConfig);

    res.json({
      success: true,
      message: 'SAML configuration updated successfully',
      config: samlAuthService.getConfiguration()
    });
  } catch (error) {
    console.error('Error updating SAML config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update SAML configuration'
    });
  }
});

// Check SAML status
router.get('/status', (req, res) => {
  res.json({
    success: true,
    enabled: samlAuthService.isEnabled(),
    configured: samlAuthService.isConfigured
  });
});

module.exports = router;
