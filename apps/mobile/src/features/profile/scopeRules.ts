// Değerlendirme kapsamı kuralları (B6). Saf mantık: birim testleri buradadır.
// Sınırlar 0009'daki check constraint'lerle aynı olmalı.

export const MAX_EXTRA_NICHES = 3;
export const MAX_EXTRA_LANGUAGES = 2;

/** Seçili değilse ekler, seçiliyse çıkarır; sınırı aşan yeni seçim yok sayılır. */
export function toggleWithin<T>(values: T[], value: T, max: number): T[] {
  if (values.includes(value)) return values.filter((current) => current !== value);
  if (values.length >= max) return values;
  return [...values, value];
}
