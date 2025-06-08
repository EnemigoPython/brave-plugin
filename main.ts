import { Plugin, MarkdownView, TFile, TFolder } from 'obsidian';
import { BraveSettingTab } from 'settings';

interface BravePluginSettings {
  archivePath: string,
  withTimestamp: boolean
}

const DEFAULT_SETTINGS: Partial<BravePluginSettings> = {
  archivePath: 'Archive',
  withTimestamp: true
}

export default class BravePlugin extends Plugin {
  settings: BravePluginSettings;
  // avoid infinite loop
  justUpdated: boolean

  async onload() {
    await this.loadSettings();

    this.justUpdated = false;

    this.addSettingTab(new BraveSettingTab(this.app, this));

    this.addCommand({
      id: 'add-time',
      name: 'Add Time',
      editorCallback: async (editor, view) => {
      }
    });

    this.addCommand({
      id: 'timestamp-tasks',
      name: 'Add Timestamp to Tasks',
      editorCallback: async (_editor, view) => {
        if (!view.file) {
          return;
        }
        const contentBuffer: string[] = [];
        const content = await this.app.vault.read(view.file);
        const lines = content.split("\n");
        for (const l of lines) {
          if (l.includes('- [ ]') && (!l.includes('Created'))) {
            contentBuffer.push(`${l} | Created: ${this.timestamp()}`);
            continue;
          }
          contentBuffer.push(l);
        }
        await this.app.vault.modify(view.file, contentBuffer.join('\n'));
      }
    });

	this.registerEvent(this.app.metadataCache.on('changed', async (sourceFile, _data, fileCache) => {
    if (this.justUpdated) {
      this.justUpdated = false;
      return;
    }
    if (sourceFile.path == this.archivePath()) {
      return;
    }
    const contentBuffer: string[] = [];
    const completedTaskBuffer: string[] = [];
		if (sourceFile instanceof TFile) {
			const content = await this.app.vault.read(sourceFile);
			const lines = content.split("\n");
			for (const l of lines) {
				if (!l.includes('- [x]')) {
					// not a completed task line
          contentBuffer.push(l);
					continue;
				}
        completedTaskBuffer.push(l);
				console.log(l);
			}
    }

    // no new completed tasks
    if (completedTaskBuffer.length === 0) {
      return;
    }

    // remove tasks from source file
    this.justUpdated = true;
    await this.app.vault.modify(sourceFile, contentBuffer.join('\n'));

    // create or open the archive file
    let archiveFile = this.app.vault.getAbstractFileByPath(this.archivePath());
    if (!archiveFile) {
      archiveFile = await this.app.vault.create(this.archivePath(), '# Task Archive');
    }
    if (!(archiveFile instanceof TFile)) {
      return;
    }

    // add completed tasks to file content
    let archiveContent = await this.app.vault.read(archiveFile);
    for (const t of completedTaskBuffer) {
      let taskContent = `\n${t}`;
      if (this.settings.withTimestamp) {
        taskContent += ` | Completed: ${this.timestamp()}`;
      }
      archiveContent += taskContent;
    }

    // write to file
    await this.app.vault.modify(archiveFile, archiveContent);
	}));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  archivePath() {
    return `${this.settings.archivePath}.md`;
  }

  timestamp() {
    return new Date().toISOString().replace("T", " ").slice(0, 19);
  }
}
