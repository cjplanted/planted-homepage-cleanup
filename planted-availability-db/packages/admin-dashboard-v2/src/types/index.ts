/**
 * Common Types for Admin Dashboard v2
 *
 * This file contains type definitions used across the dashboard.
 * Import types from @pad/core for shared types with the API.
 */

/**
 * Status Types
 */
export type Status = 'idle' | 'pending' | 'processing' | 'completed' | 'failed';

export type SyncStatus = 'not_started' | 'syncing' | 'completed' | 'failed';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

/**
 * API Response Wrappers
 */
export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

export type ApiResult<T = unknown> = ApiSuccess<T> | ApiError;

/**
 * Pagination
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedData<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  totalPages: number;
}

/**
 * Filter Types
 */
export interface DateRange {
  start: Date | string;
  end: Date | string;
}

export interface FilterOptions {
  search?: string;
  status?: Status | Status[];
  dateRange?: DateRange;
  tags?: string[];
}

/**
 * Component Props Helpers
 */
export interface WithClassName {
  className?: string;
}

export interface WithChildren {
  children?: React.ReactNode;
}

export interface WithLoading {
  loading?: boolean;
}

export interface WithError {
  error?: Error | string | null;
}

/**
 * Form Types
 */
export interface FormState<T = unknown> {
  data: T;
  errors: Partial<Record<keyof T, string>>;
  isSubmitting: boolean;
  isDirty: boolean;
}

/**
 * Table Types
 */
export interface TableColumn<T = unknown> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
}

export interface TableProps<T = unknown> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

/**
 * Modal/Dialog Types
 */
export interface DialogState {
  open: boolean;
  title?: string;
  description?: string;
  content?: React.ReactNode;
}

/**
 * Notification Types
 */
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  timestamp: Date;
}

/**
 * Type Guards
 */
export function isApiSuccess<T>(result: ApiResult<T>): result is ApiSuccess<T> {
  return result.success === true;
}

export function isApiError(result: ApiResult): result is ApiError {
  return result.success === false;
}

/**
 * Utility Types
 */
export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type Awaitable<T> = T | Promise<T>;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
