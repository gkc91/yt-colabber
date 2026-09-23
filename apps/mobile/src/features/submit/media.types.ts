// Medya tipleri: hem cihaz (media.ts) hem web (media.web.ts) uygulamaları paylaşır.
import type { ClipProblem } from './rules';

export type PickedThumbnail = { uri: string; bytes: number };
export type PickedClip = { uri: string; bytes: number; durationSeconds: number };

export class ClipError extends Error {
  constructor(readonly code: ClipProblem | 'clip_too_large' | 'web_unsupported') {
    super(code);
    this.name = 'ClipError';
  }
}
