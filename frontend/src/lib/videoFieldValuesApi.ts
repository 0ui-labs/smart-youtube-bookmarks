import type {
  BatchUpdateFieldValuesResponse,
  FieldValueUpdate,
  VideoFieldValue,
  VideoResponse,
} from "@/types/video";
import { api } from "./api";

/**
 * API client for video field values.
 *
 * Endpoints from Task #71 (GET) and Task #72 (PUT).
 */
export const videoFieldValuesApi = {
  /**
   * Get all field values for a video.
   *
   * Uses the video endpoint which includes field_values (Task #71).
   * Extracts only field_values from the full video response.
   *
   * @param videoId - Video UUID
   * @returns Field values array with field metadata
   */
  async getFieldValues(videoId: string): Promise<VideoFieldValue[]> {
    const { data } = await api.get<VideoResponse>(`/videos/${videoId}`);
    return data.field_values || [];
  },

  /**
   * Batch update field values for a video.
   * Backend expects: { field_values: FieldValueUpdate[] }
   *
   * @param videoId - Video UUID
   * @param updates - Array of field value updates
   * @returns Updated field values with metadata
   */
  async updateFieldValues(
    videoId: string,
    updates: FieldValueUpdate[]
  ): Promise<BatchUpdateFieldValuesResponse> {
    const { data } = await api.put<BatchUpdateFieldValuesResponse>(
      `/videos/${videoId}/fields`,
      { field_values: updates } // Backend expects this shape
    );
    return data;
  },
};
