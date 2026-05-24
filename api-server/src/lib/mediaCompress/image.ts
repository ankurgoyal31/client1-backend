import sharp from "sharp";

export type CompressImageResult = {
  buffer: Buffer;
  contentType: string;
  originalBytes: number;
  compressedBytes: number;
  skipped: boolean;
};

/**
 * Visually-lossless image re-encode. Preserves pixel dimensions and the
 * embedded ICC profile; strips EXIF / XMP. SVG / GIF / PDF pass through
 * unchanged, as do recompressed buffers that aren't actually smaller.
 * Corrupt inputs throw so the caller can fall back to the original.
 */
export async function compressImage(
  buffer: Buffer,
  contentType: string,
): Promise<CompressImageResult> {
  const original: CompressImageResult = {
    buffer,
    contentType,
    originalBytes: buffer.length,
    compressedBytes: buffer.length,
    skipped: true,
  };

  const ct = contentType.toLowerCase();

  if (
    ct === "image/svg+xml" ||
    ct === "image/gif" ||
    ct === "application/pdf"
  ) {
    return original;
  }

  const pipeline = () => sharp(buffer).keepIccProfile();

  let outBuffer: Buffer;
  let outContentType = contentType;

  if (ct === "image/jpeg" || ct === "image/jpg") {
    outBuffer = await pipeline()
      .jpeg({ quality: 90, mozjpeg: true, progressive: true })
      .toBuffer();
    outContentType = "image/jpeg";
  } else if (ct === "image/png") {
    outBuffer = await pipeline()
      .png({ compressionLevel: 9, palette: true, effort: 10 })
      .toBuffer();
    outContentType = "image/png";
  } else if (ct === "image/webp") {
    outBuffer = await pipeline().webp({ quality: 90, effort: 6 }).toBuffer();
    outContentType = "image/webp";
  } else if (ct === "image/avif") {
    outBuffer = await pipeline().avif({ quality: 80, effort: 6 }).toBuffer();
    outContentType = "image/avif";
  } else {
    return original;
  }

  if (outBuffer.length >= buffer.length) {
    return original;
  }

  return {
    buffer: outBuffer,
    contentType: outContentType,
    originalBytes: buffer.length,
    compressedBytes: outBuffer.length,
    skipped: false,
  };
}
