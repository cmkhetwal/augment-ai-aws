// API Configuration - Fallback strategy for different environments
const getApiBaseUrl = () => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  // Always try the same hostname with port 3001 first
  // This works for localhost, 127.0.0.1, and IP addresses
  return `${protocol}//${hostname}:3001`;
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

  // Website Monitoring
  WEBSITE_MONITORING: `${API_BASE_URL}/api/website-monitoring`,

  // SSO
  SSO: `${API_BASE_URL}/api/sso`,

  // Dashboard
  DASHBOARD: `${API_BASE_URL}/api/dashboard`,
};

export default API_BASE_URL;
