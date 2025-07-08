const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');

class SSOService {
  constructor() {
    this.providers = new Map();
    this.ssoSessions = new Map();
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    
    // Initialize default providers
    this.initializeProviders();
  }

  // Initialize SSO providers
  initializeProviders() {
    // Google Workspace (OAuth 2.0)
    this.providers.set('google', {
      name: 'Google Workspace',
      type: 'oauth2',
      enabled: false,
      config: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
        scope: 'openid email profile',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        domain: process.env.GOOGLE_WORKSPACE_DOMAIN || 'bamko.net'
      }
    });

    // Microsoft Office 365 (OAuth 2.0)
    this.providers.set('microsoft', {
      name: 'Microsoft Office 365',
      type: 'oauth2',
      enabled: false,
      config: {
        clientId: process.env.MICROSOFT_CLIENT_ID || '',
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
        redirectUri: process.env.MICROSOFT_REDIRECT_URI || '',
        scope: 'openid email profile',
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
        tenant: process.env.MICROSOFT_TENANT_ID || 'common'
      }
    });

    // Okta (SAML/OAuth 2.0)
    this.providers.set('okta', {
      name: 'Okta',
      type: 'oauth2',
      enabled: false,
      config: {
        clientId: process.env.OKTA_CLIENT_ID || '',
        clientSecret: process.env.OKTA_CLIENT_SECRET || '',
        redirectUri: process.env.OKTA_REDIRECT_URI || '',
        scope: 'openid email profile',
        domain: process.env.OKTA_DOMAIN || '',
        authUrl: `https://${process.env.OKTA_DOMAIN || 'your-domain'}.okta.com/oauth2/default/v1/authorize`,
        tokenUrl: `https://${process.env.OKTA_DOMAIN || 'your-domain'}.okta.com/oauth2/default/v1/token`,
        userInfoUrl: `https://${process.env.OKTA_DOMAIN || 'your-domain'}.okta.com/oauth2/default/v1/userinfo`
      }
    });

