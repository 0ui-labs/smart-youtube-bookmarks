import axios from 'axios'

/**
 * Axios instance configured for the backend API.
 *
 * Base URL is '/api' which is proxied by Vite to http://localhost:8000/api
 * (see vite.config.ts for proxy configuration).
 */
export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Response interceptor for comprehensive error handling.
 *
 * Logs errors with appropriate context:
 * - Server errors (4xx/5xx): logs status, data, and URL
 * - Network errors: logs when request was sent but no response received
 * - Setup errors: logs when request configuration failed
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error status (4xx, 5xx)
      console.error('API Error:', {
        status: error.response.status,
        data: error.response.data,
        url: error.config?.url,
      })
    } else if (error.request) {
      // Request was made but no response received (network error)
      console.error('Network Error:', error.message)
    } else {
      // Error in request setup
      console.error('Request Setup Error:', error.message)
    }
    return Promise.reject(error)
  }
)
