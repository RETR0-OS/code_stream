/**
 * StudentControls - Manages student-specific UI controls
 *
 * NOTE: This class is currently minimal as the main toolbar button has been moved
 * to per-cell toolbar buttons (UpdateIcon). It's kept for potential future
 * session-level features or notebook-wide controls.
 */

import { IDisposable } from '@lumino/disposable';
// import { NotebookPanel } from '@jupyterlab/notebook'; // Removed: No longer using notebook panel
// import { ToolbarButton } from '@jupyterlab/apputils'; // Removed: No longer using toolbar button
// import { CellTracker } from '../services/CellTracker'; // Removed: No longer needed here
// import { SyncButtonState, DEFAULTS } from '../models/types'; // Removed: No longer needed here

/**
 * Student controls for notebook
 *
 * NOTE: This class is currently minimal as the main toolbar button has been moved
 * to per-cell toolbar buttons (UpdateIcon). It's kept for potential future
 * session-level features or notebook-wide controls.
 */
export class StudentControls implements IDisposable {
  // All properties removed - now using per-cell UpdateIcon buttons
  // private _notebookPanel: NotebookPanel;
  // private _cellTracker: CellTracker;
  // private _updateButton: ToolbarButton;
  // private _state: SyncButtonState = SyncButtonState.Default;
  private _isDisposed: boolean = false;

  /**
   * Constructor
   * @param notebookPanel - Notebook panel instance (kept for compatibility)
   * @param cellTracker - Cell tracker instance (kept for compatibility)
   */
  constructor(notebookPanel: any, cellTracker: any) {
    // Parameters kept for backward compatibility but not used
    // All functionality moved to per-cell UpdateIcon buttons

    // NOTE: Main toolbar button removed - now using per-cell toolbar buttons (UpdateIcon)
    // Each cell has its own sync/update button in its toolbar, allowing students to
    // sync individual cells from the teacher independently

    /* REMOVED: Main toolbar button (lines 32-49)
    // Create update button
    this._updateButton = new ToolbarButton({
      icon: 'ui-components:refresh',
      tooltip: 'Sync active cell from teacher',
      onClick: () => this._onUpdateClick()
    });

    this._updateButton.addClass('cs-student-update-button');

    // Add to notebook toolbar
    this._notebookPanel.toolbar.insertAfter(
      'cellType',
      'codeStreamUpdate',
      this._updateButton
    );

    // Initial state
    this._updateState(SyncButtonState.Default);
    */
  }

  /* REMOVED: Main toolbar button methods (now handled by per-cell UpdateIcon buttons)
  /**
   * Handle update button click
   * @private
   */
  /*
  private async _onUpdateClick(): Promise<void> {
    if (this._state === SyncButtonState.Syncing) {
      // Already syncing, ignore
      return;
    }

    const activeCell = this._notebookPanel.content.activeCell;
    if (!activeCell) {
      return;
    }

    this._updateState(SyncButtonState.Syncing);

    try {
      const success = await this._cellTracker.requestCellSync(activeCell);

      if (success) {
        this._updateState(SyncButtonState.Success);

        // Return to default state after delay
        setTimeout(() => {
          this._updateState(SyncButtonState.Default);
        }, DEFAULTS.SUCCESS_DISPLAY_DURATION);
      } else {
        this._updateState(SyncButtonState.Error);

        // Return to default state after delay
        setTimeout(() => {
          this._updateState(SyncButtonState.Default);
        }, DEFAULTS.SUCCESS_DISPLAY_DURATION);
      }
    } catch (error) {
      console.error('Code Stream: Error syncing cell:', error);
      this._updateState(SyncButtonState.Error);

      // Return to default state after delay
      setTimeout(() => {
        this._updateState(SyncButtonState.Default);
      }, DEFAULTS.SUCCESS_DISPLAY_DURATION);
    }
  }

  /**
   * Update button state
   * @private
   * @param state - New state
   */
  /*
  private _updateState(state: SyncButtonState): void {
    this._state = state;

    // Remove all state classes
    this._updateButton.removeClass('cs-update-default');
    this._updateButton.removeClass('cs-update-syncing');
    this._updateButton.removeClass('cs-update-success');
    this._updateButton.removeClass('cs-update-error');

    // Add new state class
    switch (state) {
      case SyncButtonState.Default:
        this._updateButton.addClass('cs-update-default');
        this._updateButton.node.title = 'Sync active cell from teacher';
        break;

      case SyncButtonState.Syncing:
        this._updateButton.addClass('cs-update-syncing');
        this._updateButton.node.title = 'Syncing...';
        break;

      case SyncButtonState.Success:
        this._updateButton.addClass('cs-update-success');
        this._updateButton.node.title = 'Synced successfully';
        break;

      case SyncButtonState.Error:
        this._updateButton.addClass('cs-update-error');
        this._updateButton.node.title = 'Sync failed - Click to retry';
        break;
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
    // Dispose button
    this._updateButton.dispose();
    */

    this._isDisposed = true;
  }
}
