import { Plugin, MarkdownView, Notice, TFile, TFolder } from 'obsidian';
import { BraveSettingTab } from 'settings';

interface BravePluginSettings {
  archivePath: string,
  todoPath: string,
  withTimestamp: boolean,
  recurringTaskPath: string,
}

const DEFAULT_SETTINGS: Partial<BravePluginSettings> = {
  archivePath: 'Archive',
  todoPath: 'Todo',
  withTimestamp: true,
  recurringTaskPath: 'Tasks',
}

export default class BravePlugin extends Plugin {
  settings: BravePluginSettings;
  // avoid infinite loop
  justUpdated: boolean

  async onload() {
    await this.loadSettings();

    this.addRibbonIcon('rocket', 'Aggregate Recurring Tasks', async (evt: MouseEvent) => {
      const tasksUpdated = await this.aggregateRecurringTasks();
      if (tasksUpdated > 0) {
        new Notice(`${tasksUpdated} Recurring Tasks updated`);
        return;
      }
      new Notice("No Recurring Tasks found")
		});

    this.justUpdated = false;

    this.addSettingTab(new BraveSettingTab(this.app, this));

    this.addCommand({
      id: 'add-recurring-task-time',
      name: 'Add Time to Recurring Tasks',
      editorCallback: async (editor, view) => {
        const tasksUpdated = await this.aggregateRecurringTasks();
        if (tasksUpdated > 0) {
          new Notice(`${tasksUpdated} Recurring Tasks updated`);
          return;
        }
        new Notice("No Recurring Tasks found")
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
    if (sourceFile.path == this.archivePath() || !this.inTodoFile(sourceFile.path)) {
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

  async aggregateRecurringTasks() {
    if (!this.settings.recurringTaskPath) {
      new Notice('You must set Recurring Task File to use this feature');
      return 0;
    }

    // scan active file for recurring tasks
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      return 0;
    }
    const taskMap = new Map<string, number>();
    let contentBuffer: string[] = [];
    let content = await this.app.vault.read(activeFile);
    let lines = content.split("\n");
    for (const l of lines) {
      if (l.startsWith('~rec') && !l.endsWith('~')) {
        // grab recurring task reference data
        const referenceData = l.split(' ');
        if (referenceData.length < 3) {
          contentBuffer.push(l);
          continue;
        }
        const activityName = referenceData[1].toLowerCase();
        if (isNaN(parseInt(referenceData[2]))) {
          contentBuffer.push(l);
          continue;
        }
        const activityValue = parseInt(referenceData[2]);
        const currentValue = taskMap.get(activityName);
        if (currentValue) {
          taskMap.set(activityName, activityValue + currentValue)
        } else {
          taskMap.set(activityName, activityValue);
        }
        contentBuffer.push(`${l}~`);
        continue;
      }
      contentBuffer.push(l);
    }
    console.log(taskMap);
    const activeContent = contentBuffer.join('\n');

    if (taskMap.size === 0) {
      // no new tasks
      return 0;
    }

    // create or open the task file
    let taskFile = this.app.vault.getAbstractFileByPath(this.recurringTaskPath());
    console.log(this.recurringTaskPath());
    if (!taskFile) {
      taskFile = await this.app.vault.create(this.recurringTaskPath(), '');
    }
    if (!(taskFile instanceof TFile)) {
      return 0;
    }

    contentBuffer = [];
    content = await this.app.vault.read(taskFile);
    lines = content.split("\n");
    let lastReadSection: string | null = null;
    const readSections: string[] = [];
    let lastReadSectionUpdate: number | null = null;
    // parse current Task file & update new values
    for (const l of lines) {
      if (l.includes('#')) {
        if (lastReadSection !== null) {
          if (lastReadSectionUpdate !== null) {
            contentBuffer.push(`${this.timestamp()} | ${lastReadSectionUpdate}`)
          }
        }
        lastReadSection = l.replace('#', '').trim();
        readSections.push(lastReadSection);
        contentBuffer.push(l);
      }
      else if (l.startsWith('Total: ')) {
        if (lastReadSection === null) {
          contentBuffer.push(l);
          continue;
        }
        const currentValue = parseInt(l.split(' ')[1])
        lastReadSectionUpdate = taskMap.get(lastReadSection) ?? null;
        if (lastReadSectionUpdate === null) {
          contentBuffer.push(l);
          continue;
        }
        contentBuffer.push(`Total: ${currentValue + lastReadSectionUpdate}`);
      } 
      else {
        contentBuffer.push(l);
      }
    }
    if (lastReadSection !== null) {
      if (lastReadSectionUpdate !== null) {
        contentBuffer.push(`${this.timestamp()} | ${lastReadSectionUpdate}`)
      }
    }
    // extend with new task types
    const newTasksMap = new Map(
      [...taskMap].filter(([k, _v]) => !readSections.includes(k))
    );
    for (const [key, value] of newTasksMap) {
      contentBuffer.push(`# ${key}`);
      contentBuffer.push(`Total: ${value}`);
      contentBuffer.push(`${this.timestamp()} | ${value}`)
    }
    const taskContent = contentBuffer.join('\n');

    // write to active file
    await this.app.vault.modify(activeFile, activeContent);
    // write to task file
    await this.app.vault.modify(taskFile, taskContent);

    return taskMap.size;
  }

  archivePath() {
    return `${this.settings.archivePath}.md`;
  }

  todoPath() {
    return `${this.settings.todoPath}.md`;
  }

  recurringTaskPath() {
    return `${this.settings.recurringTaskPath}.md`;
  }

  inTodoFile(path: string) {
    return !this.settings.todoPath || this.todoPath() === path;
  }

  timestamp() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // months are 0-indexed
    const day = String(now.getDate()).padStart(2, '0');

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}
