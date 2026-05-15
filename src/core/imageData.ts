export async function imageElementToDataUrl(image: HTMLImageElement): Promise<string> {
  if (image.currentSrc.startsWith("data:")) {
    return image.currentSrc;
  }

  return drawImageToDataUrl(image);
}

function drawImageToDataUrl(image: HTMLImageElement): string {
  if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
    throw new Error("Image is not loaded yet.");
  }

  const scale = getImageScale();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth * scale;
  canvas.height = image.naturalHeight * scale;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not available.");
  }

  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  try {
    return canvas.toDataURL("image/png");
  } catch {
    throw new Error("Cannot read this image from canvas. The image may be cross-origin protected.");
  }
}

function getImageScale(): number {
  const scale = Number(import.meta.env.WXT_OCR_IMAGE_SCALE || "4");
  if (!Number.isFinite(scale)) {
    return 4;
  }

  return Math.min(Math.max(Math.round(scale), 1), 8);
}
