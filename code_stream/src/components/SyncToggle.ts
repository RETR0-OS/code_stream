/**
 * SyncToggle - Toggle button for teachers to enable/disable cell sync
 */

import { ToolbarButton } from '@jupyterlab/apputils';
import { Cell } from '@jupyterlab/cells';
import { SessionManager } from '../services/SessionManager';
import { CellTracker } from '../services/CellTracker';

/**
 * Sync toggle button for teacher cells
 */
export class SyncToggle extends ToolbarButton {
  private _cell: Cell;
  private _sessionManager: SessionManager;
  private _cellTracker: CellTracker;
  private _syncEnabled: boolean = false;

  /**
   * Constructor
   * @param cell - Cell instance
   * @param sessionManager - Session manager instance
   * @param cellTracker - Cell tracker instance
   */
  constructor(
    cell: Cell,
    sessionManager: SessionManager,
    cellTracker: CellTracker
  ) {
    super({
      icon: 'ui-components:link',
      tooltip: 'Sync disabled',
      onClick: () => this._onToggleClick()
    });

    this._cell = cell;
    this._sessionManager = sessionManager;
    this._cellTracker = cellTracker;

    this.addClass('cs-sync-toggle');
    this._updateState();
  }

  /**
   * Handle toggle click
   * @private
   */
  private async _onToggleClick(): Promise<void> {
    this._syncEnabled = !this._syncEnabled;

    const cellId = this._cellTracker.getCellId(this._cell);

    // Update session manager
    await this._sessionManager.toggleSync(cellId, this._syncEnabled);

    // Update cell metadata
    const metadata = this._cellTracker.getCellMetadata(this._cell);
    if (metadata) {
      this._cell.model.metadata['code_stream'] = {
        ...metadata,
        sync_enabled: this._syncEnabled
      };
    }

    if (this._syncEnabled) {
      // Push cell immediately when enabled
      await this._cellTracker.syncCellToBackend(this._cell);

      // Attach listener for auto-sync
      this._cellTracker.attachCellListener(this._cell);
    } else {
      // Delete cell from backend when disabled
      await this._cellTracker.deleteCellFromBackend(this._cell);

      // Detach listener
      this._cellTracker.detachCellListener(this._cell);
    }

    this._updateState();
  }

  /**
   * Update button state based on sync status
   * @private
   */
  private _updateState(): void {
    const metadata = this._cellTracker.getCellMetadata(this._cell);

    if (metadata) {
      this._syncEnabled = metadata.sync_enabled;
    }

    if (this._syncEnabled) {
      this.removeClass('cs-sync-toggle-inactive');
      this.addClass('cs-sync-toggle-active');
      this.node.title = 'Sync enabled - Click to disable';
    } else {
      this.removeClass('cs-sync-toggle-active');
      this.addClass('cs-sync-toggle-inactive');
      this.node.title = 'Sync disabled - Click to enable';
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this._cellTracker.detachCellListener(this._cell);
    super.dispose();
  }
}
