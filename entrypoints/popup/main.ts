import { DEFAULT_SETTINGS } from "../../src/core/defaults";
import { getSettings, saveSettings } from "../../src/core/settings";
import "./style.css";

const form = document.querySelector<HTMLFormElement>("#settings-form");
const promptInput = document.querySelector<HTMLTextAreaElement>("#prompt");
const message = document.querySelector<HTMLParagraphElement>("#message");

void hydrate();

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!promptInput) {
    return;
  }

  await saveSettings({
    prompt: promptInput.value
  });

  showMessage("設定已儲存");
});

async function hydrate(): Promise<void> {
  const settings = await getSettings().catch(() => DEFAULT_SETTINGS);

  if (promptInput) {
    promptInput.value = settings.prompt;
  }
}

function showMessage(value: string): void {
  if (!message) {
    return;
  }

  message.textContent = value;
  message.classList.add("is-visible");
  window.setTimeout(() => message.classList.remove("is-visible"), 2500);
}
