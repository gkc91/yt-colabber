// Medya tipleri: hem cihaz (media.ts) hem web (media.web.ts) uygulamaları paylaşır.
import type { ClipFileProblem } from './rules';

// `extension`: web'de dosyalar blob: adresiyle geliyor ve adreste uzantı olmuyor;
// depolama yolu uzantıya bağlı olduğu için (paths.ts) tipi ayrıca taşıyoruz.
export type PickedThumbnail = { uri: string; bytes: number; extension?: string };
export type PickedClip = {
  uri: string;
  bytes: number;
  durationSeconds: number;
  extension?: string;
};

export class ClipError extends Error {
  constructor(readonly code: ClipFileProblem | 'web_unsupported') {
    super(code);
    this.name = 'ClipError';
  }
}