    // Generic SAML provider
    this.providers.set('saml', {
      name: 'SAML Provider',
      type: 'saml',
      enabled: false,
      config: {
        entryPoint: process.env.SAML_ENTRY_POINT || '',
        issuer: process.env.SAML_ISSUER || '',
        cert: process.env.SAML_CERT || '',
        callbackUrl: process.env.SAML_CALLBACK_URL || ''
      }
    });
  }

  // Get available SSO providers
  getProviders() {
    return Array.from(this.providers.entries()).map(([id, provider]) => ({
      id,
      name: provider.name,
      type: provider.type,
      enabled: provider.enabled
    }));
  }

  // Enable/disable SSO provider
  configureProvider(providerId, config) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    // Update provider configuration
    provider.enabled = config.enabled || false;
    if (config.settings) {
      provider.config = { ...provider.config, ...config.settings };
    }

    return provider;
  }

  // Generate SSO login URL
  generateLoginUrl(providerId, state = null) {
    const provider = this.providers.get(providerId);
    if (!provider || !provider.enabled) {
      throw new Error('Provider not available');
    }

    if (provider.type !== 'oauth2') {
      throw new Error('Only OAuth2 providers support URL generation');
    }

    const stateParam = state || crypto.randomBytes(32).toString('hex');
    
    // Store state for validation
    this.ssoSessions.set(stateParam, {
      providerId,
      timestamp: Date.now(),
      state: stateParam
    });

    const params = new URLSearchParams({
      client_id: provider.config.clientId,
      redirect_uri: provider.config.redirectUri,
      scope: provider.config.scope,
      response_type: 'code',
      state: stateParam
    });

    // Provider-specific parameters
    if (providerId === 'microsoft') {
      params.append('response_mode', 'query');
    }

    return `${provider.config.authUrl}?${params.toString()}`;
  }

  // Handle OAuth callback
  async handleOAuthCallback(providerId, code, state) {
    const provider = this.providers.get(providerId);
    if (!provider || !provider.enabled) {
      throw new Error('Provider not available');
    }

    // Validate state parameter
    const session = this.ssoSessions.get(state);
    if (!session || session.providerId !== providerId) {
      throw new Error('Invalid state parameter');
    }

    // Clean up session
    this.ssoSessions.delete(state);

    try {
      // Exchange code for access token
      const tokenResponse = await this.exchangeCodeForToken(provider, code);
      
      // Get user information
      const userInfo = await this.getUserInfo(provider, tokenResponse.access_token);
      
      // Validate user domain (for Google Workspace)
      if (providerId === 'google' && provider.config.domain) {
        if (!userInfo.email.endsWith(`@${provider.config.domain}`)) {
          throw new Error(`Email domain must be @${provider.config.domain}`);
        }
      }

      // Create or update user
      const user = await this.createOrUpdateSSOUser(userInfo, providerId);
      
      // Generate JWT token
      const token = this.generateToken(user);

      return {
        token,
        user,
        provider: providerId
      };
    } catch (error) {
      console.error('OAuth callback error:', error);
      throw new Error(`SSO authentication failed: ${error.message}`);
    }
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(provider, code) {
    const tokenData = {
      client_id: provider.config.clientId,
      client_secret: provider.config.clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: provider.config.redirectUri
    };

    try {
      const response = await axios.post(provider.config.tokenUrl, tokenData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Token exchange error:', error.response?.data || error.message);
      throw new Error('Failed to exchange code for token');
    }
  }

  // Get user information from provider
  async getUserInfo(provider, accessToken) {
    try {
      const response = await axios.get(provider.config.userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return response.data;
    } catch (error) {
      console.error('User info error:', error.response?.data || error.message);
      throw new Error('Failed to get user information');
    }
  }

  // Create or update SSO user
  async createOrUpdateSSOUser(userInfo, providerId) {
    // Import User model here to avoid circular dependency
    const User = require('../models/User');

    const email = userInfo.email.toLowerCase();
    let user = await User.findByEmail(email);

    if (user) {
      // Update existing user with SSO info
      user.ssoProvider = providerId;
      user.ssoId = userInfo.id || userInfo.sub;
      user.lastLoginAt = new Date();
      user.emailVerified = true;
      
      // Update profile if needed
      if (userInfo.given_name && !user.firstName) {
        user.firstName = userInfo.given_name;
      }
      if (userInfo.family_name && !user.lastName) {
        user.lastName = userInfo.family_name;
      }
      if (userInfo.name && (!user.firstName || !user.lastName)) {
        const nameParts = userInfo.name.split(' ');
        user.firstName = user.firstName || nameParts[0];
        user.lastName = user.lastName || nameParts.slice(1).join(' ');
      }
      
      return user;
    } else {
      // Create new SSO user
      const newUser = {
        email: email,
        username: email.split('@')[0],
        firstName: userInfo.given_name || userInfo.name?.split(' ')[0] || 'User',
        lastName: userInfo.family_name || userInfo.name?.split(' ').slice(1).join(' ') || '',
        role: 'user',
        permissions: ['read'],
        ssoProvider: providerId,
        ssoId: userInfo.id || userInfo.sub,
        emailVerified: true,
        mustChangePassword: false,
        password: crypto.randomBytes(32).toString('hex') // Random password for SSO users
      };

      return await User.create(newUser);
    }
  }

  // Generate JWT token for SSO user
  generateToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      permissions: user.permissions,
      ssoProvider: user.ssoProvider,
      mustChangePassword: false
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
  }

  // Validate SSO configuration
  validateProviderConfig(providerId, config) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    const errors = [];

    if (provider.type === 'oauth2') {
      if (!config.clientId) errors.push('Client ID is required');
      if (!config.clientSecret) errors.push('Client Secret is required');
      if (!config.redirectUri) errors.push('Redirect URI is required');
    }

    if (provider.type === 'saml') {
      if (!config.entryPoint) errors.push('Entry Point is required');
      if (!config.issuer) errors.push('Issuer is required');
      if (!config.cert) errors.push('Certificate is required');
    }

    return errors;
  }

  // Test SSO provider connection
  async testProvider(providerId) {
    const provider = this.providers.get(providerId);
    if (!provider || !provider.enabled) {
      throw new Error('Provider not available');
    }

    try {
      if (provider.type === 'oauth2') {
        // Test by making a request to the auth URL
        const testUrl = provider.config.authUrl;
        const response = await axios.head(testUrl, { timeout: 5000 });
        return { success: true, status: response.status };
      }
      
      return { success: true, message: 'Provider configuration appears valid' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Clean up expired sessions
  cleanupExpiredSessions() {
    const now = Date.now();
    const expiredSessions = [];

    for (const [state, session] of this.ssoSessions.entries()) {
      // Sessions expire after 10 minutes
      if (now - session.timestamp > 600000) {
        expiredSessions.push(state);
      }
    }

    expiredSessions.forEach(state => this.ssoSessions.delete(state));
    
    return expiredSessions.length;
  }

  // Get SSO statistics
  getSSOStats() {
    return {
      activeProviders: Array.from(this.providers.values()).filter(p => p.enabled).length,
      totalProviders: this.providers.size,
      activeSessions: this.ssoSessions.size
    };
  }

  // Get configuration fields for a provider (for frontend forms)
  getConfigFields(providerId) {
    const fieldMappings = {
      google: [
        { name: 'clientId', label: 'Client ID', type: 'text', required: true },
        { name: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
        { name: 'redirectUri', label: 'Redirect URI', type: 'text', required: true },
        { name: 'domain', label: 'Workspace Domain', type: 'text', required: false, placeholder: 'bamko.net' }
      ],
      microsoft: [
        { name: 'clientId', label: 'Application ID', type: 'text', required: true },
        { name: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
        { name: 'redirectUri', label: 'Redirect URI', type: 'text', required: true },
        { name: 'tenant', label: 'Tenant ID', type: 'text', required: false, placeholder: 'common' }
      ],
      okta: [
        { name: 'clientId', label: 'Client ID', type: 'text', required: true },
        { name: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
        { name: 'redirectUri', label: 'Redirect URI', type: 'text', required: true },
        { name: 'domain', label: 'Okta Domain', type: 'text', required: true, placeholder: 'your-domain' }
      ],
      saml: [
        { name: 'entryPoint', label: 'Entry Point URL', type: 'text', required: true },
        { name: 'issuer', label: 'Issuer', type: 'text', required: true },
        { name: 'cert', label: 'Certificate', type: 'textarea', required: true },
        { name: 'callbackUrl', label: 'Callback URL', type: 'text', required: true }
      ]
    };

    return fieldMappings[providerId] || [];
  }
}

module.exports = new SSOService();
