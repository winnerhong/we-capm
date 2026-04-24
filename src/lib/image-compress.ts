interface CompressOptions {
  maxKb?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export async function compressImage(
  file: File,
  opts: CompressOptions = {}
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const maxKb = opts.maxKb ?? 300;
  const maxW = opts.maxWidth ?? 1280;
  const maxH = opts.maxHeight ?? 1280;

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (width > maxW || height > maxH) {
    const ratio = Math.min(maxW / width, maxH / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.85;
  let blob: Blob | null = null;

  for (let i = 0; i < 6; i++) {
    blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    if (blob.size <= maxKb * 1024) break;
    quality -= 0.12;
    if (quality < 0.1) quality = 0.1;
  }

  if (!blob) return file;

  const compressed = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: "image/jpeg",
  });

  console.log(
    `[압축] ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB (${width}x${height})`
  );

  return compressed;
}
