import { browser } from "wxt/browser";
import { DEFAULT_SETTINGS } from "./defaults";

export type OcrSettings = typeof DEFAULT_SETTINGS;

export async function getSettings(): Promise<OcrSettings> {
  const stored = await browser.storage.sync.get(DEFAULT_SETTINGS);
  return {
    prompt: String(stored.prompt || DEFAULT_SETTINGS.prompt)
  };
}

export async function saveSettings(settings: OcrSettings): Promise<void> {
  await browser.storage.sync.set({
    prompt: settings.prompt.trim()
  });
}
