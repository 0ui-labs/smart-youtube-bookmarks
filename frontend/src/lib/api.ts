import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log errors for debugging
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)
