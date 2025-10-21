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

    // Load session hash from localStorage
    this._loadSessionHash();

    // Load teacher base URL from localStorage (for students)
    this._loadTeacherBaseUrl();
  }

  /**
   * Initialize with notebook model
   * @param notebook - Notebook model
   */
  public initialize(notebook: INotebookModel): void {
    this._notebookModel = notebook;
    this._loadNotebookMetadata();

    // If teacher and no session hash exists, create one
    if (this._roleManager.isTeacher() && !this._sessionHash) {
      this.createSession();
    }
  }

  /**
   * Create a new session (Teacher only)
   * @returns Session hash
   */
  public createSession(): string {
    if (!this._roleManager.isTeacher()) {
      console.warn('Code Stream: Only teachers can create sessions');
      return '';
    }

    const hash = generateHash();
    this._sessionHash = hash;

    // Persist to localStorage
    localStorage.setItem(STORAGE_KEYS.SESSION_HASH, hash);

    // Persist to notebook metadata
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

    // Persist to localStorage
    localStorage.setItem(STORAGE_KEYS.SESSION_HASH, hash);

    // Persist to notebook metadata
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
    localStorage.removeItem(STORAGE_KEYS.SESSION_HASH);
    this._sessionChanged.emit(null);

    console.log('Code Stream: Session cleared');
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
   * Load session hash from localStorage
   * @private
   */
  private _loadSessionHash(): void {
    const hash = localStorage.getItem(STORAGE_KEYS.SESSION_HASH);
    if (hash && validateHash(hash)) {
      this._sessionHash = hash;
      console.log(`Code Stream: Loaded session hash from localStorage: ${hash}`);
    }
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

    if (metadata && metadata.session_hash) {
      this._sessionHash = metadata.session_hash;
      console.log(`Code Stream: Loaded session from notebook metadata: ${metadata.session_hash}`);
    }

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
