/** Stable video-hook imports; queries and mutations live in focused modules. */
export { videoKeys } from "@/lib/videoKeys";
export {
  useAssignTags,
  useBulkUploadVideos,
  useCreateVideo,
  useDeleteVideo,
  useSetVideoCategory,
  useUpdateVideoFieldValues,
} from "./videos/mutations";
export { useVideos } from "./videos/queries";
export { exportVideosCSV, parseValidationError } from "./videos/transfer";
export type {
  BatchUpdateFieldValuesRequest,
  BatchUpdateFieldValuesResponse,
  BulkUploadFailure,
  BulkUploadResponse,
  FieldValueUpdate,
  SetCategoryParams,
  SetCategoryResponse,
  UseVideosOptions,
  VideoFieldValueResponse,
} from "./videos/types";
