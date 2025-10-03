/**
 * Type definitions for Code Stream extension
 */

/**
 * User role types
 */
export type UserRole = 'teacher' | 'student';

/**
 * Cell sync state
 */
export interface ICellSyncState {
  cell_id: string;
  sync_enabled: boolean;
  last_synced: number | null;
  sync_hash: string;
}

/**
 * Cell metadata stored in notebook
 */
export interface ICellMetadata {
  code_stream?: {
    cell_id: string;
    sync_enabled: boolean;
    last_synced: number | null;
    sync_hash: string;
  };
}

/**
 * Notebook metadata stored in notebook file
 */
export interface INotebookMetadata {
  code_stream?: {
    session_hash: string;
    created_at: number;
  };
}

/**
 * Cell data for API requests
 */
export interface ICellData {
  cell_id: string;
  cell_content: string;
  cell_timestamp: string;
}

/**
 * API response for push cell
 */
export interface IPushCellResponse {
  status: 'success' | 'error';
  message: string;
}

/**
 * API response for get cell
 */
export interface IGetCellResponse {
  status: 'success' | 'error';
  data?: any;
  message?: string;
}

/**
 * API response for update cell
 */
export interface IUpdateCellResponse {
  status: 'success' | 'error';
  message: string;
}

/**
 * API response for delete cell
 */
export interface IDeleteCellResponse {
  status: 'success' | 'error';
  message: string;
}

/**
 * Sync button state
 */
export enum SyncButtonState {
  Default = 'default',
  Syncing = 'syncing',
  Success = 'success',
  Error = 'error'
}

/**
 * Session information
 */
export interface ISessionInfo {
  session_hash: string;
  role: UserRole;
  created_at: number;
}

/**
 * localStorage keys
 */
export const STORAGE_KEYS = {
  ROLE: 'code_stream_role',
  SESSION_HASH: 'code_stream_session_hash'
} as const;

/**
 * Default values
 */
export const DEFAULTS = {
  ROLE: 'student' as UserRole,
  DEBOUNCE_DELAY: 2000, // 2 seconds
  SUCCESS_DISPLAY_DURATION: 2000, // 2 seconds
  HASH_LENGTH: 6
} as const;
