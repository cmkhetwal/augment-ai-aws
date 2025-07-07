// API Configuration - Dynamic URL detection
const getApiBaseUrl = () => {
  // In production, use the current host with port 3001
  // In development, use the proxy configured in package.json
  if (process.env.NODE_ENV === 'production') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:3001`;
  }
  return '';
};

const API_BASE_URL = getApiBaseUrl();

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
