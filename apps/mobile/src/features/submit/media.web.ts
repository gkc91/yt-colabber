// Web'de submission oluşturulmaz (PRODUCT §14): video seçme ve sıkıştırma cihaz işidir.
// Bu dosya olmasaydı cihaza özel sıkıştırma kütüphanesi web paketine girip derlemeyi kırardı.
import { ClipError, type PickedClip, type PickedThumbnail } from './media.types';

export { ClipError };
export type { PickedClip, PickedThumbnail };

export async function pickThumbnails(): Promise<PickedThumbnail[]> {
  throw new ClipError('web_unsupported');
}

export async function pickClip(): Promise<PickedClip | null> {
  throw new ClipError('web_unsupported');
}
