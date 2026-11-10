import axios, { type InternalAxiosRequestConfig } from "axios";
import type { AnalyticsResponse } from "@/types/analytics";
import { prepareSessionRequest } from "./sessionTransport";

/**
 * Axios instance configured for the backend API.
 *
 * Base URL is '/api' which is proxied by Vite to http://localhost:8000/api
 * (see vite.config.ts for proxy configuration).
 *
 * Note: Content-Type is auto-detected by Axios based on request body type:
 * - Objects/Arrays: application/json
 * - FormData: multipart/form-data
 * - URLSearchParams: application/x-www-form-urlencoded
 */
export const api = axios.create({
  baseURL: "/api",
});

type SessionRequestConfig = InternalAxiosRequestConfig & {
  sessionRelease?: () => void;
  sessionCurrent?: () => boolean;
  sessionRefreshed?: boolean;
};
api.interceptors.request.use(async (configuration) => {
  const config = configuration as SessionRequestConfig;
  const request = await prepareSessionRequest(
    config.sessionRefreshed,
    config.signal as AbortSignal | undefined
  );
  if (request.token)
    config.headers.set("Authorization", `Bearer ${request.token}`);
  config.signal = request.signal;
  config.sessionRelease = request.release;
  config.sessionCurrent = request.isCurrent;
  return config;
});
api.interceptors.response.use(
  (response) => {
    const config = response.config as SessionRequestConfig;
    config.sessionRelease?.();
    if (config.sessionCurrent && !config.sessionCurrent())
      throw new DOMException("Session changed", "AbortError");
    return response;
  },
  async (error) => {
    const config = error.config as SessionRequestConfig | undefined;
    config?.sessionRelease?.();
    if (config?.sessionCurrent && !config.sessionCurrent())
      throw new DOMException("Session changed", "AbortError");
    if (
      error.response?.status === 401 &&
      config &&
      !config.sessionRefreshed &&
      config.headers.has("Authorization")
    ) {
      config.sessionRefreshed = true;
      return api.request(config);
    }
    // Application error handlers must not accidentally log bearer credentials.
    config?.headers.delete("Authorization");
    return Promise.reject(error);
  }
);

/**
 * Response interceptor for comprehensive error handling.
 *
 * Handles specific HTTP error codes:
 * - 401 Unauthorized: Redirect to login (future auth implementation)
 * - 403 Forbidden: User doesn't have permission
 * - 404 Not Found: Resource doesn't exist
 * - 500 Internal Server Error: Server-side error
 * - Network errors: Request sent but no response received
 * - Setup errors: Request configuration failed
 *
 * Global error handling ensures consistent behavior across all API calls.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error status (4xx, 5xx)
      const status = error.response.status;
      const url = error.config?.url;

      console.error("API Error:", {
        status,
        data: error.response.data,
        url,
      });

      // Handle specific error codes
      switch (status) {
        case 401:
          // Unauthorized - redirect to login page (when auth is implemented)
          console.warn("Unauthorized access - authentication required");
          // TODO: Implement authentication and redirect
          // window.location.href = '/login'
          break;

        case 403:
          // Forbidden - user doesn't have permission
          console.error("Forbidden - insufficient permissions for:", url);
          break;

        case 404:
          // Not Found - resource doesn't exist
          console.warn("Resource not found:", url);
          break;

        case 500:
        case 502:
        case 503:
          // Server errors
          console.error("Server error:", status, "-", url);
          // TODO: Show global error toast/notification
          break;

        default:
          // Other client/server errors
          console.error("Unexpected error status:", status);
      }
    } else if (error.request) {
      // Request was made but no response received (network error)
      console.error("Network Error:", error.message);
      // TODO: Show "No internet connection" notification
    } else {
      // Error in request setup
      console.error("Request Setup Error:", error.message);
    }

    return Promise.reject(error);
  }
);

/**
 * Get analytics for custom fields usage in a list.
 *
 * @param listId - UUID of the bookmark list
 * @returns Analytics data with all metrics
 */
export const getAnalytics = async (
  listId: string
): Promise<AnalyticsResponse> => {
  const { data } = await api.get<AnalyticsResponse>(
    `/lists/${listId}/analytics`
  );
  return data;
};
