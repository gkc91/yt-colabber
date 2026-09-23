// Galeriden seçme, küçültme ve sıkıştırma. Cihaz API'leri kullanır (web'de çalışmaz —
// PRODUCT §14: submission oluşturma yalnızca uygulamada).
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'react-native-compressor';

import { MAX_CLIP_BYTES, MAX_THUMBNAIL_BYTES, MediaError } from '@/lib/storage';

import { ClipError, type PickedClip, type PickedThumbnail } from './media.types';
import { CLIP_MAX_SECONDS, MAX_THUMBNAILS, THUMBNAIL_SIZE, validateClipDuration } from './rules';

export { ClipError };
export type { PickedClip, PickedThumbnail };

/** Galeriden 1..N thumbnail seçer ve her birini 1280×720 JPEG'e indirir (PRODUCT §6). */
export async function pickThumbnails(slotsLeft: number): Promise<PickedThumbnail[]> {
  const limit = Math.min(slotsLeft, MAX_THUMBNAILS);
  if (limit <= 0) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 1,
  });
  if (result.canceled) return [];

  const prepared: PickedThumbnail[] = [];
  for (const asset of result.assets.slice(0, limit)) {
    prepared.push(await resizeThumbnail(asset.uri));
  }
  return prepared;
}

async function resizeThumbnail(uri: string): Promise<PickedThumbnail> {
  const context = ImageManipulator.manipulate(uri);
  context.resize(THUMBNAIL_SIZE);
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });

  const bytes = await fileSize(saved.uri);
  if (bytes > MAX_THUMBNAIL_BYTES) {
    // 1280×720 JPEG normalde 2 MB'ın çok altında; buraya düşerse daha sert sıkıştır.
    const retry = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.6 });
    return { uri: retry.uri, bytes: await fileSize(retry.uri) };
  }
  return { uri: saved.uri, bytes };
}

/**
 * Klip seçer: seçici 60 sn ile sınırlıdır ve düzenleme ekranı açılır, böylece uzun
 * videodan ilk 60 sn kullanıcı tarafından kırpılır. Sonra 720p'ye sıkıştırılır.
 */
export async function pickClip(onProgress?: (ratio: number) => void): Promise<PickedClip | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'videos',
    allowsEditing: true,
    videoMaxDuration: CLIP_MAX_SECONDS,
    quality: 1,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  const durationSeconds = Math.round((asset.duration ?? 0) / 1000);
  const durationProblem = validateClipDuration(durationSeconds);
  if (durationProblem) throw new ClipError(durationProblem);

  const compressedUri = await Video.compress(
    asset.uri,
    { compressionMethod: 'manual', maxSize: 1280, bitrate: 2_000_000 },
    (progress) => onProgress?.(progress),
  );

  const bytes = await fileSize(compressedUri);
  if (bytes > MAX_CLIP_BYTES) throw new ClipError('clip_too_large');

  return { uri: compressedUri, bytes, durationSeconds };
}

async function fileSize(uri: string): Promise<number> {
  const response = await fetch(uri);
  if (!response.ok) throw new MediaError('unsupported_type', `Cannot read file: ${uri}`);
  const blob = await response.blob();
  return blob.size;
}
