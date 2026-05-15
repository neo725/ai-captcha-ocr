import { browser } from "wxt/browser";
import { imageElementToDataUrl } from "../src/core/imageData";
import { MESSAGE_TYPES } from "../src/core/defaults";
import type { ExtensionMessage, OcrImageMessage } from "../src/types/messages";
import "../src/styles/content.css";

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    const controller = new CaptchaOcrOverlay();
    controller.start();

    browser.runtime.onMessage.addListener((message: ExtensionMessage) => {
      if (message.type === MESSAGE_TYPES.OCR_CONTEXT_IMAGE) {
        controller.runOcrForContextImage(message.srcUrl);
      }

      return undefined;
    });
  }
});

class CaptchaOcrOverlay {
  private readonly trackedImages = new WeakSet<HTMLImageElement>();
  private readonly buttonByImage = new WeakMap<HTMLImageElement, HTMLButtonElement>();
  private readonly result = document.createElement("div");
  private readonly toggleButton = document.createElement("button");
  private observer?: MutationObserver;
  private isEnabled = false;
  private lastContextImage?: HTMLImageElement;

  start(): void {
    this.result.className = "ai-captcha-ocr-result";
    document.documentElement.append(this.result);
    this.addToggleButton();

    window.addEventListener("scroll", () => this.syncButtons(), { passive: true });
    window.addEventListener("resize", () => this.syncButtons());
    document.addEventListener(
      "contextmenu",
      (event) => {
        this.lastContextImage = this.findImageFromTarget(event.target);
      },
      true
    );
  }

  private addToggleButton(): void {
    this.toggleButton.type = "button";
    this.toggleButton.className = "ai-captcha-ocr-toggle";
    this.toggleButton.textContent = "顯示 AI OCR";
    this.toggleButton.title = "顯示 AI OCR 按鈕";
    this.toggleButton.addEventListener("click", () => this.enableImageButtons());
    document.documentElement.append(this.toggleButton);
  }

  private enableImageButtons(): void {
    if (this.isEnabled) {
      return;
    }

    this.isEnabled = true;
    this.toggleButton.hidden = true;
    this.scanImages();
    this.observer = new MutationObserver(() => this.scanImages());
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    this.showResult("AI OCR 按鈕已顯示");
  }

  async runOcrForContextImage(src?: string): Promise<void> {
    if (this.lastContextImage?.isConnected) {
      await this.runOcr(this.lastContextImage);
      return;
    }

    if (!src) {
      this.showResult("找不到右鍵圖片");
      return;
    }

    const image = Array.from(document.images).find((candidate) => {
      return candidate.currentSrc === src || candidate.src === src;
    });

    if (!image) {
      this.showResult("找不到對應圖片");
      return;
    }

    await this.runOcr(image);
  }

  private scanImages(): void {
    for (const image of Array.from(document.images)) {
      if (this.trackedImages.has(image) || !this.looksLikeCaptcha(image)) {
        continue;
      }

      this.trackedImages.add(image);
      this.addButton(image);
    }

    this.syncButtons();
  }

  private addButton(image: HTMLImageElement): void {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ai-captcha-ocr-button";
    button.title = "AI OCR";
    button.textContent = "OCR";
    button.addEventListener("click", () => this.runOcr(image));
    document.documentElement.append(button);
    this.buttonByImage.set(image, button);
  }

  private syncButtons(): void {
    for (const image of Array.from(document.images)) {
      const button = this.buttonByImage.get(image);
      if (!button) {
        continue;
      }

      const rect = image.getBoundingClientRect();
      const visible = rect.width > 12 && rect.height > 12 && rect.bottom > 0 && rect.right > 0;
      button.hidden = !visible;
      button.style.left = `${Math.max(4, window.scrollX + rect.left)}px`;
      button.style.top = `${Math.max(4, window.scrollY + rect.top + rect.height)}px`;
    }
  }

  private async runOcr(image: HTMLImageElement): Promise<void> {
    this.showResult("辨識中...");

    try {
      const imageDataUrl = await imageElementToDataUrl(image);
      const response = (await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.OCR_IMAGE,
        imageDataUrl
      } satisfies OcrImageMessage)) as ExtensionMessage;

      if (response.type !== MESSAGE_TYPES.OCR_RESULT) {
        throw new Error("Unexpected OCR response.");
      }

      if (response.error) {
        throw new Error(response.error);
      }

      await this.handleRecognizedText(image, response.text || "");
    } catch (error) {
      this.showResult(error instanceof Error ? error.message : "辨識失敗");
    }
  }

  private async handleRecognizedText(
    image: HTMLImageElement,
    text: string
  ): Promise<void> {
    const recognizedText = text.trim().toUpperCase();
    if (recognizedText.length !== 4) {
      this.showResult(recognizedText || "無結果");
      return;
    }

    const input = this.findFollowingTextInput(image);
    if (input) {
      this.fillTextInput(input, recognizedText);
      this.showResult(`${recognizedText} 已填入文字欄位`);
      return;
    }

    await this.copyText(recognizedText);
    this.showResult(`${recognizedText} 已經複製到剪貼簿`);
  }

  private findFollowingTextInput(image: HTMLImageElement): HTMLInputElement | undefined {
    let current: Element | null = image;

    for (let depth = 0; current && depth <= 5; depth += 1) {
      const input = this.findTextInputInFollowingSiblings(current);
      if (input) {
        return input;
      }

      current = current.parentElement;
    }

    return undefined;
  }

  private findTextInputInFollowingSiblings(
    element: Element
  ): HTMLInputElement | undefined {
    let sibling = element.nextElementSibling;

    while (sibling) {
      const input = this.findFirstTextInput(sibling);
      if (input) {
        return input;
      }

      sibling = sibling.nextElementSibling;
    }

    return undefined;
  }

  private findFirstTextInput(root: Element): HTMLInputElement | undefined {
    if (this.isUsableTextInput(root)) {
      return root;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let current = walker.nextNode();

    while (current) {
      if (current instanceof Element && this.isUsableTextInput(current)) {
        return current;
      }

      current = walker.nextNode();
    }

    return undefined;
  }

  private isUsableTextInput(element: Element): element is HTMLInputElement {
    return (
      element instanceof HTMLInputElement &&
      element.type.toLowerCase() === "text" &&
      !element.disabled &&
      !element.readOnly
    );
  }

  private fillTextInput(input: HTMLInputElement, text: string): void {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;

    valueSetter?.call(input, text);
    input.focus();
    input.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  private async copyText(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      this.copyTextWithFallback(text);
    }
  }

  private copyTextWithFallback(text: string): void {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  private looksLikeCaptcha(image: HTMLImageElement): boolean {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const src = `${image.src} ${image.alt} ${image.id} ${image.className}`.toLowerCase();

    return (
      src.includes("captcha") ||
      src.includes("verify") ||
      (width >= 40 && width <= 320 && height >= 20 && height <= 140)
    );
  }

  private showResult(message: string): void {
    this.result.textContent = message;
    this.result.classList.add("is-visible");
    window.setTimeout(() => this.result.classList.remove("is-visible"), 20000);
  }

  private findImageFromTarget(target: EventTarget | null): HTMLImageElement | undefined {
    if (!(target instanceof Element)) {
      return undefined;
    }

    const image = target.closest("img");
    return image instanceof HTMLImageElement ? image : undefined;
  }
}
