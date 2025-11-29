import type { AxiosRequestConfig, AxiosResponse } from "axios";
import { api } from "./api";

/**
 * Custom Axios instance for Orval-generated hooks.
 *
 * This wrapper allows Orval to use our existing configured Axios instance
 * with interceptors, base URL, and error handling.
 *
 * Orval expects a function with this signature:
 * (config: AxiosRequestConfig) => Promise<AxiosResponse<T>>
 */
export const customInstance = <T>(
  config: AxiosRequestConfig
): Promise<AxiosResponse<T>> => api.request<T>(config);

export default customInstance;
