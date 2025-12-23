const API_BASE = '/api';
const DEFAULT_TIMEOUT = 10000;

class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const getAuthHeaders = () => {
  const user = localStorage.getItem('user');
  if (user) {
    try {
      const { token } = JSON.parse(user);
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
    } catch (e) {
      // Invalid JSON, clear it
      localStorage.removeItem('user');
    }
  }
  return {};
};

const fetchWithTimeout = async (url, options = {}, timeout = DEFAULT_TIMEOUT) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new ApiError('Request timed out', 408);
    }
    throw error;
  }
};

const handleResponse = async (response) => {
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    // Handle 401 - unauthorized
    if (response.status === 401) {
      localStorage.removeItem('user');
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
    throw new ApiError(
      data?.message || data?.error || `HTTP ${response.status}`,
      response.status,
      data
    );
  }

  return data;
};

const api = {
  async get(endpoint, options = {}) {
    const response = await fetchWithTimeout(`${API_BASE}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...options.headers
      }
    }, options.timeout);
    return handleResponse(response);
  },

  async post(endpoint, body = {}, options = {}) {
    const response = await fetchWithTimeout(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...options.headers
      },
      body: JSON.stringify(body)
    }, options.timeout);
    return handleResponse(response);
  },

  async put(endpoint, body = {}, options = {}) {
    const response = await fetchWithTimeout(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...options.headers
      },
      body: JSON.stringify(body)
    }, options.timeout);
    return handleResponse(response);
  },

  async delete(endpoint, options = {}) {
    const response = await fetchWithTimeout(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...options.headers
      }
    }, options.timeout);
    return handleResponse(response);
  },

  async upload(endpoint, formData, options = {}) {
    const response = await fetchWithTimeout(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders()
        // Don't set Content-Type for FormData
      },
      body: formData
    }, options.timeout || 300000); // 5 min timeout for uploads
    return handleResponse(response);
  }
};

// Conditional logging utility
export const logger = {
  log: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(...args);
    }
  },
  warn: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(...args);
    }
  },
  error: (...args) => {
    // Always log errors, but could send to error tracking service in production
    console.error(...args);
  }
};

export { api, ApiError };
export default api;
