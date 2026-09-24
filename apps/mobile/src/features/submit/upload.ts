import { storage } from '@/lib/storage';

import { createSubmission, type NewSubmission } from './api';
import type { PickedClip, PickedThumbnail } from './media.types';
import type { ReviewCount } from './rules';

export type UploadProgress = { done: number; total: number };

export type SubmitInput = {
  userId: string;
  thumbnails: PickedThumbnail[];
  titles: string[];
  clip: PickedClip;
  requested: ReviewCount;
};

export class Cancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'Cancelled';
  }
}

/**
 * Dosyaları yükler, sonra submission'ı açar (kredi burada düşer).
 * İptal veya hata durumunda yüklenmiş dosyalar silinir; yarım submission kalmaz.
 * Kredi yalnızca create_submission başarılı olursa düşer, çünkü yükleme ondan önce biter.
 */
export async function uploadAndCreate(
  input: SubmitInput,
  options: { onProgress?: (progress: UploadProgress) => void; isCancelled?: () => boolean } = {},
): Promise<string> {
  const total = input.thumbnails.length + 1;
  const uploaded: string[] = [];
  const stop = () => options.isCancelled?.() === true;

  try {
    for (const thumbnail of input.thumbnails) {
      if (stop()) throw new Cancelled();
      uploaded.push(
        await storage.uploadThumbnail(input.userId, thumbnail.uri, thumbnail.extension),
      );
      options.onProgress?.({ done: uploaded.length, total });
    }

    if (stop()) throw new Cancelled();
    const clipPath = await storage.uploadClip(input.userId, input.clip.uri, input.clip.extension);
    uploaded.push(clipPath);
    options.onProgress?.({ done: total, total });

    if (stop()) throw new Cancelled();
    const submission: NewSubmission = {
      titles: input.titles,
      thumbnailPaths: uploaded.slice(0, -1),
      clipPath,
      clipDurationSeconds: input.clip.durationSeconds,
      requested: input.requested,
    };
    return await createSubmission(submission);
  } catch (error) {
    // Temizlik başarısız olursa asıl hatayı gizleme.
    await storage.remove(uploaded).catch(() => {});
    throw error;
  }
}
