import { defineConfig } from "wxt";

export default defineConfig({
  suppressWarnings: {
    firefoxDataCollection: true
  },
  manifest: {
    name: "AI Captcha OCR",
    description: "Internal OCR helper for selected captcha images.",
    permissions: ["activeTab", "clipboardWrite", "contextMenus", "storage"],
    host_permissions: ["<all_urls>"],
    action: {
      default_title: "AI Captcha OCR"
    }
  }
});
