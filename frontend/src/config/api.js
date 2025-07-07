// API Configuration
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'http://localhost:3001' 
  : '';

export const API_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/api/auth/login`,
  REGISTER: `${API_BASE_URL}/api/auth/register`,
  CHANGE_PASSWORD: `${API_BASE_URL}/api/auth/change-password`,
  CURRENT_USER: `${API_BASE_URL}/api/auth/me`,
  USERS: `${API_BASE_URL}/api/auth/users`,
  INSTANCES: `${API_BASE_URL}/api/instances`,
  PING: `${API_BASE_URL}/api/ping`,
  METRICS: `${API_BASE_URL}/api/metrics`,
  PORTS: `${API_BASE_URL}/api/ports`,
  NOTIFICATIONS: `${API_BASE_URL}/api/notifications`,
  REGIONS: `${API_BASE_URL}/api/regions`,
};

export default API_BASE_URL;
