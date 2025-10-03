/**
 * CellTracker - Tracks cell changes and manages sync operations
 * Integrates with JupyterLab notebook cells and triggers sync based on role
 */

import { INotebookModel } from '@jupyterlab/notebook';
import { Cell } from '@jupyterlab/cells';
import { SessionManager } from './SessionManager';
import { RoleManager } from './RoleManager';
import { ICellData, ICellMetadata, DEFAULTS } from '../models/types';
import { generateCellId, generateTimestamp } from '../utils/hashGenerator';
import { debounce } from '../utils/debounce';

/**
 * Tracks cell changes and manages synchronization
 */
export class CellTracker {
  private _sessionManager: SessionManager;
  private _roleManager: RoleManager;
  private _notebookModel: INotebookModel | null = null;
  private _debouncedSyncHandlers: Map<string, (...args: any[]) => void> = new Map();

  /**
   * Constructor
   * @param sessionManager - Session manager instance
   * @param roleManager - Role manager instance
   */
  constructor(sessionManager: SessionManager, roleManager: RoleManager) {
    this._sessionManager = sessionManager;
    this._roleManager = roleManager;
  }

  /**
   * Initialize with notebook model
   * @param notebook - Notebook model
   */
  public initialize(notebook: INotebookModel): void {
    this._notebookModel = notebook;

    // Initialize cell metadata for existing cells
    this._initializeCellMetadata();

    // Listen for new cells
    notebook.cells.changed.connect(this._onCellsChanged, this);
  }

  /**
   * Get or create cell ID from metadata
   * @param cell - Cell instance
   * @returns Cell ID
   */
  public getCellId(cell: Cell): string {
    const metadataValue = cell.model.metadata['code_stream'];
    const metadata = metadataValue as ICellMetadata['code_stream'] | undefined;

    if (metadata && metadata.cell_id) {
      return metadata.cell_id;
    }

    // Generate new cell ID
    const cellId = generateCellId();
    this._setCellMetadata(cell, {
      cell_id: cellId,
      sync_enabled: false,
      last_synced: null,
      sync_hash: this._sessionManager.getSessionHash() || ''
    });

    return cellId;
  }

  /**
   * Get cell metadata
   * @param cell - Cell instance
   * @returns Cell metadata or null
   */
  public getCellMetadata(cell: Cell): ICellMetadata['code_stream'] | null {
    const metadataValue = cell.model.metadata['code_stream'];
    const metadata = metadataValue as ICellMetadata['code_stream'] | undefined;
    return metadata || null;
  }

  /**
   * Attach change listener to cell (Teacher only)
   * @param cell - Cell instance
   */
  public attachCellListener(cell: Cell): void {
    if (!this._roleManager.isTeacher()) {
      return;
    }

    const cellId = this.getCellId(cell);

    // Create debounced sync handler
    const debouncedHandler = debounce(async () => {
      await this._onCellContentChanged(cell);
    }, DEFAULTS.DEBOUNCE_DELAY);

    this._debouncedSyncHandlers.set(cellId, debouncedHandler);

    // Listen to cell content changes
    cell.model.contentChanged.connect(debouncedHandler, this);
  }

  /**
   * Detach change listener from cell
   * @param cell - Cell instance
   */
  public detachCellListener(cell: Cell): void {
    const cellId = this.getCellId(cell);
    const handler = this._debouncedSyncHandlers.get(cellId);

    if (handler) {
      cell.model.contentChanged.disconnect(handler, this);
      this._debouncedSyncHandlers.delete(cellId);
    }
  }

  /**
   * Sync cell content to backend (Teacher)
   * @param cell - Cell instance
   */
  public async syncCellToBackend(cell: Cell): Promise<void> {
    if (!this._roleManager.isTeacher()) {
      console.warn('Code Stream: Only teachers can push cells');
      return;
    }

    const sessionHash = this._sessionManager.getSessionHash();
    if (!sessionHash) {
      console.warn('Code Stream: No active session');
      return;
    }

    const cellId = this.getCellId(cell);
    const metadata = this.getCellMetadata(cell);

    if (!metadata || !metadata.sync_enabled) {
      return;
    }

    const cellData: ICellData = {
      cell_id: cellId,
      cell_content: cell.model.sharedModel.getSource(),
      cell_timestamp: generateTimestamp()
    };

    try {
      await this._sessionManager.syncService.pushCell(sessionHash, cellData);

      // Update last synced timestamp
      this._setCellMetadata(cell, {
        ...metadata,
        last_synced: Date.now()
      });
    } catch (error) {
      console.error('Code Stream: Failed to sync cell:', error);
    }
  }

