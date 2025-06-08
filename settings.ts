import BravePlugin from './main';
import { App, PluginSettingTab, Setting } from 'obsidian';

export class BraveSettingTab extends PluginSettingTab {
  plugin: BravePlugin;

  constructor(app: App, plugin: BravePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName('Archive Path')
      .setDesc('Path to task archive')
      .addText((text) =>
        text
          .setPlaceholder('Archive')
          .setValue(this.plugin.settings.archivePath)
          .onChange(async (value) => {
            this.plugin.settings.archivePath = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('With Timestamp')
      .setDesc('Should tasks include a cretaed and completed timestamp')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.withTimestamp)
          .onChange(async (value) => {
            this.plugin.settings.withTimestamp = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
