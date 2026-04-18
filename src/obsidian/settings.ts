import { App, PluginSettingTab, Setting } from "obsidian";
import type FirstMisreadPlugin from "./main";

export const PROVIDER_DEFAULTS: Record<string, { model: string; baseUrl: string }> = {
  anthropic: { model: "claude-sonnet-4-6", baseUrl: "" },
  openai: { model: "gpt-4o", baseUrl: "" },
  google: { model: "gemini-2.5-flash", baseUrl: "" },
  "openai-compatible": { model: "", baseUrl: "" },
};

export interface FirstMisreadSettings {
  provider: "anthropic" | "openai" | "google" | "openai-compatible";
  apiKey: string;
  model: string;
  baseUrl: string;
  resultsFolder: string;
}

export const DEFAULT_SETTINGS: FirstMisreadSettings = {
  provider: "anthropic",
  apiKey: "",
  model: "claude-sonnet-4-6",
  baseUrl: "",
  resultsFolder: ".first-misread",
};

export class FirstMisreadSettingTab extends PluginSettingTab {
  plugin: FirstMisreadPlugin;

  constructor(app: App, plugin: FirstMisreadPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "First Misread Settings" });

    new Setting(containerEl)
      .setName("LLM Provider")
      .setDesc("Which AI provider to use for reading simulation")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            anthropic: "Anthropic",
            openai: "OpenAI",
            google: "Google Gemini",
            "openai-compatible": "OpenAI-compatible",
          })
          .setValue(this.plugin.settings.provider)
          .onChange(async (value) => {
            this.plugin.settings.provider = value as FirstMisreadSettings["provider"];
            const defaults = PROVIDER_DEFAULTS[value];
            if (defaults) {
              this.plugin.settings.model = defaults.model;
              this.plugin.settings.baseUrl = defaults.baseUrl;
            }
            await this.plugin.saveSettings();
            this.display();
          })
      );

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("Your API key for the selected provider")
      .addText((text) =>
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.apiKey)
          .then((t) => (t.inputEl.type = "password"))
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Model")
      .setDesc("Model name to use")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.model)
          .onChange(async (value) => {
            this.plugin.settings.model = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Base URL")
      .setDesc("Override the default API endpoint (e.g. for a local proxy). Leave blank for the provider default.")
      .addText((text) =>
        text
          .setPlaceholder("https://api.anthropic.com")
          .setValue(this.plugin.settings.baseUrl)
          .onChange(async (value) => {
            this.plugin.settings.baseUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Results folder")
      .setDesc("Vault folder for storing analysis history (dot-prefixed to hide)")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.resultsFolder)
          .onChange(async (value) => {
            this.plugin.settings.resultsFolder = value;
            await this.plugin.saveSettings();
          })
      );

  }
}
