import { MESSAGE_TYPES } from "../core/defaults";

export type OcrImageMessage = {
  type: typeof MESSAGE_TYPES.OCR_IMAGE;
  imageDataUrl: string;
};

export type OcrContextImageMessage = {
  type: typeof MESSAGE_TYPES.OCR_CONTEXT_IMAGE;
  srcUrl?: string;
};

export type OcrResultMessage = {
  type: typeof MESSAGE_TYPES.OCR_RESULT;
  text?: string;
  error?: string;
};

export type ExtensionMessage = OcrImageMessage | OcrContextImageMessage | OcrResultMessage;
