import en from './en.json';

type Messages = typeof en;

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;

export function t(key: MessageKey): string {
  let node: unknown = en;
  for (const part of key.split('.')) {
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : key;
}
