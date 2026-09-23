import * as Crypto from 'expo-crypto';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

import {
  assertWithinLimit,
  clipPath,
  contentTypeForPath,
  MAX_CLIP_BYTES,
  MAX_THUMBNAIL_BYTES,
  MEDIA_BUCKET,
  thumbnailPath,
} from './paths';
import type { SignedMedia, SignedMediaRequest, StorageAdapter } from './StorageAdapter';

async function readLocalFile(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Cannot read file: ${uri}`);
  return response.arrayBuffer();
}

async function upload(path: string, uri: string, limit: number): Promise<string> {
  const bytes = await readLocalFile(uri);
  assertWithinLimit(bytes.byteLength, limit);

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, bytes, {
    contentType: contentTypeForPath(path),
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export class SupabaseStorage implements StorageAdapter {
  uploadThumbnail(userId: string, localUri: string): Promise<string> {
    return upload(
      thumbnailPath(userId, Crypto.randomUUID(), localUri),
      localUri,
      MAX_THUMBNAIL_BYTES,
    );
  }

  uploadClip(userId: string, localUri: string): Promise<string> {
    return upload(clipPath(userId, Crypto.randomUUID(), localUri), localUri, MAX_CLIP_BYTES);
  }

  async remove(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(paths);
    if (error) throw error;
  }

  // Signed URL'leri client üretemez (bucket private, başkasının dosyası okunamaz):
  // 'signed-media' Edge Function'ı media_paths() ile yetkiyi doğrulayıp imzalar.
  async getSignedUrls(request: SignedMediaRequest): Promise<SignedMedia> {
    const body =
      'taskId' in request ? { task_id: request.taskId } : { submission_id: request.submissionId };

    const { data, error } = await supabase.functions.invoke<{
      role: SignedMedia['role'];
      thumbnails: string[];
      clip: string;
      expires_in: number;
    }>('signed-media', { body });
    if (error) throw error;
    if (!data) throw new Error('signed-media returned no data');

    // Fonksiyon göreli yol döner (bkz. signed-media); tam adresi burada kurarız.
    const absolute = (path: string) => `${env.EXPO_PUBLIC_SUPABASE_URL}${path}`;
    return {
      role: data.role,
      thumbnails: data.thumbnails.map(absolute),
      clip: absolute(data.clip),
      expiresIn: data.expires_in,
    };
  }
}
