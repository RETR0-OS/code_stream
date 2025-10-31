/**
 * SessionManager - Manages session state and cell sync states
 * Handles session hash, cell sync states, and notebook metadata persistence
 */

import { ISignal, Signal } from '@lumino/signaling';
import { INotebookModel } from '@jupyterlab/notebook';
import { RoleManager } from './RoleManager';
import { SyncService } from './SyncService';
import {
  ICellSyncState,
  INotebookMetadata,
  ISessionInfo,
  STORAGE_KEYS
} from '../models/types';
import { generateHash, validateHash } from '../utils/hashGenerator';

/**
 * Manages session state and synchronization
 */
export class SessionManager {
  private _roleManager: RoleManager;
  private _syncService: SyncService;
  private _sessionHash: string | null = null;
  private _teacherBaseUrl: string | null = null;
  private _cellStates: Map<string, ICellSyncState> = new Map();
  private _notebookModel: INotebookModel | null = null;
  private _sessionChanged = new Signal<this, string | null>(this);
  private _cellStateChanged = new Signal<this, ICellSyncState>(this);
  private _teacherBaseUrlChanged = new Signal<this, string | null>(this);

  /**
   * Constructor
   * @param roleManager - Role manager instance
   * @param syncService - Sync service instance
   */
  constructor(roleManager: RoleManager, syncService: SyncService) {
    this._roleManager = roleManager;
    this._syncService = syncService;

    // NOTE: Session hash is NOT loaded from localStorage - it must be created fresh each time
    // Only load teacher base URL for students (display/connection purposes)
    this._loadTeacherBaseUrl();
  }

  /**
   * Initialize with notebook model
   * @param notebook - Notebook model
   */
  public initialize(notebook: INotebookModel): void {
    this._notebookModel = notebook;
    // NOTE: We load notebook metadata for reference only, but do NOT auto-load session hash
    // Teachers must explicitly create a new session each time
  }

  /**
   * Create a new session (Teacher only)
   * Clears all Redis data before creating the new session
   * @returns Session hash
   */
  public async createSession(): Promise<string> {
    if (!this._roleManager.isTeacher()) {
      console.warn('Code Stream: Only teachers can create sessions');
      return '';
    }

    // Clear all Redis data before creating new session
    try {
      const result = await this._syncService.clearAllRedisData();
      console.log(`Code Stream: Cleared ${result.deleted_count} Redis keys before creating new session`);
    } catch (error) {
      console.error('Code Stream: Failed to clear Redis data:', error);
      // Continue anyway - this is not fatal
    }

    const hash = generateHash();
    this._sessionHash = hash;

    // Persist to notebook metadata only (NOT localStorage)
    this._saveNotebookMetadata();

    this._sessionChanged.emit(hash);

    console.log(`Code Stream: Created new session: ${hash}`);
    return hash;
  }

  /**
   * Join an existing session (Student only)
   * @param hash - Session hash to join
   * @returns True if successful, false otherwise
   */
  public joinSession(hash: string): boolean {
    if (!this._roleManager.isStudent()) {
      console.warn('Code Stream: Only students can join sessions');
      return false;
    }

    if (!validateHash(hash)) {
      console.warn('Code Stream: Invalid session hash format');
      return false;
    }

    this._sessionHash = hash;

    // Persist to notebook metadata only (NOT localStorage)
    this._saveNotebookMetadata();

    this._sessionChanged.emit(hash);

    console.log(`Code Stream: Joined session: ${hash}`);
    return true;
  }

  /**
   * Get current session hash
   * @returns Session hash or null
   */
  public getSessionHash(): string | null {
    return this._sessionHash;
  }

  /**
   * Get session info
   * @returns Session information
   */
  public getSessionInfo(): ISessionInfo | null {
    if (!this._sessionHash) {
      return null;
    }

    return {
      session_hash: this._sessionHash,
      role: this._roleManager.getRole(),
      created_at: Date.now()
    };
  }

  /**
   * Toggle sync for a specific cell (Teacher only)
   * @param cellId - Cell identifier
   * @param enabled - Sync enabled state
   */
  public async toggleSync(cellId: string, enabled: boolean): Promise<void> {
    if (!this._roleManager.isTeacher()) {
      console.warn('Code Stream: Only teachers can toggle sync');
      return;
    }

    if (!this._sessionHash) {
      console.warn('Code Stream: No active session');
      return;
    }

    const state: ICellSyncState = {
      cell_id: cellId,
      sync_enabled: enabled,
      last_synced: Date.now(),
      sync_hash: this._sessionHash
    };

    this._cellStates.set(cellId, state);
    this._cellStateChanged.emit(state);

    console.log(`Code Stream: Toggled sync for cell ${cellId}: ${enabled}`);
  }

  /**
   * Get cell sync state
   * @param cellId - Cell identifier
   * @returns Cell sync state or null
   */
  public getCellState(cellId: string): ICellSyncState | null {
    return this._cellStates.get(cellId) || null;
  }

  /**
   * Check if cell sync is enabled
   * @param cellId - Cell identifier
   * @returns True if enabled, false otherwise
   */
  public isCellSyncEnabled(cellId: string): boolean {
    const state = this._cellStates.get(cellId);
    return state ? state.sync_enabled : false;
  }

  /**
   * Clear session
   */
  public clearSession(): void {
    this._sessionHash = null;
    this._cellStates.clear();
    this._sessionChanged.emit(null);

    console.log('Code Stream: Session cleared');
  }

