/**
 * SessionPanel - Widget for displaying session information
 * Shows session code for teachers and join interface for students
 */

import { Widget } from '@lumino/widgets';
import { LabIcon } from '@jupyterlab/ui-components';
import { SessionManager } from '../services/SessionManager';
import { RoleManager } from '../services/RoleManager';

/**
 * Session panel widget
 */
export class SessionPanel extends Widget {
  private _sessionManager: SessionManager;
  private _roleManager: RoleManager;
  private _joinInputElement: HTMLInputElement | null = null;

  /**
   * Constructor
   * @param sessionManager - Session manager instance
   * @param roleManager - Role manager instance
   */
  constructor(sessionManager: SessionManager, roleManager: RoleManager) {
    super();

    this._sessionManager = sessionManager;
    this._roleManager = roleManager;

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
  }

  /**
   * Render student view
   * @private
   */
  private _renderStudentView(): void {
    const sessionHash = this._sessionManager.getSessionHash();

    this.node.innerHTML = `
      <div class="cs-session-panel-content">
        <div class="cs-session-header">
          <h3>Student Session</h3>
        </div>
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
          />
          <button class="cs-join-button">Join</button>
        </div>
        <div class="cs-session-status">
          <span class="cs-status-indicator cs-status-inactive"></span>
          <span>Not Connected</span>
        </div>
        `
        }
      </div>
    `;

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
   * Dispose of resources
   */
  public dispose(): void {
    this._sessionManager.sessionChanged.disconnect(this._onSessionChanged, this);
    this._roleManager.roleChanged.disconnect(this._onRoleChanged, this);
    super.dispose();
  }
}
