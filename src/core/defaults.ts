export const DEFAULT_PROMPT = [
  "你是一個 OCR 引擎。",
  "圖片是 4 個英文字母或數字的驗證碼。",
  "請忽略所有穿越字元的彩色細線、斜線與背景雜訊，只辨識 4 個主要字元。",
  "每個主要字元本體通常只會有一種主色；同一字元中與主色不一致、細而不連續、跨越其他字元或只佔少數局部的彩色筆畫，應視為未清除乾淨的雜訊，不要把它當成字元的一部分。",
  "字元可能包含數字 0-9，請特別區分數字 4 和字母 A。",
  "只輸出 4 個字元，不要空白、標點、換行或說明。"
].join("\n");

export const DEFAULT_SETTINGS = {
  prompt: DEFAULT_PROMPT
};

export const MESSAGE_TYPES = {
  OCR_IMAGE: "AI_CAPTCHA_OCR_IMAGE",
  OCR_CONTEXT_IMAGE: "AI_CAPTCHA_OCR_CONTEXT_IMAGE",
  OCR_RESULT: "AI_CAPTCHA_OCR_RESULT"
} as const;
