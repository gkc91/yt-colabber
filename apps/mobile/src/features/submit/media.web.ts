// Masaüstü tarayıcıdan test açma (E5). Üreticiler kurguyu ve thumbnail'ı PC'de yapıyor;
// dosyayı telefona taşıtmak kullanıcıyı kaybettiğimiz yerdi.
//
// Sıkıştırma YOK — ne tarayıcıda ne sunucuda. Klip zaten ≤60 sn ve ≤8 MB olmak zorunda
// (PRODUCT §6); kapıda doğrularız, uymuyorsa ne yapması gerektiğini söyleriz.
// Thumbnail farklı: görsel yeniden boyutlandırma tarayıcıda ucuz, onu biz yaparız.
import { ClipError, type PickedClip, type PickedThumbnail } from './media.types';
import { MAX_THUMBNAILS, THUMBNAIL_SIZE, validateClipFile } from './rules';

export { ClipError };
export type { PickedClip, PickedThumbnail };

const CLIP_EXTENSIONS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

/** Gizli bir <input type="file"> açar ve seçilen dosyaları döner. */
function chooseFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';

    const finish = (files: File[]) => {
      input.remove();
      resolve(files);
    };

    input.addEventListener('change', () => finish(Array.from(input.files ?? [])));
    // Kullanıcı pencereyi kapatırsa 'change' hiç gelmez; sekmeye dönüşte temizleriz.
    window.addEventListener('focus', () => setTimeout(() => finish([]), 500), { once: true });

    document.body.append(input);
    input.click();
  });
}

/** 1280×720'ye ortadan kırparak indirger ve JPEG'e çevirir (cihazdaki ile aynı hedef). */
async function resizeThumbnail(file: File): Promise<PickedThumbnail> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = THUMBNAIL_SIZE;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new ClipError('clip_wrong_type');

  const scale = Math.max(width / bitmap.width, height / bitmap.height);
  const drawWidth = bitmap.width * scale;
  const drawHeight = bitmap.height * scale;
  context.drawImage(
    bitmap,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  );
  if (!blob) throw new ClipError('clip_wrong_type');

  return { uri: URL.createObjectURL(blob), bytes: blob.size, extension: 'jpg' };
}

export async function pickThumbnails(slotsLeft: number): Promise<PickedThumbnail[]> {
  const limit = Math.min(slotsLeft, MAX_THUMBNAILS);
  if (limit <= 0) return [];

  const files = await chooseFiles('image/*', limit > 1);
  const prepared: PickedThumbnail[] = [];
  for (const file of files.slice(0, limit)) {
    prepared.push(await resizeThumbnail(file));
  }
  return prepared;
}

/** Dosyanın süresini tarayıcıya okutur; metadata gelmezse süre bilinmiyor demektir. */
function readDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => resolve(video.duration);
    video.onerror = () => reject(new ClipError('clip_wrong_type'));
    video.src = url;
  });
}

export async function pickClip(): Promise<PickedClip | null> {
  const [file] = await chooseFiles('video/mp4,video/quicktime', false);
  if (!file) return null;

  const url = URL.createObjectURL(file);
  let durationSeconds: number;
  try {
    durationSeconds = await readDuration(url);
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }

  const problem = validateClipFile({
    durationSeconds,
    bytes: file.size,
    mimeType: file.type,
  });
  if (problem) {
    URL.revokeObjectURL(url);
    throw new ClipError(problem);
  }

  return {
    uri: url,
    bytes: file.size,
    durationSeconds: Math.round(durationSeconds),
    extension: CLIP_EXTENSIONS[file.type.split(';')[0]] ?? 'mp4',
  };
}
