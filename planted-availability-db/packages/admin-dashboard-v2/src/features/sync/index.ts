/**
 * Sync Feature
 *
 * Export all sync feature modules.
 */

// Types - export with explicit names to avoid conflicts
export type {
  SyncChangeType,
  SyncStatus,
  SyncItemType,
  FieldDiff,
  DishDiff,
  SyncItem,
  SyncPreview,
  SyncRequest,
  SyncProgressEvent,
  SyncResult,
  SyncHistoryEntry,
  SyncHistoryResponse,
  SyncStats,
} from './types';
export {
  CHANGE_TYPE_LABELS,
  CHANGE_TYPE_EMOJIS,
  CHANGE_TYPE_COLORS,
  SYNC_STATUS_LABELS,
  SYNC_STATUS_EMOJIS,
} from './types';

// API
export * from './api/syncApi';

// Hooks
export * from './hooks/useSyncPreview';
export * from './hooks/useSync';
export * from './hooks/useSyncHistory';

// Components - rename to avoid conflict with types
export { SyncPreview as SyncPreviewComponent } from './components/SyncPreview';
export { SyncDiff } from './components/SyncDiff';
export { SyncProgress } from './components/SyncProgress';
export { SyncHistory as SyncHistoryComponent } from './components/SyncHistory';
