// API Configuration - Dynamic URL detection
const getApiBaseUrl = () => {
  // In production, use the current host (nginx will proxy to backend)
  // In development, use the proxy configured in package.json
  if (process.env.NODE_ENV === "production") {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    // Use the same domain - nginx will handle routing to backend
    return `${protocol}//${hostname}`;
  }
  return "";
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
};

export default API_BASE_URL;