  /**
   * Refresh session code (Teacher only)
   * Generates a new session code, clears Redis, and updates metadata
   * Note: Caller is responsible for re-syncing cells via CellTracker.resyncAllCells()
   * @returns New session hash
   */
  public async refreshSessionCode(): Promise<string> {
    if (!this._roleManager.isTeacher()) {
      console.warn('Code Stream: Only teachers can refresh session code');
      return '';
    }

    const oldHash = this._sessionHash;

    // Clear all Redis data
    try {
      const result = await this._syncService.clearAllRedisData();
      console.log(`Code Stream: Cleared ${result.deleted_count} Redis keys for session refresh`);
    } catch (error) {
      console.error('Code Stream: Failed to clear Redis data:', error);
      throw error;
    }

    // Generate new session hash
    const hash = generateHash();
    this._sessionHash = hash;

    // Update notebook metadata
    this._saveNotebookMetadata();

    this._sessionChanged.emit(hash);

    console.log(`Code Stream: Refreshed session code from ${oldHash} to ${hash}`);
    return hash;
  }

  /**
   * Clean up orphan cells from Redis (Teacher only)
   * Removes cells that exist in Redis but not in the provided list of valid cell IDs
   * @param validCellIds - Array of cell IDs currently in the notebook
   * @returns Number of orphan cells deleted
   */
  public async cleanupOrphanCells(validCellIds: string[]): Promise<number> {
    if (!this._roleManager.isTeacher()) {
      console.warn('Code Stream: Only teachers can cleanup orphan cells');
      return 0;
    }

    const sessionHash = this._sessionHash;
    if (!sessionHash) {
      console.warn('Code Stream: No active session for orphan cleanup');
      return 0;
    }

    try {
      const result = await this._syncService.cleanupOrphanCells(sessionHash, validCellIds);
      console.log(`Code Stream: Cleaned up ${result.deleted_count} orphan cells`);
      return result.deleted_count;
    } catch (error) {
      console.error('Code Stream: Failed to cleanup orphan cells:', error);
      throw error;
    }
  }

  /**
   * Signal emitted when session changes
   */
  public get sessionChanged(): ISignal<this, string | null> {
    return this._sessionChanged;
  }

  /**
   * Signal emitted when cell state changes
   */
  public get cellStateChanged(): ISignal<this, ICellSyncState> {
    return this._cellStateChanged;
  }

  /**
   * Get sync service instance
   */
  public get syncService(): SyncService {
    return this._syncService;
  }

  /**
   * Get teacher base URL (Student)
   * @returns Teacher base URL or null
   */
  public getTeacherBaseUrl(): string | null {
    return this._teacherBaseUrl;
  }

  /**
   * Set teacher base URL (Student only)
   * @param url - Teacher server base URL
   */
  public setTeacherBaseUrl(url: string): void {
    if (!this._roleManager.isStudent()) {
      console.warn('Code Stream: Only students can set teacher base URL');
      return;
    }

    this._teacherBaseUrl = url;

    // Persist to localStorage (for display/reuse)
    localStorage.setItem(STORAGE_KEYS.TEACHER_BASE_URL, url);

    // Optionally persist to notebook metadata (for display only)
    this._saveNotebookMetadata();

    this._teacherBaseUrlChanged.emit(url);

    console.log(`Code Stream: Set teacher base URL: ${url}`);
  }

  /**
   * Clear teacher base URL (Student)
   */
  public clearTeacherBaseUrl(): void {
    this._teacherBaseUrl = null;
    localStorage.removeItem(STORAGE_KEYS.TEACHER_BASE_URL);
    this._teacherBaseUrlChanged.emit(null);

    console.log('Code Stream: Cleared teacher base URL');
  }

  /**
   * Signal emitted when teacher base URL changes
   */
  public get teacherBaseUrlChanged(): ISignal<this, string | null> {
    return this._teacherBaseUrlChanged;
  }

  /**
   * Load teacher base URL from localStorage
   * @private
   */
  private _loadTeacherBaseUrl(): void {
    const url = localStorage.getItem(STORAGE_KEYS.TEACHER_BASE_URL);
    if (url) {
      this._teacherBaseUrl = url;
      console.log(`Code Stream: Loaded teacher base URL from localStorage: ${url}`);
    }
  }

  /**
   * Load notebook metadata
   * NOTE: This method is kept for reference but does NOT load session hash
   * Session hash must be created/joined explicitly
   * @private
   */
  private _loadNotebookMetadata(): void {
    if (!this._notebookModel) {
      return;
    }

    let metadataValue: unknown = undefined;
    if (
      this._notebookModel &&
      this._notebookModel.metadata &&
      typeof (this._notebookModel.metadata as any).get === 'function'
    ) {
      metadataValue = (this._notebookModel.metadata as any).get('code_stream');
    }
    const metadata = metadataValue as INotebookMetadata['code_stream'] | undefined;

    // NOTE: We do NOT load session_hash from metadata anymore
    // Teachers must create a new session, students must join explicitly

    // Load teacher base URL from notebook metadata (students only, for display)
    if (metadata && metadata.teacher_base_url && this._roleManager.isStudent()) {
      this._teacherBaseUrl = metadata.teacher_base_url;
      console.log(`Code Stream: Loaded teacher base URL from notebook metadata: ${metadata.teacher_base_url}`);
    }
  }

  /**
   * Save notebook metadata
   * @private
   */
  private _saveNotebookMetadata(): void {
    if (!this._notebookModel || !this._sessionHash) {
      return;
    }

    const metadata: INotebookMetadata['code_stream'] = {
      session_hash: this._sessionHash,
      created_at: Date.now()
    };

    // Include teacher_base_url if student and URL is set (for display only, never token)
    if (this._roleManager.isStudent() && this._teacherBaseUrl) {
      metadata.teacher_base_url = this._teacherBaseUrl;
    }

    this._notebookModel.setMetadata('code_stream', metadata);
    console.log('Code Stream: Saved session to notebook metadata');
  }
}
