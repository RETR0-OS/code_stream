import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { requestAPI } from './handler';

/**
 * Initialization data for the code_stream extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'code_stream:plugin',
  description: 'A jupyter extension to sync notebooks.',
  autoStart: true,
  optional: [ISettingRegistry],
  activate: (app: JupyterFrontEnd, settingRegistry: ISettingRegistry | null) => {
    console.log('JupyterLab extension code_stream is activated!');

    if (settingRegistry) {
      settingRegistry
        .load(plugin.id)
        .then(settings => {
          console.log('code_stream settings loaded:', settings.composite);
        })
        .catch(reason => {
          console.error('Failed to load settings for code_stream.', reason);
        });
    }

    requestAPI<any>('get-example')
      .then(data => {
        console.log(data);
      })
      .catch(reason => {
        console.error(
          `The code_stream server extension appears to be missing.\n${reason}`
        );
      });
  }
};

export default plugin;
