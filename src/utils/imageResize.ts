/**
 * 记账附件照片的压缩：原图直接转 base64 存 IndexedDB 会让单条账单膨胀到几 MB，
 * 备份 JSON 也跟着变大，所以入库前先等比缩到长边上限再转 JPEG。
 */
export const PHOTO_MAX_EDGE = 1280;
export const PHOTO_JPEG_QUALITY = 0.72;

export interface Size {
  width: number;
  height: number;
}

/**
 * 等比缩放到长边不超过 maxEdge；本来就在范围内就保持原尺寸（不放大）。
 * 尺寸不合法时返回 0，由调用方决定退回原图，避免画出空白 canvas。
 */
export function fitWithin(width: number, height: number, maxEdge: number): Size {
  const valid = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
  if (!valid || !Number.isFinite(maxEdge) || maxEdge <= 0) {
    return { width: 0, height: 0 };
  }
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片解码失败'));
    image.src = src;
  });
}

/**
 * 把用户选的照片压成可直接入库的 data URL。
 * 任何一步失败（浏览器解不开 HEIC、拿不到 canvas 上下文、压完反而更大）都返回原图，
 * 宁可占空间也不要让用户丢掉附件。
 */
export async function compressPhotoFile(file: File): Promise<string> {
  const original = await readAsDataURL(file);
  try {
    const image = await loadImage(original);
    const { width, height } = fitWithin(image.naturalWidth, image.naturalHeight, PHOTO_MAX_EDGE);
    if (!width || !height) return original;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return original;

    // 透明 PNG 转 JPEG 会变黑底，先铺白底。
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const compressed = canvas.toDataURL('image/jpeg', PHOTO_JPEG_QUALITY);
    return compressed.length < original.length ? compressed : original;
  } catch {
    return original;
  }
}
