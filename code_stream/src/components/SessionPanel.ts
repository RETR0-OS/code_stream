/**
 * SessionPanel - Widget for displaying session information
 * Shows session code for teachers and join interface for students
 */

import { Widget } from '@lumino/widgets';
import { LabIcon } from '@jupyterlab/ui-components';
import { SessionManager } from '../services/SessionManager';
import { RoleManager } from '../services/RoleManager';
import { CellTracker } from '../services/CellTracker';

/**
 * Session panel widget
 */
export class SessionPanel extends Widget {
  private _sessionManager: SessionManager;
  private _roleManager: RoleManager;
  private _cellTracker: CellTracker;
  private _joinInputElement: HTMLInputElement | null = null;

  /**
   * Constructor
   * @param sessionManager - Session manager instance
   * @param roleManager - Role manager instance
   * @param cellTracker - Cell tracker instance
   */
  constructor(sessionManager: SessionManager, roleManager: RoleManager, cellTracker: CellTracker) {
    super();

    this._sessionManager = sessionManager;
    this._roleManager = roleManager;
    this._cellTracker = cellTracker;

    this.addClass('cs-session-panel');
    this.title.label = 'Code Stream';
    this.title.caption = 'Code Stream Session';
    this.title.closable = true;

    // Set icon for sidebar tab
    const icon = LabIcon.resolve({ icon: 'ui-components:link' });
    this.title.icon = icon;

    this._render();
    this._setupListeners();
  }

  /**
   * Render the panel content
   * @private
   */
  private _render(): void {
    if (this._roleManager.isTeacher()) {
      this._renderTeacherView();
    } else {
      this._renderStudentView();
    }
  }

  /**
   * Render teacher view
   * @private
   */
  private _renderTeacherView(): void {
    let sessionHash = this._sessionManager.getSessionHash();

    console.log('Rendering teacher view with session hash:', sessionHash);

    // If sessionHash is not available, try to fetch or wait for it
    if (!sessionHash) {
      // Optionally, you can trigger a fetch or listen for sessionChanged event
      // For now, just show 'Loading...' and re-render when sessionChanged fires
      sessionHash = '';
    }

    this.node.innerHTML = `
      <div class="cs-session-panel-content">
        <div class="cs-session-header">
          <h3>Teacher Session</h3>
        </div>
        <div class="cs-session-code-section">
          <label>Session Code</label>
          <div class="cs-session-code-display">
            <code class="cs-session-code">${sessionHash ? sessionHash : 'Loading...'}</code>
            <button class="cs-copy-button" title="Copy session code">Copy</button>
            <button class="cs-refresh-button" title="Refresh session code">Refresh</button>
          </div>
          <p class="cs-session-hint">Share this code with students</p>
        </div>
        <div class="cs-session-status">
          <span class="cs-status-indicator cs-status-active"></span>
          <span>Session Active</span>
        </div>
      </div>
    `;

    // Setup copy button
    const copyButton = this.node.querySelector('.cs-copy-button') as HTMLButtonElement;
    if (copyButton) {
      copyButton.addEventListener('click', () => this._copySessionCode());
    }

    // Setup refresh button
    const refreshButton = this.node.querySelector('.cs-refresh-button') as HTMLButtonElement;
    if (refreshButton) {
      refreshButton.addEventListener('click', () => this._refreshSessionCode());
    }
  }

