const express = require('express');
const router = express.Router();
const ssoService = require('../services/ssoService');
const authService = require('../services/authService');

// Get available SSO providers
router.get('/providers', async (req, res) => {
  try {
    const providers = ssoService.getProviders();
    res.json({
      success: true,
      providers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Configure SSO provider (admin only)
router.post('/providers/:providerId/configure', 
  authService.authenticateToken.bind(authService),
  authService.requireAdmin(),
  async (req, res) => {
    try {
      const { providerId } = req.params;
      const { enabled, settings } = req.body;

      // Validate configuration
      if (enabled && settings) {
        const errors = ssoService.validateProviderConfig(providerId, settings);
        if (errors.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'Configuration validation failed',
            details: errors
          });
        }
      }

      const provider = ssoService.configureProvider(providerId, { enabled, settings });
      
      res.json({
        success: true,
        provider: {
          id: providerId,
          name: provider.name,
          type: provider.type,
          enabled: provider.enabled
        },
        message: 'Provider configured successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Test SSO provider connection (admin only)
router.post('/providers/:providerId/test',
  authService.authenticateToken.bind(authService),
  authService.requireAdmin(),
  async (req, res) => {
    try {
      const { providerId } = req.params;
      const testResult = await ssoService.testProvider(providerId);
      
      res.json({
        success: true,
        testResult
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Generate SSO login URL
router.get('/login/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { state } = req.query;
    
    const loginUrl = ssoService.generateLoginUrl(providerId, state);
    
    res.json({
      success: true,
      loginUrl
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Handle OAuth callback
router.get('/callback/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { code, state, error: oauthError } = req.query;

    // Check for OAuth errors
    if (oauthError) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=${encodeURIComponent(oauthError)}`);
    }

    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=missing_parameters`);
    }

    const result = await ssoService.handleOAuthCallback(providerId, code, state);
    
    // Redirect to frontend with token
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sso-callback?token=${result.token}&provider=${result.provider}`;
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('SSO callback error:', error);
    const errorMessage = encodeURIComponent(error.message);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=${errorMessage}`);
  }
});

// Handle POST callback (for SAML and other providers)
router.post('/callback/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    
    // This would handle SAML responses and other POST-based callbacks
    // Implementation depends on the specific provider
    
    res.status(501).json({
      success: false,
      error: 'POST callbacks not yet implemented'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get SSO statistics (admin only)
router.get('/stats',
  authService.authenticateToken.bind(authService),
  authService.requireAdmin(),
  async (req, res) => {
    try {
      const stats = ssoService.getSSOStats();
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

// Cleanup expired sessions (admin only)
router.post('/cleanup',
  authService.authenticateToken.bind(authService),
  authService.requireAdmin(),
  async (req, res) => {
    try {
      const cleanedUp = ssoService.cleanupExpiredSessions();
      res.json({
        success: true,
        message: `Cleaned up ${cleanedUp} expired sessions`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Initiate SSO login (redirect endpoint)
router.get('/initiate/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    const loginUrl = ssoService.generateLoginUrl(providerId);
    
    // Redirect user to SSO provider
    res.redirect(loginUrl);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Validate SSO token (for frontend validation)
router.post('/validate', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required'
      });
    }

    // Use existing auth service to validate token
    const decoded = authService.verifyToken(token);
    
    res.json({
      success: true,
      valid: true,
      user: {
        id: decoded.id,
        email: decoded.email,
        username: decoded.username,
        role: decoded.role,
        permissions: decoded.permissions,
        ssoProvider: decoded.ssoProvider
      }
    });
  } catch (error) {
    res.json({
      success: true,
      valid: false,
      error: error.message
    });
  }
});

// Get provider configuration (admin only) - for frontend configuration UI
router.get('/providers/:providerId/config',
  authService.authenticateToken.bind(authService),
  authService.requireAdmin(),
  async (req, res) => {
    try {
      const { providerId } = req.params;
      const providers = ssoService.getProviders();
      const provider = providers.find(p => p.id === providerId);
      
      if (!provider) {
        return res.status(404).json({
          success: false,
          error: 'Provider not found'
        });
      }

      // Return provider info without sensitive data
      res.json({
        success: true,
        provider: {
          id: providerId,
          name: provider.name,
          type: provider.type,
          enabled: provider.enabled,
          // Don't return sensitive config data like client secrets
          configFields: ssoService.getConfigFields(providerId)
        }
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
