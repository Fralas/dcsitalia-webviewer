/**
 * API utility for making authenticated requests
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Get stored JWT token
 */
export function getToken() {
  return localStorage.getItem('admin_token');
}

/**
 * Store JWT token
 */
export function setToken(token) {
  localStorage.setItem('admin_token', token);
}

/**
 * Remove JWT token
 */
export function removeToken() {
  localStorage.removeItem('admin_token');
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
  return !!getToken();
}

/**
 * Make authenticated API request
 * @param {string} endpoint - API endpoint (without /api prefix)
 * @param {object} options - Fetch options
 * @returns {Promise} Response data
 */
export async function apiRequest(endpoint, options = {}) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized - token expired or invalid
  if (response.status === 401 || response.status === 403) {
    removeToken();
    throw new Error('Session expired. Please login again.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || error.error || 'Request failed');
  }

  return response.json();
}

/**
 * Login and get JWT token
 */
export async function login(password) {
  const response = await fetch(`${API_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  const data = await response.json();

  if (response.ok && data.success) {
    setToken(data.token);
    return { success: true };
  }

  throw new Error(data.message || 'Login failed');
}

/**
 * Logout
 */
export function logout() {
  removeToken();
}
