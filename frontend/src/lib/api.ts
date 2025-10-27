import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  // Note: Content-Type is auto-detected by Axios based on request body
  // (e.g., application/json for objects, multipart/form-data for FormData)
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
