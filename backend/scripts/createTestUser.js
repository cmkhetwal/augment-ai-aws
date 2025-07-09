const User = require('../models/UserMongoModel');

async function createTestUser() {
  try {
    console.log('Creating test user with view-only access...');
    
    const testUser = await User.create({
      email: 'testuser@test.com',
      username: 'testuser',
      password: 'testpass123',
      firstName: 'Test',
      lastName: 'User',
      role: 'viewer',
      permissions: ['read']
    });
    
    console.log('Test user created successfully:', {
      id: testUser.id,
      email: testUser.email,
      username: testUser.username,
      role: testUser.role,
      permissions: testUser.permissions
    });
    
    console.log('\nLogin credentials:');
    console.log('Email: testuser@test.com');
    console.log('Password: testpass123');
    
  } catch (error) {
    console.error('Error creating test user:', error.message);
  }
}

createTestUser();
