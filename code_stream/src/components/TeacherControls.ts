/**
 * TeacherControls - Manages teacher-specific UI controls
 * Adds sync toggle button to notebook toolbar
 */

import { IDisposable } from '@lumino/disposable';
import { NotebookPanel } from '@jupyterlab/notebook';
import { ToolbarButton } from '@jupyterlab/apputils';
import { SessionManager } from '../services/SessionManager';
import { CellTracker } from '../services/CellTracker';

/**
 * Teacher controls for notebook
 */
export class TeacherControls implements IDisposable {
  private _notebookPanel: NotebookPanel;
  private _sessionManager: SessionManager;
  private _cellTracker: CellTracker;
  private _toggleButton: ToolbarButton;
  private _isDisposed: boolean = false;

  /**
   * Constructor
   * @param notebookPanel - Notebook panel instance
   * @param sessionManager - Session manager instance
   * @param cellTracker - Cell tracker instance
   */
  constructor(
    notebookPanel: NotebookPanel,
    sessionManager: SessionManager,
    cellTracker: CellTracker
  ) {
    this._notebookPanel = notebookPanel;
    this._sessionManager = sessionManager;
    this._cellTracker = cellTracker;

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
  }

  /**
   * Handle toggle button click
   * @private
   */
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
    (activeCell.model.metadata.set as any)('code_stream', {
      ...metadata,
      sync_enabled: newSyncState
    });

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

    // Disconnect signals
    this._notebookPanel.content.activeCellChanged.disconnect(
      this._updateButtonState,
      this
    );

    // Dispose button
    this._toggleButton.dispose();

    this._isDisposed = true;
  }
}
