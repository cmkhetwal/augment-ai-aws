const passport = require('passport');
const SamlStrategy = require('passport-saml').Strategy;
const authService = require('./authService');

class SAMLAuthService {
  constructor() {
    this.isConfigured = false;
    this.config = {
      entryPoint: process.env.SAML_ENTRY_POINT || '',
      issuer: process.env.SAML_ISSUER || 'aws-monitor',
      callbackUrl: process.env.SAML_CALLBACK_URL || 'http://localhost:3001/api/auth/saml/callback',
      cert: process.env.SAML_CERT || '',
      identifierFormat: process.env.SAML_IDENTIFIER_FORMAT || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
      authnRequestBinding: 'HTTP-Redirect',
      attributeConsumingServiceIndex: false,
      disableRequestedAuthnContext: true,
      forceAuthn: false,
      skipRequestCompression: true,
      acceptedClockSkewMs: 5000
    };
    
    this.initializeStrategy();
  }

  initializeStrategy() {
    if (!this.config.entryPoint || !this.config.cert) {
      console.log('SAML not configured - missing entryPoint or certificate');
      return;
    }

    const strategy = new SamlStrategy(
      {
        entryPoint: this.config.entryPoint,
        issuer: this.config.issuer,
        callbackUrl: this.config.callbackUrl,
        cert: this.config.cert,
        identifierFormat: this.config.identifierFormat,
        signatureAlgorithm: this.config.signatureAlgorithm,
        digestAlgorithm: this.config.digestAlgorithm,
        authnRequestBinding: this.config.authnRequestBinding,
        attributeConsumingServiceIndex: this.config.attributeConsumingServiceIndex,
        disableRequestedAuthnContext: this.config.disableRequestedAuthnContext,
        forceAuthn: this.config.forceAuthn,
        skipRequestCompression: this.config.skipRequestCompression,
        acceptedClockSkewMs: this.config.acceptedClockSkewMs
      },
      async (profile, done) => {
        try {
          const user = await this.processSAMLProfile(profile);
          return done(null, user);
        } catch (error) {
          console.error('SAML profile processing error:', error);
          return done(error, null);
        }
      }
    );

    passport.use('saml', strategy);
    this.isConfigured = true;
    console.log('SAML authentication configured successfully');
  }

  async processSAMLProfile(profile) {
    // Extract user information from SAML profile
    const email = profile.nameID || profile.email || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
    const username = profile.username || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || email;
    const firstName = profile.firstName || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] || '';
    const lastName = profile.lastName || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'] || '';
    const groups = profile.groups || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/groups'] || [];

    if (!email) {
      throw new Error('No email found in SAML profile');
    }

    // Check if user exists in local database
    let user = authService.users.find(u => u.email === email);

    if (!user) {
      // Create new user from SAML profile
      user = await this.createUserFromSAML({
        email,
        username,
        firstName,
        lastName,
        groups
      });
    } else {
      // Update existing user with SAML data
      user.firstName = firstName || user.firstName;
      user.lastName = lastName || user.lastName;
      user.lastLogin = new Date();
      user.authMethod = 'saml';
    }

    return user;
  }

  async createUserFromSAML(samlData) {
    // Determine role based on groups or default to 'user'
    let role = 'user';
    let permissions = ['read'];

    // Map SAML groups to application roles
    if (Array.isArray(samlData.groups)) {
      if (samlData.groups.includes('admin') || samlData.groups.includes('administrators')) {
        role = 'admin';
        permissions = ['read', 'write', 'admin', 'delete', 'manage_users', 'manage_notifications', 'manage_settings'];
      } else if (samlData.groups.includes('operators') || samlData.groups.includes('monitoring')) {
        role = 'operator';
        permissions = ['read', 'write'];
      }
    }

    const newUser = {
      id: require('crypto').randomUUID(),
      username: samlData.username,
      email: samlData.email,
      firstName: samlData.firstName,
      lastName: samlData.lastName,
      role: role,
      permissions: permissions,
      isActive: true,
      mustChangePassword: false, // SAML users don't need to change password
      authMethod: 'saml',
      createdAt: new Date(),
      lastLogin: new Date(),
      samlGroups: samlData.groups
    };

    // Add user to the auth service
    authService.users.push(newUser);
    
    console.log(`Created new SAML user: ${newUser.email} with role: ${newUser.role}`);
    return newUser;
  }

  updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.initializeStrategy();
  }

  getConfiguration() {
    return {
      entryPoint: this.config.entryPoint,
      issuer: this.config.issuer,
      callbackUrl: this.config.callbackUrl,
      identifierFormat: this.config.identifierFormat,
      isConfigured: this.isConfigured
    };
  }

  getMetadata() {
    if (!this.isConfigured) {
      throw new Error('SAML not configured');
    }

    const strategy = passport._strategy('saml');
    return strategy.generateServiceProviderMetadata(null, null);
  }

  isEnabled() {
    return this.isConfigured && this.config.entryPoint && this.config.cert;
  }
}

module.exports = new SAMLAuthService();
