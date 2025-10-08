/**
 * UpdateIcon - Update button for students to sync cell content from teacher
 */

import { ToolbarButton } from '@jupyterlab/apputils';
import { Cell } from '@jupyterlab/cells';
import { CellTracker } from '../services/CellTracker';
import { SessionManager } from '../services/SessionManager';
import { CellSyncDropdown } from './CellSyncDropdown';

/**
 * Update icon button for student cells
 */
export class UpdateIcon extends ToolbarButton {
  private _dropdown: CellSyncDropdown;
  private _hoverTimeout: number | null = null;

  /**
   * Constructor
   * @param cell - Cell instance
   * @param cellTracker - Cell tracker instance (unused but kept for API compatibility)
   * @param sessionManager - Session manager instance
   */
  constructor(cell: Cell, cellTracker: CellTracker, sessionManager: SessionManager) {
    super({
      icon: 'ui-components:refresh',
      tooltip: 'Hover to see available cells to sync',
      onClick: () => {} // Disabled click - now using hover
    });

    this._dropdown = new CellSyncDropdown(cell, sessionManager);

    this.addClass('cs-update-icon');
    this.addClass('cs-update-icon-default');
    this._setupDropdown();
  }

  /**
   * Setup dropdown event handlers
   * @private
   */
  private _setupDropdown(): void {
    // Append dropdown to document body for proper positioning
    document.body.appendChild(this._dropdown.element);

    // Hover event - open dropdown with delay
    this.node.addEventListener('mouseenter', () => {
      this._hoverTimeout = window.setTimeout(() => {
        this._dropdown.open(this.node);
      }, 300); // 300ms delay before opening
    });

    // Leave event - close dropdown with delay
    this.node.addEventListener('mouseleave', (e) => {
      if (this._hoverTimeout) {
        clearTimeout(this._hoverTimeout);
        this._hoverTimeout = null;
      }

      // Check if mouse is moving to dropdown
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (relatedTarget && this._dropdown.element.contains(relatedTarget)) {
        return; // Don't close if moving to dropdown
      }

      // Add delay before closing to allow user to move to dropdown
      setTimeout(() => {
        // Only close if mouse is not over button or dropdown
        if (!this.node.matches(':hover') && !this._dropdown.element.matches(':hover')) {
          this._dropdown.close();
        }
      }, 200); // 200ms grace period
    });

    // Close dropdown when mouse leaves dropdown area with delay
    this._dropdown.element.addEventListener('mouseleave', (e) => {
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (relatedTarget && this.node.contains(relatedTarget)) {
        return; // Don't close if moving back to button
      }

      // Add delay before closing to allow user to move back
      setTimeout(() => {
        // Only close if mouse is not over button or dropdown
        if (!this.node.matches(':hover') && !this._dropdown.element.matches(':hover')) {
          this._dropdown.close();
        }
      }, 200); // 200ms grace period
    });
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this._hoverTimeout) {
      clearTimeout(this._hoverTimeout);
    }
    this._dropdown.dispose();
    super.dispose();
  }
}
