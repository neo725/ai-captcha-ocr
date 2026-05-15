import { browser } from "wxt/browser";
import { MESSAGE_TYPES } from "../src/core/defaults";
import { requestOcr } from "../src/core/ocrClient";
import { getSettings } from "../src/core/settings";
import type {
  ExtensionMessage,
  OcrContextImageMessage,
  OcrImageMessage
} from "../src/types/messages";

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    await browser.contextMenus.create({
      id: "ai-captcha-ocr-image",
      title: "AI OCR this image",
      contexts: ["image"]
    });
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== "ai-captcha-ocr-image" || !info.srcUrl || !tab?.id) {
      return;
    }

    await browser.tabs.sendMessage(tab.id, {
      type: MESSAGE_TYPES.OCR_CONTEXT_IMAGE,
      srcUrl: info.srcUrl
    } satisfies OcrContextImageMessage);
  });

  browser.runtime.onMessage.addListener((message: ExtensionMessage) => {
    if (message.type !== MESSAGE_TYPES.OCR_IMAGE) {
      return undefined;
    }

    return handleOcrImage(message);
  });
});

async function handleOcrImage(message: OcrImageMessage): Promise<ExtensionMessage> {
  try {
    const settings = await getSettings();
    const text = await requestOcr({
      imageDataUrl: message.imageDataUrl,
      prompt: settings.prompt
    });

    return {
      type: MESSAGE_TYPES.OCR_RESULT,
      text
    };
  } catch (error) {
    return {
      type: MESSAGE_TYPES.OCR_RESULT,
      error: error instanceof Error ? error.message : "Unknown OCR error."
    };
  }
}
