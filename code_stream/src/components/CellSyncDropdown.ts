/**
 * CellSyncDropdown - Dropdown menu for selecting cells to sync from
 */

import { Cell } from '@jupyterlab/cells';
import { SessionManager } from '../services/SessionManager';
import { generateTimestamp } from '../utils/hashGenerator';

/**
 * Dropdown menu for cell sync selection
 */
export class CellSyncDropdown {
  private _cell: Cell;
  private _sessionManager: SessionManager;
  private _dropdownElement: HTMLElement;
  private _ghostTextElement: HTMLElement | null = null;
  private _isOpen: boolean = false;
  private _currentHoveredCellId: string | null = null;

  /**
   * Constructor
   * @param cell - Cell instance
   * @param sessionManager - Session manager instance
   */
  constructor(cell: Cell, sessionManager: SessionManager) {
    this._cell = cell;
    this._sessionManager = sessionManager;
    this._dropdownElement = this._createDropdown();
  }

  /**
   * Create dropdown element
   * @private
   * @returns Dropdown element
   */
  private _createDropdown(): HTMLElement {
    const dropdown = document.createElement('div');
    dropdown.className = 'cs-sync-dropdown';
    dropdown.style.display = 'none';
    return dropdown;
  }

  /**
   * Open dropdown and populate with cell IDs
   */
  public async open(anchorElement: HTMLElement): Promise<void> {
    if (this._isOpen) {
      return;
    }

    this._isOpen = true;

    // Clear previous content
    this._dropdownElement.innerHTML = '<div class="cs-sync-dropdown-loading">Loading cells...</div>';
    this._dropdownElement.style.display = 'block';

    // Position dropdown relative to anchor
    this._positionDropdown(anchorElement);

    // Fetch available cell IDs
    try {
      const response = await this._sessionManager.syncService.getAllCellIds();

      if (response.status === 'success' && response.data) {
        this._populateDropdown(response.data);
      } else {
        this._dropdownElement.innerHTML = '<div class="cs-sync-dropdown-error">No cells available</div>';
      }
    } catch (error) {
      console.error('Code Stream: Error loading cell IDs:', error);
      this._dropdownElement.innerHTML = '<div class="cs-sync-dropdown-error">Failed to load cells</div>';
    }
  }

  /**
   * Close dropdown
   */
  public close(): void {
    if (!this._isOpen) {
      return;
    }

    this._isOpen = false;
    this._dropdownElement.style.display = 'none';
    this._clearGhostText();
  }

  /**
   * Get dropdown element
   * @returns Dropdown element
   */
  public get element(): HTMLElement {
    return this._dropdownElement;
  }

  /**
   * Check if dropdown is open
   * @returns True if open
   */
  public get isOpen(): boolean {
    return this._isOpen;
  }

  /**
   * Position dropdown relative to anchor element
   * @private
   * @param anchorElement - Anchor element
   */
  private _positionDropdown(anchorElement: HTMLElement): void {
    const rect = anchorElement.getBoundingClientRect();
    this._dropdownElement.style.position = 'absolute';
    this._dropdownElement.style.top = `${rect.bottom + 4}px`;
    this._dropdownElement.style.left = `${rect.left}px`;
  }

  /**
   * Populate dropdown with cell IDs
   * @private
   * @param cellIds - List of cell IDs
   */
  private _populateDropdown(cellIds: string[]): void {
    this._dropdownElement.innerHTML = '';

    if (cellIds.length === 0) {
      this._dropdownElement.innerHTML = '<div class="cs-sync-dropdown-empty">No cells available to sync</div>';
      return;
    }

    const list = document.createElement('ul');
    list.className = 'cs-sync-dropdown-list';

    cellIds.forEach((cellId, index) => {
      const item = document.createElement('li');
      item.className = 'cs-sync-dropdown-item';
      item.textContent = `Cell ${index + 1}`;
      item.dataset.cellId = cellId;

      // Hover event - fetch and preview cell data
      item.addEventListener('mouseenter', () => this._onCellHover(cellId));

      // Mouse leave - clear ghost text
      item.addEventListener('mouseleave', () => this._clearGhostText());

      // Click event - sync cell
      item.addEventListener('click', () => this._onCellClick(cellId));

      list.appendChild(item);
    });

    this._dropdownElement.appendChild(list);
  }

  /**
   * Handle cell hover - fetch and preview cell data
   * @private
   * @param cellId - Cell ID to preview
   */
  private async _onCellHover(cellId: string): Promise<void> {
    // Avoid re-fetching if already hovering over the same cell
    if (this._currentHoveredCellId === cellId) {
      return;
    }

    this._currentHoveredCellId = cellId;

    const sessionHash = this._sessionManager.getSessionHash();
    if (!sessionHash) {
      return;
    }

    try {
      const response = await this._sessionManager.syncService.getCell(
        sessionHash,
        cellId,
        generateTimestamp()
      );

      // Only show preview if still hovering over the same cell
      if (this._currentHoveredCellId === cellId && response.status === 'success' && response.data) {
        this._showGhostText(response.data);
      }
    } catch (error) {
      console.error('Code Stream: Error fetching cell preview:', error);
    }
  }

  /**
   * Handle cell click - complete sync
   * @private
   * @param cellId - Cell ID to sync
   */
  private async _onCellClick(cellId: string): Promise<void> {
    const sessionHash = this._sessionManager.getSessionHash();
    if (!sessionHash) {
      return;
    }

    try {
      const response = await this._sessionManager.syncService.getCell(
        sessionHash,
        cellId,
        generateTimestamp()
      );

      if (response.status === 'success' && response.data) {
        // Replace cell content
        this._cell.model.sharedModel.setSource(response.data);
        this.close();
      }
    } catch (error) {
      console.error('Code Stream: Error syncing cell:', error);
    }
  }

  /**
   * Show ghost text preview in cell
   * @private
   * @param content - Content to preview
   */
  private _showGhostText(content: string): void {
    this._clearGhostText();

    // Create ghost text overlay
    const ghostText = document.createElement('div');
    ghostText.className = 'cs-ghost-text';
    ghostText.textContent = content;

    // Find the cell's editor element (CodeMirror or similar)
    const cellNode = this._cell.node;
    const editor = cellNode.querySelector('.jp-Editor') ||
                   cellNode.querySelector('.CodeMirror') ||
                   cellNode.querySelector('.jp-InputArea');

    if (editor) {
      // Make sure the parent has position relative for absolute positioning
      const parentElement = editor as HTMLElement;
      if (window.getComputedStyle(parentElement).position === 'static') {
        parentElement.style.position = 'relative';
      }

      parentElement.appendChild(ghostText);
      this._ghostTextElement = ghostText;
    }
  }

  /**
   * Clear ghost text preview
   * @private
   */
  private _clearGhostText(): void {
    this._currentHoveredCellId = null;

    if (this._ghostTextElement && this._ghostTextElement.parentNode) {
      this._ghostTextElement.parentNode.removeChild(this._ghostTextElement);
      this._ghostTextElement = null;
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this._clearGhostText();
    if (this._dropdownElement.parentNode) {
      this._dropdownElement.parentNode.removeChild(this._dropdownElement);
    }
  }
}
