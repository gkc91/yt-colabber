// Medya tipleri: hem cihaz (media.ts) hem web (media.web.ts) uygulamaları paylaşır.
import type { ClipFileProblem } from './rules';

// `extension`: web'de dosyalar blob: adresiyle geliyor ve adreste uzantı olmuyor;
// depolama yolu uzantıya bağlı olduğu için (paths.ts) tipi ayrıca taşıyoruz.
// `name`: seçim anındaki özgün dosya adı. Yeniden boyutlandırma geçici bir dosya
// ürettiği için ad orada kayboluyor; kullanıcı ne eklediğini görebilsin diye taşıyoruz.
export type PickedThumbnail = {
  uri: string;
  bytes: number;
  extension?: string;
  name?: string;
};
export type PickedClip = {
  uri: string;
  bytes: number;
  durationSeconds: number;
  /** Shorts/Reels/TikTok dikey çekilir; ızgara ve oynatıcı buna göre çizilir (0024). */
  isVertical: boolean;
  extension?: string;
};

export class ClipError extends Error {
  constructor(readonly code: ClipFileProblem | 'web_unsupported') {
    super(code);
    this.name = 'ClipError';
  }
}
