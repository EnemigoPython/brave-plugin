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
      .setName('Todo Path')
      .setDesc('Path to task todo list (blank for all files)')
      .addText((text) =>
        text
          .setPlaceholder('Todo')
          .setValue(this.plugin.settings.todoPath)
          .onChange(async (value) => {
            this.plugin.settings.todoPath = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('With Timestamp')
      .setDesc('Should tasks include a created and completed timestamp')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.withTimestamp)
          .onChange(async (value) => {
            this.plugin.settings.withTimestamp = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Recurring Task File')
      .setDesc('Where do recurring tasks get aggregated')
      .addText((text) =>
        text
          .setPlaceholder('Tasks')
          .setValue(this.plugin.settings.recurringTaskPath)
          .onChange(async (value) => {
            this.plugin.settings.recurringTaskPath = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