  /**
   * Update cell content (Teacher - auto-sync on edit)
   * @param cell - Cell instance
   */
  public async updateCell(cell: Cell): Promise<void> {
    if (!this._roleManager.isTeacher()) {
      return;
    }

    const sessionHash = this._sessionManager.getSessionHash();
    if (!sessionHash) {
      return;
    }

    const cellId = this.getCellId(cell);
    const metadata = this.getCellMetadata(cell);

    if (!metadata || !metadata.sync_enabled) {
      return;
    }

    const cellData: ICellData = {
      cell_id: cellId,
      cell_content: cell.model.sharedModel.getSource(),
      cell_timestamp: generateTimestamp()
    };

    try {
      await this._sessionManager.syncService.updateCell(sessionHash, cellData);

      // Update last synced timestamp
      this._setCellMetadata(cell, {
        ...metadata,
        last_synced: Date.now()
      });
    } catch (error) {
      console.error('Code Stream: Failed to update cell:', error);
    }
  }

  /**
   * Request cell sync from backend (Student)
   * @param cell - Cell instance
   * @returns True if successful, false otherwise
   */
  public async requestCellSync(cell: Cell): Promise<boolean> {
    if (!this._roleManager.isStudent()) {
      console.warn('Code Stream: Only students can request sync');
      return false;
    }

    const sessionHash = this._sessionManager.getSessionHash();
    if (!sessionHash) {
      console.warn('Code Stream: No active session');
      return false;
    }

    const cellId = this.getCellId(cell);
    const metadata = this.getCellMetadata(cell);

    if (!metadata) {
      return false;
    }

    try {
      const response = await this._sessionManager.syncService.getCell(
        sessionHash,
        cellId,
        generateTimestamp()
      );

      if (response.status === 'success' && response.data) {
        // Update cell content
        cell.model.sharedModel.setSource(response.data);

        // Update metadata
        this._setCellMetadata(cell, {
          ...metadata,
          last_synced: Date.now()
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error('Code Stream: Failed to request cell sync:', error);
      return false;
    }
  }

  /**
   * Delete cell from backend (Teacher)
   * @param cell - Cell instance
   */
  public async deleteCellFromBackend(cell: Cell): Promise<void> {
    if (!this._roleManager.isTeacher()) {
      return;
    }

    const sessionHash = this._sessionManager.getSessionHash();
    if (!sessionHash) {
      return;
    }

    const cellId = this.getCellId(cell);

    try {
      await this._sessionManager.syncService.deleteCell(
        sessionHash,
        cellId,
        generateTimestamp()
      );
    } catch (error) {
      console.error('Code Stream: Failed to delete cell:', error);
    }
  }

  /**
   * Initialize metadata for existing cells
   * @private
   */
  private _initializeCellMetadata(): void {
    if (!this._notebookModel) {
      return;
    }

    for (let i = 0; i < this._notebookModel.cells.length; i++) {
      const cell = this._notebookModel.cells.get(i);
      if (cell) {
        // Ensure cell has metadata
        this.getCellId({ model: cell } as Cell);
      }
    }
  }

  /**
   * Handle cells added/removed
   * @private
   */
  private _onCellsChanged(): void {
    // Initialize metadata for new cells
    this._initializeCellMetadata();
  }

  /**
   * Handle cell content changed (Teacher auto-sync)
   * @private
   * @param cell - Cell instance
   */
  private async _onCellContentChanged(cell: Cell): Promise<void> {
    if (!this._roleManager.isTeacher()) {
      return;
    }

    await this.updateCell(cell);
  }

  /**
   * Set cell metadata
   * @private
   * @param cell - Cell instance
   * @param metadata - Metadata to set
   */
  private _setCellMetadata(
    cell: Cell,
    metadata: ICellMetadata['code_stream']
  ): void {
    cell.model.metadata['code_stream'] = metadata;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this._notebookModel) {
      this._notebookModel.cells.changed.disconnect(this._onCellsChanged, this);
    }

    // Detach all listeners
    this._debouncedSyncHandlers.clear();
  }
}
