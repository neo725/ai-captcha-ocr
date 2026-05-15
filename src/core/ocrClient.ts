export type OcrRequest = {
  imageDataUrl: string;
  prompt: string;
};

type OcrProvider = "openai" | "gemini";

type ResponsesApiContent = {
  type?: string;
  text?: string;
};

type ResponsesApiOutput = {
  type?: string;
  content?: ResponsesApiContent[];
};

type ResponsesApiResponse = {
  status?: string;
  output_text?: string;
  output?: ResponsesApiOutput[];
  error?: {
    message?: string;
  };
};

type GeminiPart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
    finishReason?: string;
  }>;
  error?: {
    message?: string;
  };
};

type GeminiGenerationConfig = {
  temperature: number;
  maxOutputTokens: number;
  thinkingConfig?: {
    thinkingBudget: number;
  };
};

export async function requestOcr(payload: OcrRequest): Promise<string> {
  const provider = readOcrProvider();

  if (provider === "gemini") {
    return requestGeminiOcr(payload);
  }

  return requestOpenAiOcr(payload);
}

export function normalizeOcrText(value: string): string {
  const upperValue = value.toUpperCase();
  const exactToken = upperValue.match(/(?<![A-Z0-9])[A-Z0-9]{4}(?![A-Z0-9])/);
  if (exactToken) {
    return exactToken[0];
  }

  const compactValue = upperValue.replace(/[^A-Z0-9]/g, "");
  const lastFour = compactValue.match(/[A-Z0-9]{4}$/);
  if (lastFour) {
    return lastFour[0];
  }

  return compactValue.slice(0, 4);
}

async function requestOpenAiOcr(payload: OcrRequest): Promise<string> {
  const apiKey = import.meta.env.WXT_OPENAI_API_KEY;
  const model = import.meta.env.WXT_OPENAI_MODEL || "gpt-4.1-mini";
  const detail = import.meta.env.WXT_OPENAI_IMAGE_DETAIL || "high";
  const endpoint =
    import.meta.env.WXT_OPENAI_RESPONSES_ENDPOINT ||
    "https://api.openai.com/v1/responses";

  if (!apiKey) {
    throw new Error("WXT_OPENAI_API_KEY is not configured in .env.");
  }

  const requestBody: Record<string, unknown> = {
    model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: payload.prompt
          },
          {
            type: "input_image",
            image_url: payload.imageDataUrl,
            detail
          }
        ]
      }
    ],
    max_output_tokens: 256
  };

  if (model.startsWith("gpt-5")) {
    requestBody.reasoning = { effort: "minimal" };
    requestBody.text = { verbosity: "low" };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  const body = (await response.json().catch(() => ({}))) as ResponsesApiResponse;

  if (!response.ok) {
    throw new Error(
      body.error?.message || `OpenAI request failed with ${response.status}.`
    );
  }

  const rawText = body.output_text || readOutputText(body);
  if (!rawText) {
    if ("status" in body && body.status === "incomplete") {
      throw new Error("OpenAI response was incomplete. Try a larger max_output_tokens.");
    }

    throw new Error("OpenAI response did not contain text.");
  }

  return normalizeOcrText(rawText);
}

async function requestGeminiOcr(payload: OcrRequest): Promise<string> {
  const apiKey = import.meta.env.WXT_GEMINI_API_KEY;
  const model = import.meta.env.WXT_GEMINI_MODEL || "gemini-2.5-flash";
  const maxOutputTokens = readPositiveInteger(
    import.meta.env.WXT_GEMINI_MAX_OUTPUT_TOKENS,
    512
  );
  const timeoutMs = readPositiveInteger(import.meta.env.WXT_GEMINI_TIMEOUT_MS, 30000);
  const thinkingBudget = readOptionalInteger(
    import.meta.env.WXT_GEMINI_THINKING_BUDGET,
    readDefaultGeminiThinkingBudget(model)
  );
  const endpointBase =
    import.meta.env.WXT_GEMINI_ENDPOINT ||
    "https://generativelanguage.googleapis.com/v1beta";
  const image = parseDataUrl(payload.imageDataUrl);

  if (!apiKey) {
    throw new Error("WXT_GEMINI_API_KEY is not configured in .env.");
  }

  const endpoint = `${endpointBase.replace(/\/$/, "")}/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const generationConfig: GeminiGenerationConfig = {
    temperature: 0,
    maxOutputTokens
  };

  if (thinkingBudget !== undefined) {
    generationConfig.thinkingConfig = {
      thinkingBudget
    };
  }

  const response = await fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: payload.prompt },
              {
                inlineData: {
                  mimeType: image.mimeType,
                  data: image.base64Data
                }
              }
            ]
          }
        ],
        generationConfig
      })
    },
    timeoutMs,
    "Gemini"
  );

  const body = (await response.json().catch(() => ({}))) as GeminiResponse;

  if (!response.ok) {
    throw new Error(
      body.error?.message || `Gemini request failed with ${response.status}.`
    );
  }

  const rawText = readGeminiText(body);
  if (!rawText) {
    const finishReason = body.candidates?.[0]?.finishReason;
    if (finishReason === "MAX_TOKENS") {
      throw new Error(
        "Gemini response hit MAX_TOKENS before returning OCR text. Increase WXT_GEMINI_MAX_OUTPUT_TOKENS."
      );
    }

    throw new Error(
      finishReason
        ? `Gemini response did not contain text. Finish reason: ${finishReason}.`
        : "Gemini response did not contain text."
    );
  }

  return normalizeOcrText(rawText);
}

function readOutputText(body: ResponsesApiResponse): string {
  return (
    body.output
      ?.flatMap((item) => item.content || [])
      .filter((content) => content.type === "output_text" || content.text)
      .map((content) => content.text || "")
      .join("\n") || ""
  );
}

function readGeminiText(body: GeminiResponse): string {
  return (
    body.candidates
      ?.flatMap((candidate) => candidate.content?.parts || [])
      .map((part) => part.text || "")
      .join("\n") || ""
  );
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64Data: string } {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  const mimeType = match?.[1];
  const base64Data = match?.[2];

  if (!mimeType || !base64Data) {
    throw new Error("OCR image must be a base64 data URL.");
  }

  return {
    mimeType,
    base64Data
  };
}

function readOcrProvider(): OcrProvider {
  const provider = (import.meta.env.WXT_OCR_PROVIDER || "openai").trim();
  const openAiName = (import.meta.env.WXT_OPENAI_NAME || "openai").trim();
  const geminiName = (import.meta.env.WXT_GEMINI_NAME || "gemini").trim();

  if (provider === openAiName) {
    return "openai";
  }

  if (provider === geminiName) {
    return "gemini";
  }

  throw new Error(
    `WXT_OCR_PROVIDER must match WXT_OPENAI_NAME (${openAiName}) or WXT_GEMINI_NAME (${geminiName}).`
  );
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}

function readOptionalInteger(
  value: string | undefined,
  fallback: number | undefined
): number | undefined {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (Number.isInteger(parsed)) {
    return parsed;
  }

  return fallback;
}

function readDefaultGeminiThinkingBudget(model: string): number | undefined {
  const normalizedModel = model.toLowerCase();
  if (normalizedModel.startsWith("gemini-2.5-pro")) {
    return 128;
  }

  if (normalizedModel.startsWith("gemini-2.5-flash")) {
    return 0;
  }

  return undefined;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  label: string
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`${label} request timed out after ${timeoutMs} ms.`);
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
