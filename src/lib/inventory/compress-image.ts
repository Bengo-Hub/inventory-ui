/**
 * Shrinks a product photo in the browser before upload: turned upright from its EXIF, drawn on
 * white (so transparent PNGs do not turn black), fitted inside MAX_SIDE and saved as JPEG.
 * The server re-encodes and strips metadata anyway; this keeps uploads small (a 3 MB phone
 * photo becomes a few hundred KB) and under the 2 MB item-image limit. Cloudflare serves the
 * resized WebP or AVIF variants at the edge, so no other sizes are made here.
 */

export const MAX_SIDE = 1600;
const QUALITY = 0.82;
/** A JPEG already this small and within MAX_SIDE is sent as it is. */
const KEEP_BELOW_BYTES = 400 * 1024;

function jpegName(name: string): string {
  const dot = name.lastIndexOf('.');
  return `${dot > 0 ? name.slice(0, dot) : name}.jpg`;
}

export async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === 'image/jpeg' && file.size <= KEEP_BELOW_BYTES) {
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot resize images');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob) throw new Error('Could not compress the image');
    // Never send something bigger than what the person picked.
    if (blob.size >= file.size && file.type === 'image/jpeg' && scale === 1) return file;
    return new File([blob], jpegName(file.name), { type: 'image/jpeg', lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}
