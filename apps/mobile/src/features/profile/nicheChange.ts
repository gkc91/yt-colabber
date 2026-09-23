// Niş değiştirme kuralı (C4). Saf mantık: birim testleri buradadır.
// Sunucu da aynı kuralı uygular (change_niche, 0013); buradaki hesap yalnızca
// kullanıcıya kaç gün kaldığını göstermek içindir.

export const NICHE_CHANGE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntilNicheChange(changedAt: string | null, now: Date = new Date()): number {
  if (!changedAt) return 0;
  const elapsed = now.getTime() - new Date(changedAt).getTime();
  const remaining = Math.ceil((NICHE_CHANGE_DAYS * DAY_MS - elapsed) / DAY_MS);
  return remaining > 0 ? remaining : 0;
}

export const canChangeNiche = (changedAt: string | null, now: Date = new Date()): boolean =>
  daysUntilNicheChange(changedAt, now) === 0;
