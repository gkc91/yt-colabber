// Collab profilinin saf kuralları (PRODUCT §12, F1). Birim testleri buradadır.
//
// Collab KREDİYE BAĞLANMAZ (CLAUDE.md kırmızı çizgi): burada hiçbir bakiye okunmaz,
// hiçbir ödül hesaplanmaz. Modül yalnızca tanıştırır.

/**
 * Tür kataloğu. Sıra EKRANDAKİ sıradır ve `collab_type` enum'ıyla birebir aynı olmalı
 * (0002_collab.sql) — burada olmayan bir değer sunucuya gönderilirse insert düşer.
 */
export const COLLAB_TYPES = ['joint_video', 'guest', 'shorts', 'end_screen_swap', 'live'] as const;

export type CollabType = (typeof COLLAB_TYPES)[number];

/** `collab_profiles.bio` sütunundaki `check (length(bio) <= 280)` ile aynı sayı. */
export const BIO_MAX = 280;

export function isCollabType(value: unknown): value is CollabType {
  return typeof value === 'string' && (COLLAB_TYPES as readonly string[]).includes(value);
}

/**
 * Sunucudan gelen tür dizisini ekranın güvenle kullanabileceği hâle getirir: tanınmayanı
 * atar, tekrarı siler, katalog sırasına sokar.
 *
 * NEDEN: enum ileride büyüyebilir ve eski bir istemci tanımadığı bir değerle karşılaşır.
 * O değeri olduğu gibi geri yazmak, kullanıcının hiç görmediği bir seçimi korumak olurdu;
 * atmak ise sessizce silmek. İkisi de kötü ama ikincisi GÖRÜNÜR: kullanıcı ekranda seçili
 * olmadığını görür ve yeniden seçebilir.
 */
export function sanitizeTypes(raw: unknown): CollabType[] {
  const list = Array.isArray(raw) ? raw : [];
  return COLLAB_TYPES.filter((type) => list.includes(type));
}

/** Boş/boşluk bio `null` olur: veritabanında "" ile `null` iki ayrı boş demek istemiyoruz. */
export function normalizeBio(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function bioError(raw: string): 'too_long' | null {
  return raw.trim().length > BIO_MAX ? 'too_long' : null;
}

export interface CollabProfile {
  isOpen: boolean;
  types: CollabType[];
  bio: string | null;
}

export const EMPTY_COLLAB_PROFILE: CollabProfile = { isOpen: false, types: [], bio: null };

export function toggleType(current: CollabType[], type: CollabType): CollabType[] {
  const next = current.includes(type)
    ? current.filter((item) => item !== type)
    : [...current, type];
  return sanitizeTypes(next);
}

/**
 * Kaydedilebilir mi? Açıksa en az bir tür ZORUNLU: türsüz açık bir profil aday listesinde
 * görünür ama karşı tarafa "ne için müsait" bilgisini vermez, yani kartı boş çıkar.
 * Kapalıyken tür aranmaz — kullanıcı kapatırken seçimlerini silmek zorunda kalmasın.
 */
export function collabProfileError(draft: CollabProfile): 'no_type' | 'too_long' | null {
  if (draft.bio !== null && draft.bio.length > BIO_MAX) return 'too_long';
  if (draft.isOpen && draft.types.length === 0) return 'no_type';
  return null;
}

export function collabProfileChanged(a: CollabProfile, b: CollabProfile): boolean {
  return (
    a.isOpen !== b.isOpen ||
    a.bio !== b.bio ||
    a.types.length !== b.types.length ||
    a.types.some((type, index) => type !== b.types[index])
  );
}
