import { SupabaseStorage } from './SupabaseStorage';
import type { StorageAdapter } from './StorageAdapter';

// Tek giriş noktası: ekranlar ve feature API'leri yalnızca bunu kullanır.
export const storage: StorageAdapter = new SupabaseStorage();

export { MAX_CLIP_BYTES, MAX_THUMBNAIL_BYTES, MediaError } from './paths';
export type { SignedMedia, SignedMediaRequest, StorageAdapter } from './StorageAdapter';