  /**
   * Render student view
   * @private
   */
  private async _renderStudentView(): Promise<void> {
    const sessionHash = this._sessionManager.getSessionHash();
    const teacherBaseUrl = this._sessionManager.getTeacherBaseUrl();

    this.node.innerHTML = `
      <div class="cs-session-panel-content">
        <div class="cs-session-header">
          <h3>Student Session</h3>
        </div>

        <!-- Teacher Server Configuration -->
        <div class="cs-config-section">
          <h4>Teacher Server Configuration</h4>
          <label>Teacher Server URL</label>
          <input
            type="text"
            class="cs-teacher-url-input"
            placeholder="http://192.168.1.10:8888"
            value="${teacherBaseUrl || ''}"
          />
          <label>Token (Optional)</label>
          <input
            type="password"
            class="cs-teacher-token-input"
            placeholder="Enter token if required"
          />
          <div class="cs-config-actions">
            <button class="cs-save-config-button">Save</button>
            <button class="cs-test-connection-button">Test Connection</button>
          </div>
          <div class="cs-config-status"></div>
        </div>

        <!-- Session Join Section -->
        ${
          sessionHash
            ? `
        <div class="cs-session-joined">
          <label>Connected to Session</label>
          <div class="cs-session-code-display">
            <code class="cs-session-code">${sessionHash}</code>
          </div>
          <button class="cs-leave-button">Leave Session</button>
        </div>
        <div class="cs-session-status">
          <span class="cs-status-indicator cs-status-active"></span>
          <span>Connected</span>
        </div>
        `
            : `
        <div class="cs-session-join">
          <label>Join Session</label>
          <input
            type="text"
            class="cs-join-input"
            placeholder="Enter 6-character code"
            maxlength="6"
            ${!teacherBaseUrl ? 'disabled title="Configure teacher server first"' : ''}
          />
          <button class="cs-join-button" ${!teacherBaseUrl ? 'disabled' : ''}>Join</button>
          ${!teacherBaseUrl ? '<p class="cs-warning">⚠️ Configure teacher server before joining</p>' : ''}
        </div>
        <div class="cs-session-status">
          <span class="cs-status-indicator ${teacherBaseUrl ? 'cs-status-ready' : 'cs-status-inactive'}"></span>
          <span>${teacherBaseUrl ? 'Ready to join' : 'Not Configured'}</span>
        </div>
        `
        }
      </div>
    `;

    // Setup config inputs and buttons
    const teacherUrlInput = this.node.querySelector('.cs-teacher-url-input') as HTMLInputElement;
    const teacherTokenInput = this.node.querySelector('.cs-teacher-token-input') as HTMLInputElement;
    const saveConfigButton = this.node.querySelector('.cs-save-config-button') as HTMLButtonElement;
    const testConnectionButton = this.node.querySelector('.cs-test-connection-button') as HTMLButtonElement;
    const configStatus = this.node.querySelector('.cs-config-status') as HTMLElement;

    if (saveConfigButton) {
      saveConfigButton.addEventListener('click', () =>
        this._saveConfig(teacherUrlInput, teacherTokenInput, configStatus)
      );
    }

    if (testConnectionButton) {
      testConnectionButton.addEventListener('click', () =>
        this._testConnection(configStatus)
      );
    }

    // Setup join input and button
    this._joinInputElement = this.node.querySelector('.cs-join-input');
    const joinButton = this.node.querySelector('.cs-join-button') as HTMLButtonElement;
    const leaveButton = this.node.querySelector('.cs-leave-button') as HTMLButtonElement;

    if (joinButton && this._joinInputElement) {
      joinButton.addEventListener('click', () => this._joinSession());
      this._joinInputElement.addEventListener('keypress', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          this._joinSession();
        }
      });
    }

    if (leaveButton) {
      leaveButton.addEventListener('click', () => this._leaveSession());
    }
  }

  /**
   * Setup event listeners
   * @private
   */
  private _setupListeners(): void {
    // Listen for session changes
    this._sessionManager.sessionChanged.connect(this._onSessionChanged, this);

    // Listen for role changes
    this._roleManager.roleChanged.connect(this._onRoleChanged, this);
  }

  /**
   * Copy session code to clipboard
   * @private
   */
  private _copySessionCode(): void {
    const sessionHash = this._sessionManager.getSessionHash();

    if (!sessionHash) {
      return;
    }

    navigator.clipboard.writeText(sessionHash).then(
      () => {
        // Show feedback
        const copyButton = this.node.querySelector('.cs-copy-button') as HTMLButtonElement;
        if (copyButton) {
          const originalText = copyButton.textContent;
          copyButton.textContent = 'Copied!';
          copyButton.classList.add('cs-copy-button-success');

          setTimeout(() => {
            copyButton.textContent = originalText;
            copyButton.classList.remove('cs-copy-button-success');
          }, 2000);
        }

        console.log('Code Stream: Session code copied to clipboard');
      },
      err => {
        console.error('Code Stream: Failed to copy session code:', err);
      }
    );
  }

  /**
   * Refresh session code
   * @private
   */
  private async _refreshSessionCode(): Promise<void> {
    // Show confirmation dialog
    const confirmed = window.confirm(
      'Generate new session code? This will clear all shared cells and students must rejoin with the new code.'
    );

    if (!confirmed) {
      return;
    }

    const refreshButton = this.node.querySelector('.cs-refresh-button') as HTMLButtonElement;
    const originalText = refreshButton ? refreshButton.textContent : '';

    try {
      // Show loading state
      if (refreshButton) {
        refreshButton.textContent = 'Refreshing...';
        refreshButton.disabled = true;
      }

      // Refresh session code (clears Redis)
      const newHash = await this._sessionManager.refreshSessionCode();
      console.log(`Code Stream: Session code refreshed to ${newHash}`);

      // Re-sync all cells with sync enabled
      const syncedCount = await this._cellTracker.resyncAllCells();
      console.log(`Code Stream: Re-synced ${syncedCount} cells`);

      // Cleanup orphan cells
      const validCellIds = this._cellTracker.getAllActiveCellIds();
      const deletedCount = await this._sessionManager.cleanupOrphanCells(validCellIds);
      console.log(`Code Stream: Cleaned up ${deletedCount} orphan cells`);

      // Show success feedback
      if (refreshButton) {
        refreshButton.textContent = 'Refreshed!';
        refreshButton.classList.add('cs-refresh-button-success');

        setTimeout(() => {
          refreshButton.textContent = originalText;
          refreshButton.classList.remove('cs-refresh-button-success');
          refreshButton.disabled = false;
        }, 2000);
      }

      console.log('Code Stream: Session code refresh complete');
    } catch (error) {
      console.error('Code Stream: Failed to refresh session code:', error);

      // Show error feedback
      if (refreshButton) {
        refreshButton.textContent = 'Failed!';
        refreshButton.classList.add('cs-refresh-button-error');

        setTimeout(() => {
          refreshButton.textContent = originalText;
          refreshButton.classList.remove('cs-refresh-button-error');
          refreshButton.disabled = false;
        }, 2000);
      }

      alert('Failed to refresh session code. Please try again.');
    }
  }

  /**
   * Join session
   * @private
   */
  private _joinSession(): void {
    if (!this._joinInputElement) {
      return;
    }

    const code = this._joinInputElement.value.trim();

    if (code.length !== 6) {
      alert('Please enter a valid 6-character session code');
      return;
    }

    const success = this._sessionManager.joinSession(code);

    if (success) {
      console.log('Code Stream: Joined session successfully');
      this._render(); // Re-render to show connected state
    } else {
      alert('Failed to join session. Please check the code and try again.');
    }
  }

  /**
   * Leave session
   * @private
   */
  private _leaveSession(): void {
    const confirm = window.confirm('Are you sure you want to leave this session?');

    if (confirm) {
      this._sessionManager.clearSession();
      this._render(); // Re-render to show join interface
    }
  }

  /**
   * Handle session changed
   * @private
   */
  private _onSessionChanged(): void {
    this._render();
  }

  /**
   * Handle role changed
   * @private
   */
  private _onRoleChanged(): void {
    this._render();
  }

  /**
   * Save teacher server configuration
   * @private
   */
  private async _saveConfig(
    urlInput: HTMLInputElement,
    tokenInput: HTMLInputElement,
    statusElement: HTMLElement
  ): Promise<void> {
    const url = urlInput.value.trim();
    const token = tokenInput.value.trim();

    if (!url) {
      statusElement.innerHTML = '<span class="cs-error">❌ Please enter a teacher server URL</span>';
      return;
    }

    statusElement.innerHTML = '<span class="cs-info">⏳ Saving configuration...</span>';

    try {
      const response = await this._sessionManager.syncService.setConfig({
        teacher_base_url: url,
        teacher_token: token || undefined
      });

      if (response.status === 'success') {
        // Update SessionManager with the new URL
        this._sessionManager.setTeacherBaseUrl(url);

        // Clear token input for security
        tokenInput.value = '';

        statusElement.innerHTML = '<span class="cs-success">✓ Configuration saved successfully</span>';

        // Re-render to update UI state
        setTimeout(() => this._render(), 1500);
      } else {
        statusElement.innerHTML = `<span class="cs-error">❌ ${response.message || 'Failed to save configuration'}</span>`;
      }
    } catch (error) {
      console.error('Code Stream: Error saving config:', error);
      statusElement.innerHTML = '<span class="cs-error">❌ Failed to save configuration</span>';
    }
  }

  /**
   * Test connection to teacher server
   * @private
   */
  private async _testConnection(statusElement: HTMLElement): Promise<void> {
    statusElement.innerHTML = '<span class="cs-info">⏳ Testing connection...</span>';

    try {
      const response = await this._sessionManager.syncService.testConnection();

      if (response.status === 'success') {
        statusElement.innerHTML = '<span class="cs-success">✓ Connection successful!</span>';
      } else {
        statusElement.innerHTML = `<span class="cs-error">❌ ${response.message}</span>`;
      }
    } catch (error: any) {
      console.error('Code Stream: Error testing connection:', error);
      const message = error?.message || 'Failed to test connection';
      statusElement.innerHTML = `<span class="cs-error">❌ ${message}</span>`;
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this._sessionManager.sessionChanged.disconnect(this._onSessionChanged, this);
    this._roleManager.roleChanged.disconnect(this._onRoleChanged, this);
    super.dispose();
  }
}
