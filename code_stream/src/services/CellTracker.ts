/**
 * CellTracker - Tracks cell changes and manages sync operations
 * Integrates with JupyterLab notebook cells and triggers sync based on role
 */

import { INotebookModel, CellList } from '@jupyterlab/notebook';
import { Cell, ICellModel } from '@jupyterlab/cells';
import { IObservableList } from '@jupyterlab/observables';
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
    if (!cell || !cell.model || !cell.model.metadata) {
      console.warn('Code Stream: Invalid cell or cell model');
      return '';
    }
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
    // Use sharedModel.getMetadata() for JupyterLab 4.x compatibility
    const allMetadata = cell.model.sharedModel.getMetadata();
    const metadataValue = allMetadata['code_stream'];
    const metadata = metadataValue as ICellMetadata['code_stream'] | undefined;
    return metadata || null;
  }

  /**
   * Update sync enabled state for a cell
   * @param cell - Cell instance
   * @param enabled - Sync enabled state
   */
  public setSyncEnabled(cell: Cell, enabled: boolean): void {
    const cellId = this.getCellId(cell);

    if (!cellId) {
      console.warn('Code Stream: Cannot update sync state - invalid cell ID');
      return;
    }

    const metadata = this.getCellMetadata(cell);

    if (!metadata) {
      console.warn('Code Stream: Cannot update sync state - no metadata found');
      return;
    }

    this._setCellMetadata(cell, {
      ...metadata,
      sync_enabled: enabled
    });

    console.log(`Code Stream: Updated sync_enabled to ${enabled} for cell ${cellId}`);
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
    // Check if cell is valid before attempting to get ID
    if (!cell || !cell.model || !cell.model.metadata) {
      // Cell is already disposed, just clear all handlers
      return;
    }

    const cellId = this.getCellId(cell);

    if (!cellId) {
      return;
    }

    const handler = this._debouncedSyncHandlers.get(cellId);

    if (handler && cell?.model?.contentChanged) {
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

    if (!cellId) {
      console.warn('Code Stream: Cannot sync cell - invalid cell ID');
      return;
    }

    const metadata = this.getCellMetadata(cell);

    if (!metadata) {
      console.warn('Code Stream: Cannot sync cell - no metadata found');
      return;
    }

    if (!metadata.sync_enabled) {
      console.log(`Code Stream: Skipping sync for cell ${cellId} - sync not enabled`);
      return;
    }

    console.log(`Code Stream: Syncing cell ${cellId} to backend...`);

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
   * Get all active cell IDs from current notebook
   * @returns Array of cell IDs that exist in the notebook
   */
  public getAllActiveCellIds(): string[] {
    if (!this._notebookModel) {
      console.warn('Code Stream: Cannot get active cell IDs - no notebook model');
      return [];
    }

    const cellIds: string[] = [];

    for (let i = 0; i < this._notebookModel.cells.length; i++) {
      const cellModel = this._notebookModel.cells.get(i);
      if (cellModel && cellModel.sharedModel) {
        const allMetadata = cellModel.sharedModel.getMetadata();
        const metadataValue = allMetadata['code_stream'];
        const metadata = metadataValue as ICellMetadata['code_stream'] | undefined;

        if (metadata && metadata.cell_id) {
          cellIds.push(metadata.cell_id);
        }
      }
    }

    console.log(`Code Stream: Found ${cellIds.length} active cell IDs in notebook`);
    return cellIds;
  }

  /**
   * Re-sync all cells with sync enabled to backend (Teacher)
   * Used after refreshing session code to repopulate Redis
   * @returns Number of cells synced
   */
  public async resyncAllCells(): Promise<number> {
    if (!this._roleManager.isTeacher()) {
      console.warn('Code Stream: Only teachers can resync cells');
      return 0;
    }

    if (!this._notebookModel) {
      console.warn('Code Stream: Cannot resync cells - no notebook model');
      return 0;
    }

    const sessionHash = this._sessionManager.getSessionHash();
    if (!sessionHash) {
      console.warn('Code Stream: Cannot resync cells - no active session');
      return 0;
    }

    console.log('Code Stream: Starting resync of all cells with sync enabled...');
    let syncedCount = 0;

    for (let i = 0; i < this._notebookModel.cells.length; i++) {
      const cellModel = this._notebookModel.cells.get(i);
      if (cellModel && cellModel.sharedModel) {
        const allMetadata = cellModel.sharedModel.getMetadata();
        const metadataValue = allMetadata['code_stream'];
        const metadata = metadataValue as ICellMetadata['code_stream'] | undefined;

        if (metadata && metadata.sync_enabled && metadata.cell_id) {
          const cellData: ICellData = {
            cell_id: metadata.cell_id,
            cell_content: cellModel.sharedModel.getSource(),
            cell_timestamp: generateTimestamp()
          };

          try {
            await this._sessionManager.syncService.pushCell(sessionHash, cellData);
            console.log(`Code Stream: Resynced cell ${metadata.cell_id}`);
            syncedCount++;
          } catch (error) {
            console.error(`Code Stream: Failed to resync cell ${metadata.cell_id}:`, error);
          }
        }
      }
    }

    console.log(`Code Stream: Resync complete - ${syncedCount} cell(s) synced`);
    return syncedCount;
  }

  /**
   * Initialize metadata for existing cells
   * @private
   */
  private _initializeCellMetadata(): void {
    if (!this._notebookModel) {
      console.warn('Code Stream: Cannot initialize metadata - no notebook model');
      return;
    }

    console.log(`Code Stream: Initializing metadata for ${this._notebookModel.cells.length} existing cell(s)`);
    let initialized = 0;
    let skipped = 0;

    for (let i = 0; i < this._notebookModel.cells.length; i++) {
      const cellModel = this._notebookModel.cells.get(i);
      if (cellModel && cellModel.sharedModel) {
        // Use sharedModel.getMetadata() for JupyterLab 4.x compatibility
        const allMetadata = cellModel.sharedModel.getMetadata();
        const metadataValue = allMetadata['code_stream'];
        const metadata = metadataValue as ICellMetadata['code_stream'] | undefined;

        if (!metadata || !metadata.cell_id) {
          const cellId = generateCellId();
          const newMetadata: ICellMetadata['code_stream'] = {
            cell_id: cellId,
            sync_enabled: false,
            last_synced: null,
            sync_hash: this._sessionManager.getSessionHash() || ''
          };

          // Use sharedModel.setMetadata() for JupyterLab 4.x compatibility
          cellModel.sharedModel.setMetadata({
            ...allMetadata,
            code_stream: newMetadata
          });

          // Verify it was set
          const verifyAllMetadata = cellModel.sharedModel.getMetadata();
          const verify = verifyAllMetadata['code_stream'];
          if (verify) {
            console.log(`Code Stream: Initialized metadata for existing cell ${cellId} at index ${i}`);
            initialized++;
          } else {
            console.warn(`Code Stream: Failed to initialize metadata for cell at index ${i}`);
          }
        } else {
          console.log(`Code Stream: Cell ${metadata.cell_id} at index ${i} already has metadata`);
          skipped++;
        }
      } else {
        console.warn(`Code Stream: Cell at index ${i} has no sharedModel`);
      }
    }

    console.log(`Code Stream: Metadata initialization complete - ${initialized} initialized, ${skipped} skipped`);
  }

  /**
   * Handle cells added/removed
   * @private
   */
  private _onCellsChanged(
    sender: CellList,
    changed: IObservableList.IChangedArgs<ICellModel>
  ): void {
    console.log(`Code Stream: Cells changed - type: ${changed.type}`);

    // Handle cell additions
    if (changed.type === 'add') {
      console.log(`Code Stream: ${changed.newValues.length} new cell(s) added`);

      // Initialize metadata for only the newly added cells
      changed.newValues.forEach((cellModel, index) => {
        if (cellModel && cellModel.sharedModel) {
          // Use sharedModel.getMetadata() for JupyterLab 4.x compatibility
          const allMetadata = cellModel.sharedModel.getMetadata();
          const metadataValue = allMetadata['code_stream'];
          const metadata = metadataValue as ICellMetadata['code_stream'] | undefined;

          if (!metadata || !metadata.cell_id) {
            const cellId = generateCellId();
            const newMetadata: ICellMetadata['code_stream'] = {
              cell_id: cellId,
              sync_enabled: false,
              last_synced: null,
              sync_hash: this._sessionManager.getSessionHash() || ''
            };

            // Use sharedModel.setMetadata() for JupyterLab 4.x compatibility
            cellModel.sharedModel.setMetadata({
              ...allMetadata,
              code_stream: newMetadata
            });

            // Verify it was set
            const verifyAllMetadata = cellModel.sharedModel.getMetadata();
            const verify = verifyAllMetadata['code_stream'];
            if (verify) {
              console.log(`Code Stream: Initialized metadata for new cell ${cellId} at index ${changed.newIndex + index}`);
            } else {
              console.warn(`Code Stream: Failed to initialize metadata for new cell at index ${changed.newIndex + index}`);
            }
          } else {
            console.log(`Code Stream: Cell ${metadata.cell_id} already has metadata`);
          }
        } else {
          console.warn('Code Stream: New cell has no sharedModel');
        }
      });
    } else if (changed.type === 'remove') {
      console.log(`Code Stream: ${changed.oldValues.length} cell(s) removed`);
    }
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
    // Use sharedModel.setMetadata() for JupyterLab 4.x compatibility
    const currentMetadata = cell.model.sharedModel.getMetadata();
    cell.model.sharedModel.setMetadata({
      ...currentMetadata,
      code_stream: metadata
    });

    // Verify the metadata was set
    const verifyAllMetadata = cell.model.sharedModel.getMetadata();
    const verifyMetadata = verifyAllMetadata['code_stream'];
    if (verifyMetadata) {
      console.log(`Code Stream: Successfully set metadata for cell with ID ${metadata?.cell_id}`);
    } else {
      console.warn(`Code Stream: Failed to set metadata for cell with ID ${metadata?.cell_id}`);
    }
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
