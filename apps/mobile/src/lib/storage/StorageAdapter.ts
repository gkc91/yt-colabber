// Depolama arayüzü. Uygulamanın geri kalanı yalnızca bunu görür; böylece ileride R2'ye
// geçerken (ARCHITECTURE "Ölçek notları") tek bir uygulama dosyası değişir.

export type SignedMedia = {
  /** Çağıran değerlendirici mi, submission sahibi mi (sunucu karar verir). */
  role: 'reviewer' | 'owner';
  /** Değerlendiriciye yalnızca kendi atanan thumbnail'i döner. */
  thumbnails: string[];
  clip: string;
  expiresIn: number;
};

export type SignedMediaRequest = { taskId: string } | { submissionId: string };

export interface StorageAdapter {
  /** Yerel dosyayı yükler ve depolama yolunu döner (URL değil; URL'ler imzalanarak alınır). */
  uploadThumbnail(userId: string, localUri: string): Promise<string>;
  uploadClip(userId: string, localUri: string): Promise<string>;
  /** İzin verilen dosyalar için süreli (60 dk) imzalı adresler. Yetkiyi sunucu belirler. */
  getSignedUrls(request: SignedMediaRequest): Promise<SignedMedia>;
}
