/**
 * StudentControls - Manages student-specific UI controls
 *
 * NOTE: This class is currently minimal as the main toolbar button has been moved
 * to per-cell toolbar buttons (UpdateIcon). It's kept for potential future
 * session-level features or notebook-wide controls.
 */

import { IDisposable } from '@lumino/disposable';

export class StudentControls implements IDisposable {

  private _isDisposed: boolean = false;

  /**
   * Constructor
   * @param notebookPanel - Notebook panel instance (kept for compatibility)
   * @param cellTracker - Cell tracker instance (kept for compatibility)
   */
  constructor(notebookPanel: any, cellTracker: any) {
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

    this._isDisposed = true;
  }
}
