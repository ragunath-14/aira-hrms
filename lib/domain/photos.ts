export const MAX_PHOTO_BYTES = 1024 * 1024;

const starts = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

// What image this really is, judged from its first bytes and never from the
// name or the type the browser claims. Only common photo formats are accepted:
// no SVG (it can carry script) and nothing else.
export function detectImage(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (starts(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // WebP is "RIFF", four size bytes, then "WEBP".
  if (starts(bytes, [0x52, 0x49, 0x46, 0x46]) && starts(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }

  return null;
}
