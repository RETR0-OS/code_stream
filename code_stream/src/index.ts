/**
 * Code Stream - JupyterLab extension for notebook synchronization
 * Main entry point that wires all components together
 */

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ICommandPalette, IToolbarWidgetRegistry } from '@jupyterlab/apputils';

// Services
import { RoleManager } from './services/RoleManager';
import { SyncService } from './services/SyncService';
import { SessionManager } from './services/SessionManager';
import { CellTracker } from './services/CellTracker';

// Components
import { TeacherControls } from './components/TeacherControls';
import { StudentControls } from './components/StudentControls';
import { SessionPanel } from './components/SessionPanel';
import { UpdateIcon } from './components/UpdateIcon';

/**
 * Tracker for active notebook controls
 */
interface INotebookControls {
  notebookPanel: NotebookPanel;
  controls: TeacherControls | StudentControls;
}

/**
 * Main plugin definition
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'code_stream:plugin',
  description: 'A jupyter extension to sync notebooks.',
  autoStart: true,
  requires: [INotebookTracker],
  optional: [ISettingRegistry, ICommandPalette, IToolbarWidgetRegistry],
  activate: async (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry | null,
    palette: ICommandPalette | null,
    toolbarRegistry: IToolbarWidgetRegistry | null
  ) => {
    console.log('Code Stream: Extension activated');

    // Initialize services
    const roleManager = new RoleManager();
    const syncService = new SyncService();
    const sessionManager = new SessionManager(roleManager, syncService);
    const cellTracker = new CellTracker(sessionManager, roleManager);

    // Register cell toolbar button for Student mode
    if (toolbarRegistry) {
      toolbarRegistry.addFactory(
        'Cell',
        'codeStreamSync',
        (cell: any) => {
          // Only add sync button for students
          if (roleManager.isStudent()) {
            return new UpdateIcon(cell, cellTracker);
          }
          // Return an empty Widget if not student
          const { Widget } = require('@lumino/widgets');
          return new Widget();
        }
      );
      console.log('Code Stream: Cell toolbar factory registered');
    }

    // Track active notebook controls
    const notebookControls = new Map<string, INotebookControls>();

    // Create and add session panel to sidebar
    const sessionPanel = new SessionPanel(sessionManager, roleManager);
    sessionPanel.id = 'code-stream-session-panel';
    app.shell.add(sessionPanel, 'left', { rank: 1000 });

    /**
     * Setup controls for a notebook
     */
    function setupNotebookControls(panel: NotebookPanel): void {
      const notebookId = panel.id;

      // Check if controls already exist
      if (notebookControls.has(notebookId)) {
        return;
      }

      // Initialize session manager with notebook
      sessionManager.initialize(panel.content.model!);

      // Initialize cell tracker with notebook
      cellTracker.initialize(panel.content.model!);

      // Create controls based on role
      let controls: TeacherControls | StudentControls;

      if (roleManager.isTeacher()) {
        controls = new TeacherControls(panel, sessionManager, cellTracker);
        console.log('Code Stream: Teacher controls initialized');
      } else {
        controls = new StudentControls(panel, cellTracker);
        console.log('Code Stream: Student controls initialized');
      }

      // Store controls
      notebookControls.set(notebookId, {
        notebookPanel: panel,
        controls
      });

      // Cleanup on notebook close
      panel.disposed.connect(() => {
        const entry = notebookControls.get(notebookId);
        if (entry) {
          entry.controls.dispose();
          notebookControls.delete(notebookId);
        }
      });
    }

    /**
     * Recreate controls for all notebooks (used when role changes)
     */
    function recreateAllControls(): void {
      // Dispose existing controls
      notebookControls.forEach(entry => {
        entry.controls.dispose();
      });
      notebookControls.clear();

      // Recreate controls for all open notebooks
      notebookTracker.forEach(panel => {
        setupNotebookControls(panel);
      });
    }

    // Setup controls for current notebook
    if (notebookTracker.currentWidget) {
      setupNotebookControls(notebookTracker.currentWidget);
    }

    // Setup controls for new notebooks
    notebookTracker.widgetAdded.connect((sender, panel) => {
      setupNotebookControls(panel);
    });

    // Listen for role changes and recreate controls
    roleManager.roleChanged.connect(() => {
      console.log('Code Stream: Role changed, recreating controls');
      recreateAllControls();
    });

    // Add commands to command palette
    const commandSwitchToTeacher = 'code-stream:switch-to-teacher';
    const commandSwitchToStudent = 'code-stream:switch-to-student';
    const commandShowPanel = 'code-stream:show-panel';

    app.commands.addCommand(commandSwitchToTeacher, {
      label: 'Code Stream: Switch to Teacher Mode',
      execute: () => {
        roleManager.setRole('teacher');
        console.log('Code Stream: Switched to teacher mode');
      }
    });

    app.commands.addCommand(commandSwitchToStudent, {
      label: 'Code Stream: Switch to Student Mode',
      execute: () => {
        roleManager.setRole('student');
        console.log('Code Stream: Switched to student mode');
      }
    });

    app.commands.addCommand(commandShowPanel, {
      label: 'Code Stream: Show Session Panel',
      execute: () => {
        app.shell.activateById(sessionPanel.id);
      }
    });

    // Add commands to palette
    if (palette) {
      palette.addItem({ command: commandSwitchToTeacher, category: 'Code Stream' });
      palette.addItem({ command: commandSwitchToStudent, category: 'Code Stream' });
      palette.addItem({ command: commandShowPanel, category: 'Code Stream' });
    }

    // Load settings if available
    if (settingRegistry) {
      settingRegistry
        .load(plugin.id)
        .then(settings => {
          console.log('Code Stream: Settings loaded:', settings.composite);
        })
        .catch(reason => {
          console.error('Code Stream: Failed to load settings:', reason);
        });
    }

    // Log current role
    console.log(`Code Stream: Current role is ${roleManager.getRole()}`);
    console.log('Code Stream: To switch roles, use localStorage.setItem("code_stream_role", "teacher" or "student") and reload');
  }
};

export default plugin;
