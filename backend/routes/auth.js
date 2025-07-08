const express = require('express');
const router = express.Router();
const AuthService = require('../services/authService');

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/username and password are required' });
    }

    const result = await AuthService.login(identifier, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// Register new user (admin only)
router.post('/register', AuthService.authenticateToken.bind(AuthService), async (req, res) => {
  try {
    const newUser = await AuthService.register(req.body, req.user);
    res.status(201).json({ user: newUser, message: 'User created successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Change password
router.post('/change-password', AuthService.authenticateToken.bind(AuthService), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    const result = await AuthService.changePassword(req.user.id, currentPassword, newPassword);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await AuthService.requestPasswordReset(email);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const result = await AuthService.resetPassword(token, newPassword);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get current user info
router.get('/me', AuthService.authenticateToken.bind(AuthService), async (req, res) => {
  try {
    const user = await AuthService.getCurrentUser(req.user.id);
    res.json({ user });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Update user profile
router.put('/profile/:userId?', AuthService.authenticateToken.bind(AuthService), async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    const updatedUser = await AuthService.updateProfile(userId, req.body, req.user);
    res.json({ user: updatedUser, message: 'Profile updated successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all users (admin only)
router.get('/users', AuthService.authenticateToken.bind(AuthService), async (req, res) => {
  try {
    const users = await AuthService.getAllUsers(req.user);
    res.json({ users });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

// Delete user (admin only)
router.delete('/users/:userId', AuthService.authenticateToken.bind(AuthService), async (req, res) => {
  try {
    const result = await AuthService.deleteUser(req.params.userId, req.user);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user roles and permissions (admin only)
router.get('/roles-permissions', AuthService.authenticateToken.bind(AuthService), async (req, res) => {
  try {
    const data = await AuthService.getUserRolesAndPermissions(req.user);
    res.json(data);
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

// Verify token endpoint
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const decoded = AuthService.verifyToken(token);
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ valid: false, error: error.message });
  }
});

// Verify token endpoint (for SAML callback)
router.post('/verify-token', AuthService.authenticateToken.bind(AuthService), (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user,
      message: 'Token is valid'
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
});

// Logout endpoint (client-side token removal)
router.post('/logout', AuthService.authenticateToken.bind(AuthService), (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;