/// <reference types="wxt/client" />

interface ImportMetaEnv {
  readonly WXT_OCR_PROVIDER?: string;
  readonly WXT_OPENAI_NAME?: string;
  readonly WXT_OPENAI_API_KEY?: string;
  readonly WXT_OPENAI_MODEL?: string;
  readonly WXT_OPENAI_IMAGE_DETAIL?: "low" | "high" | "auto";
  readonly WXT_OPENAI_RESPONSES_ENDPOINT?: string;
  readonly WXT_GEMINI_NAME?: string;
  readonly WXT_GEMINI_API_KEY?: string;
  readonly WXT_GEMINI_MODEL?: string;
  readonly WXT_GEMINI_MAX_OUTPUT_TOKENS?: string;
  readonly WXT_GEMINI_THINKING_BUDGET?: string;
  readonly WXT_GEMINI_TIMEOUT_MS?: string;
  readonly WXT_GEMINI_ENDPOINT?: string;
  readonly WXT_OCR_IMAGE_SCALE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
