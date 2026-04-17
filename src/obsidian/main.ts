import { Plugin, WorkspaceLeaf } from "obsidian";
import {
  FirstMisreadSettingTab,
  DEFAULT_SETTINGS,
  type FirstMisreadSettings,
} from "./settings";
import { FirstMisreadView, VIEW_TYPE } from "./ui/Panel";

export default class FirstMisreadPlugin extends Plugin {
  settings: FirstMisreadSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    this.registerView(VIEW_TYPE, (leaf) => new FirstMisreadView(leaf, this));

    this.addCommand({
      id: "analyze",
      name: "Analyze active note",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "show-panel",
      name: "Show panel",
      callback: () => this.activateView(),
    });

    this.addRibbonIcon("eye", "First Misread: Analyze", () => {
      this.activateView();
    });

    this.addSettingTab(new FirstMisreadSettingTab(this.app, this));
  }

  async onunload() {}

  async activateView() {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE);

    let leaf: WorkspaceLeaf;
    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      const rightLeaf = workspace.getRightLeaf(false);
      if (!rightLeaf) return;
      leaf = rightLeaf;
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }

    workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
