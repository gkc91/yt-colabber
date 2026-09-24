// Depolama yolları ve sınırlar. Saf mantık: birim testleri buradadır.
// Yol düzeni `<klasör>/<userId>/<id>.<uzantı>` OLMAK ZORUNDA: storage policy ikinci parçayı
// auth.uid() ile karşılaştırıyor (0001). Düzen bozulursa yükleme RLS'e takılır.

export const MEDIA_BUCKET = 'media';
export const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024; // PRODUCT §6
export const MAX_CLIP_BYTES = 8 * 1024 * 1024; // PRODUCT §6, kova da sunucuda sınırlar (0004)

const THUMBNAIL_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;
const CLIP_TYPES = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
} as const;

export type MediaErrorCode = 'file_too_large' | 'unsupported_type' | 'invalid_user_id';

export class MediaError extends Error {
  constructor(
    readonly code: MediaErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MediaError';
  }
}

export function extensionFromUri(uri: string): string {
  const withoutQuery = uri.split(/[?#]/)[0];
  const lastSegment = withoutQuery.split('/').pop() ?? '';
  const dot = lastSegment.lastIndexOf('.');
  return dot === -1 ? '' : lastSegment.slice(dot + 1).toLowerCase();
}

function assertUserId(userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    throw new MediaError('invalid_user_id', `Not a user id: ${userId}`);
  }
}

export function thumbnailPath(
  userId: string,
  fileId: string,
  uri: string,
  extension?: string,
): string {
  assertUserId(userId);
  const ext = (extension ?? extensionFromUri(uri)).toLowerCase();
  if (!(ext in THUMBNAIL_TYPES)) {
    throw new MediaError('unsupported_type', `Thumbnail type not allowed: ${ext || 'none'}`);
  }
  return `thumbs/${userId}/${fileId}.${ext}`;
}

export function clipPath(userId: string, fileId: string, uri: string, extension?: string): string {
  assertUserId(userId);
  const ext = (extension ?? extensionFromUri(uri)).toLowerCase();
  if (!(ext in CLIP_TYPES)) {
    throw new MediaError('unsupported_type', `Clip type not allowed: ${ext || 'none'}`);
  }
  return `clips/${userId}/${fileId}.${ext}`;
}

export function contentTypeForPath(path: string): string {
  const ext = extensionFromUri(path);
  const type = { ...THUMBNAIL_TYPES, ...CLIP_TYPES }[ext as keyof typeof THUMBNAIL_TYPES];
  if (!type) throw new MediaError('unsupported_type', `Unknown media type: ${ext || 'none'}`);
  return type;
}

export function assertWithinLimit(bytes: number, limit: number): void {
  if (bytes > limit) {
    throw new MediaError(
      'file_too_large',
      `File is ${Math.ceil(bytes / 1024)} KB, limit is ${Math.ceil(limit / 1024)} KB`,
    );
  }
}
