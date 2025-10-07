/**
 * TeacherControls - Manages teacher-specific UI controls
 * Adds sync toggle button to notebook toolbar
 */

import { IDisposable } from '@lumino/disposable';
// import { NotebookPanel } from '@jupyterlab/notebook'; // Removed: No longer using notebook panel
// import { ToolbarButton } from '@jupyterlab/apputils'; // Removed: No longer using toolbar button
// import { SessionManager } from '../services/SessionManager'; // Removed: No longer needed here
// import { CellTracker } from '../services/CellTracker'; // Removed: No longer needed here

/**
 * Teacher controls for notebook
 *
 * NOTE: This class is currently minimal as the main toolbar button has been moved
 * to per-cell toolbar buttons (SyncToggle). It's kept for potential future
 * session-level features or notebook-wide controls.
 */
export class TeacherControls implements IDisposable {
  // All properties removed - now using per-cell SyncToggle buttons
  // private _notebookPanel: NotebookPanel;
  // private _sessionManager: SessionManager;
  // private _cellTracker: CellTracker;
  // private _toggleButton: ToolbarButton;
  private _isDisposed: boolean = false;

  /**
   * Constructor
   * @param notebookPanel - Notebook panel instance (kept for compatibility)
   * @param sessionManager - Session manager instance (kept for compatibility)
   * @param cellTracker - Cell tracker instance (kept for compatibility)
   */
  constructor(
    notebookPanel: any,
    sessionManager: any,
    cellTracker: any
  ) {
    // Parameters kept for backward compatibility but not used
    // All functionality moved to per-cell SyncToggle buttons

    // NOTE: Main toolbar button removed - now using per-cell toolbar buttons (SyncToggle)
    // Each cell has its own sync toggle button in its toolbar, allowing teachers to
    // enable/disable sync for individual cells independently

    /* REMOVED: Main toolbar button (lines 37-60)
    // Create toggle button
    this._toggleButton = new ToolbarButton({
      icon: 'ui-components:link',
      tooltip: 'Toggle sync for active cell',
      onClick: () => this._onToggleClick()
    });

    this._toggleButton.addClass('cs-teacher-sync-toggle');

    // Add to notebook toolbar
    this._notebookPanel.toolbar.insertAfter(
      'cellType',
      'codeStreamSync',
      this._toggleButton
    );

    // Listen for active cell changes to update button state
    this._notebookPanel.content.activeCellChanged.connect(
      this._updateButtonState,
      this
    );

    // Initial state update
    this._updateButtonState();
    */
  }

  /* REMOVED: Main toolbar button methods (now handled by per-cell SyncToggle buttons)
  /**
   * Handle toggle button click
   * @private
   */
  /*
  private async _onToggleClick(): Promise<void> {
    const activeCell = this._notebookPanel.content.activeCell;
    if (!activeCell) {
      return;
    }

    const cellId = this._cellTracker.getCellId(activeCell);
    const metadata = this._cellTracker.getCellMetadata(activeCell);

    if (!metadata) {
      return;
    }

    const newSyncState = !metadata.sync_enabled;

    // Update session manager
    await this._sessionManager.toggleSync(cellId, newSyncState);

    // Update cell metadata
    activeCell.model.metadata['code_stream'] = {
      ...metadata,
      sync_enabled: newSyncState
    };

    if (newSyncState) {
      // Push cell immediately when enabled
      await this._cellTracker.syncCellToBackend(activeCell);

      // Attach listener for auto-sync
      this._cellTracker.attachCellListener(activeCell);

      // Add visual indicator
      activeCell.node.classList.add('cs-cell-synced');
    } else {
      // Delete cell from backend when disabled
      await this._cellTracker.deleteCellFromBackend(activeCell);

      // Detach listener
      this._cellTracker.detachCellListener(activeCell);

      // Remove visual indicator
      activeCell.node.classList.remove('cs-cell-synced');
    }

    // Update button state
    this._updateButtonState();
  }

  /**
   * Update button state based on active cell
   * @private
   */
  /*
  private _updateButtonState(): void {
    const activeCell = this._notebookPanel.content.activeCell;

    if (!activeCell) {
      this._toggleButton.removeClass('cs-sync-active');
      this._toggleButton.addClass('cs-sync-inactive');
      this._toggleButton.node.title = 'No active cell';
      return;
    }

    const metadata = this._cellTracker.getCellMetadata(activeCell);

    if (metadata && metadata.sync_enabled) {
      this._toggleButton.removeClass('cs-sync-inactive');
      this._toggleButton.addClass('cs-sync-active');
      this._toggleButton.node.title = 'Sync enabled - Click to disable';
    } else {
      this._toggleButton.removeClass('cs-sync-active');
      this._toggleButton.addClass('cs-sync-inactive');
      this._toggleButton.node.title = 'Sync disabled - Click to enable';
    }
  }
  */

  /**
   * Check if disposed
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this._isDisposed) {
      return;
    }

    /* REMOVED: Main toolbar button cleanup
    // Disconnect signals
    this._notebookPanel.content.activeCellChanged.disconnect(
      this._updateButtonState,
      this
    );

    // Dispose button
    this._toggleButton.dispose();
    */

    this._isDisposed = true;
  }
}
