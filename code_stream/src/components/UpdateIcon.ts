/**
 * UpdateIcon - Update button for students to sync cell content from teacher
 */

import { ToolbarButton } from '@jupyterlab/apputils';
import { Cell } from '@jupyterlab/cells';
import { CellTracker } from '../services/CellTracker';
import { SyncButtonState, DEFAULTS } from '../models/types';
import { throttle } from '../utils/debounce';

/**
 * Update icon button for student cells
 */
export class UpdateIcon extends ToolbarButton {
  private _cell: Cell;
  private _cellTracker: CellTracker;
  private _state: SyncButtonState = SyncButtonState.Default;
  private _throttledClick: (...args: any[]) => void;

  /**
   * Constructor
   * @param cell - Cell instance
   * @param cellTracker - Cell tracker instance
   */
  constructor(cell: Cell, cellTracker: CellTracker) {
    super({
      icon: 'ui-components:refresh',
      tooltip: 'Sync cell from teacher',
      onClick: () => this._throttledClick()
    });

    this._cell = cell;
    this._cellTracker = cellTracker;

    // Throttle clicks to prevent spam
    this._throttledClick = throttle(
      () => this._onUpdateClick(),
      1000 // 1 second throttle
    );

    this.addClass('cs-update-icon');
    this._updateState(SyncButtonState.Default);
  }

  /**
   * Handle update click
   * @private
   */
  private async _onUpdateClick(): Promise<void> {
    if (this._state === SyncButtonState.Syncing) {
      // Already syncing, ignore
      return;
    }

    this._updateState(SyncButtonState.Syncing);

    try {
      const success = await this._cellTracker.requestCellSync(this._cell);

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
    this.removeClass('cs-update-icon-default');
    this.removeClass('cs-update-icon-syncing');
    this.removeClass('cs-update-icon-success');
    this.removeClass('cs-update-icon-error');

    // Add new state class
    switch (state) {
      case SyncButtonState.Default:
        this.addClass('cs-update-icon-default');
        this.node.title = 'Sync cell from teacher';
        break;

      case SyncButtonState.Syncing:
        this.addClass('cs-update-icon-syncing');
        this.node.title = 'Syncing...';
        break;

      case SyncButtonState.Success:
        this.addClass('cs-update-icon-success');
        this.node.title = 'Synced successfully';
        break;

      case SyncButtonState.Error:
        this.addClass('cs-update-icon-error');
        this.node.title = 'Sync failed - Click to retry';
        break;
    }
  }
}
