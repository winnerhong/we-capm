const TARGET_SIZE_KB = 300;
const MAX_WIDTH = 1280;
const MAX_HEIGHT = 1280;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  // 리사이즈 비율 계산
  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // 품질을 낮춰가며 300KB 이하 달성
  let quality = 0.8;
  let blob: Blob | null = null;

  for (let i = 0; i < 5; i++) {
    blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    if (blob.size <= TARGET_SIZE_KB * 1024) break;
    quality -= 0.15;
    if (quality < 0.1) quality = 0.1;
  }

  if (!blob) return file;

  const compressed = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: "image/jpeg",
  });

  console.log(
    `[압축] ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB (${Math.round((1 - compressed.size / file.size) * 100)}% 절감)`
  );

  return compressed;
}
