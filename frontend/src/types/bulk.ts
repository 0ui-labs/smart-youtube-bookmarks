// frontend/src/types/bulk.ts

/**
 * Result of a single tag update operation
 */
export interface TagUpdateResult {
  tagId: string
  tagName: string
  success: boolean
  error?: string
}

/**
 * Bulk schema application request
 */
export interface BulkApplySchemaRequest {
  tagIds: string[]
  schemaId: string | null // null = unbind schema
}

/**
 * Bulk schema application response
 */
export interface BulkApplySchemaResponse {
  successCount: number
  failureCount: number
  totalRequested: number
  results: TagUpdateResult[]
}

/**
 * Bulk operation state for UI
 */
export interface BulkOperationState {
  isRunning: boolean
  progress: number // 0-100
  currentTag?: string
  completed: number
  total: number
}
