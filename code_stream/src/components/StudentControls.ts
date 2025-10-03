/**
 * StudentControls - Manages student-specific UI controls
 * Adds update/sync button to notebook toolbar
 */

import { IDisposable } from '@lumino/disposable';
import { NotebookPanel } from '@jupyterlab/notebook';
import { ToolbarButton } from '@jupyterlab/apputils';
import { CellTracker } from '../services/CellTracker';
import { SyncButtonState, DEFAULTS } from '../models/types';

/**
 * Student controls for notebook
 */
export class StudentControls implements IDisposable {
  private _notebookPanel: NotebookPanel;
  private _cellTracker: CellTracker;
  private _updateButton: ToolbarButton;
  private _state: SyncButtonState = SyncButtonState.Default;
  private _isDisposed: boolean = false;

  /**
   * Constructor
   * @param notebookPanel - Notebook panel instance
   * @param cellTracker - Cell tracker instance
   */
  constructor(notebookPanel: NotebookPanel, cellTracker: CellTracker) {
    this._notebookPanel = notebookPanel;
    this._cellTracker = cellTracker;

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
  }

  /**
   * Handle update button click
   * @private
   */
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

    // Dispose button
    this._updateButton.dispose();

    this._isDisposed = true;
  }
}
