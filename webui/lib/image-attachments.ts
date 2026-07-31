export const MAX_ATTACHED_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHED_IMAGES = 10;

function decodedBase64Bytes(data: string): number | null {
  if (!data || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) return null;
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return (data.length / 4) * 3 - padding;
}

export function validateAgentImages(value: unknown): string | null {
  if (value === undefined) return null;
  if (!Array.isArray(value)) return "images must be an array";
  if (value.length > MAX_ATTACHED_IMAGES) {
    return `A message can include at most ${MAX_ATTACHED_IMAGES} images`;
  }
  for (const image of value) {
    if (!image || typeof image !== "object") return "Each attachment must be an image";
    const candidate = image as { type?: unknown; data?: unknown; mimeType?: unknown };
    if (candidate.type !== "image" || typeof candidate.data !== "string" || typeof candidate.mimeType !== "string" || !candidate.mimeType.startsWith("image/")) {
      return "Each attachment must be an image";
    }
    const bytes = decodedBase64Bytes(candidate.data);
    if (bytes === null || bytes > MAX_ATTACHED_IMAGE_BYTES) {
      return `Each image must be valid base64 image data of ${MAX_ATTACHED_IMAGE_BYTES / (1024 * 1024)}MB or smaller`;
    }
  }
  return null;
}
