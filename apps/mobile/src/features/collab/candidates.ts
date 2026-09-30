// Aday destesinin saf mantığı (F2). Ağ yok, React yok — birim testleri buradadır.
import { sanitizeTypes, type CollabType } from './rules';

export interface Candidate {
  id: string;
  displayName: string | null;
  channelTitle: string | null;
  youtubeUrl: string | null;
  band: string | null;
  types: CollabType[];
  bio: string | null;
  /** Bu kişi senin testlerini kaç kez değerlendirdi. */
  reviewedMe: number;
  /** Sen onun testlerini kaç kez değerlendirdin. */
  iReviewed: number;
}

/**
 * Sunucudan gelen JSON'u ekranın kullanacağı biçime çevirir.
 *
 * SAVUNMACI: `collab_candidates` `jsonb_agg` döndürüyor ve alanların tipi sözleşmeye
 * bağlı. Tek bir bozuk kayıt yüzünden bütün destenin çökmemesi için tanınmayan satır
 * ATILIYOR (kimliği olmayan bir kart zaten tıklanamaz), kalanlar çiziliyor.
 */
export function toCandidates(raw: unknown): Candidate[] {
  if (!Array.isArray(raw)) return [];
  const out: Candidate[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || row.id.length === 0) continue;
    out.push({
      id: row.id,
      displayName: typeof row.display_name === 'string' ? row.display_name : null,
      channelTitle: typeof row.channel_title === 'string' ? row.channel_title : null,
      youtubeUrl: typeof row.youtube_url === 'string' ? row.youtube_url : null,
      band: typeof row.band === 'string' ? row.band : null,
      types: sanitizeTypes(row.types),
      bio: typeof row.bio === 'string' && row.bio.trim().length > 0 ? row.bio : null,
      reviewedMe: toCount(row.reviewed_me),
      iReviewed: toCount(row.i_reviewed),
    });
  }
  return out;
}

/** Postgres `count(*)` bigint döndürür ve supabase-js onu STRING olarak verir. */
function toCount(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Kartta gösterilecek ad: kanal adı yoksa profil adı, o da yoksa jenerik. */
export function candidateName(candidate: Candidate, fallback: string): string {
  return candidate.channelTitle ?? candidate.displayName ?? fallback;
}

export type HistoryKind = 'none' | 'they_reviewed' | 'i_reviewed' | 'both';

/**
 * "Aranızda geçmiş var mı" — kart üzerindeki tek satırlık güven işareti. PRODUCT §12'de
 * adaylar zaten buna göre sıralanıyor; ekranda da söylenmezse kullanıcı listenin neden
 * o sırada olduğunu anlamaz.
 */
export function historyKind(candidate: Candidate): HistoryKind {
  const they = candidate.reviewedMe > 0;
  const me = candidate.iReviewed > 0;
  if (they && me) return 'both';
  if (they) return 'they_reviewed';
  if (me) return 'i_reviewed';
  return 'none';
}

/** Kart destesinden bir kişiyi çıkarır (beğen/geç/engelle sonrası). */
export function removeCandidate(deck: Candidate[], id: string): Candidate[] {
  return deck.filter((candidate) => candidate.id !== id);
}
